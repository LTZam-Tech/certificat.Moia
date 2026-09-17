'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const config = require('./config');
const employeeRepo = require('./employeeRepo');
const { isValidSaudiId, normalizeMobile, toE164 } = require('./validators');
const lockout = require('./lockoutService');
const audit = require('./auditService');
const session = require('./sessionService');
const certService = require('./certService');
const adminAuth = require('./adminAuth');
const { importEmployeesXlsx } = require('./xlsxImport');
const trainingRepo = require('./trainingRepo');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sourceIp(req) {
  // Trust X-Forwarded-For only if you terminate TLS behind a trusted reverse
  // proxy (e.g. IIS/ARR) on the same host; otherwise use the socket address.
  const xf = req.headers['x-forwarded-for'];
  if (xf) return xf.split(',')[0].trim();
  return req.socket.remoteAddress;
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function sendFile(res, absPath, extraHeaders) {
  const ext = path.extname(absPath).toLowerCase();
  const type = STATIC_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(absPath);
  res.writeHead(200, Object.assign({
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
  }, extraHeaders || {}));
  fs.createReadStream(absPath).pipe(res);
}

function serveStatic(req, res, urlPath) {
  const safeName = path.basename(urlPath); // no subdirectories -> no traversal
  const candidates = [
    path.join(PUBLIC_DIR, urlPath === '/' ? 'login.html' : safeName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      sendFile(res, candidate);
      return true;
    }
  }
  return false;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    const MAX = 5 * 1024 * 1024; // 5MB cap, generous for CSV imports
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------
// Employee-facing API
// ---------------------------------------------------------------------

async function handleLogin(req, res) {
  const ip = sourceIp(req);
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }

  const rawId = String(body.nationalId || '');
  const rawMobile = String(body.mobile || '');

  // Format validation first (doesn't touch the lockout counters).
  if (!isValidSaudiId(rawId)) {
    return sendJson(res, 400, { ok: false, error: 'invalid_format' });
  }
  const nsn = normalizeMobile(rawMobile);
  if (!nsn) {
    return sendJson(res, 400, { ok: false, error: 'invalid_format' });
  }

  if (lockout.checkLockout(rawId, ip)) {
    audit.log('lockout', { nationalId: rawId, sourceIp: ip });
    return sendJson(res, 429, { ok: false, error: 'locked_out' });
  }

  const mobileE164 = toE164(nsn);
  const employee = employeeRepo.verifyPair(rawId, mobileE164);

  if (!employee) {
    lockout.recordFailedAttempt(rawId, ip);
    audit.log('login_failure', { nationalId: rawId, sourceIp: ip });
    // Generic response regardless of which field was wrong (BRD 5.8).
    return sendJson(res, 401, { ok: false, error: 'verification_failed' });
  }

  lockout.clearAttempts(rawId, ip);
  const token = session.createSession(employee.national_id, ip);
  audit.log('login_success', { nationalId: rawId, sourceIp: ip });

  res.setHeader('Set-Cookie', session.cookieHeader(token));
  sendJson(res, 200, { ok: true });
}

function requireSession(req, res) {
  const token = session.getTokenFromRequest(req);
  const nationalId = session.resolveSession(token);
  if (!nationalId) {
    sendJson(res, 401, { error: 'session_expired' });
    return null;
  }
  return nationalId;
}

function handleMe(req, res) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  const emp = employeeRepo.findById(nationalId);
  if (!emp) return sendJson(res, 401, { error: 'session_expired' });
  sendJson(res, 200, { last4: nationalId.slice(-4) });
}

function handleCertificates(req, res) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  try {
    const certs = certService.listCertificatesForEmployee(nationalId);
    sendJson(res, 200, { certificates: certs });
  } catch (err) {
    if (err instanceof certService.SharedFolderUnavailableError) {
      audit.log('download', { nationalId, detail: 'shared_folder_unavailable (list)' });
      return sendJson(res, 503, { error: 'shared_folder_unavailable' });
    }
    throw err;
  }
}

function handleDownload(req, res, parsedUrl) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  const ip = sourceIp(req);
  const fileName = parsedUrl.searchParams.get('file') || '';

  let fullPath;
  try {
    fullPath = certService.resolveOwnedFile(nationalId, fileName);
  } catch (err) {
    return sendJson(res, 503, { error: 'shared_folder_unavailable' });
  }

  if (!fullPath) {
    audit.log('download', { nationalId, fileRef: fileName, sourceIp: ip, detail: 'denied_or_not_found' });
    return sendJson(res, 404, { error: 'not_found' });
  }

  const ext = path.extname(fullPath);
  audit.log('download', { nationalId, fileRef: path.basename(fullPath), sourceIp: ip });

  res.writeHead(200, {
    'Content-Type': certService.mimeTypeFor(ext),
    'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(fullPath).pipe(res);
}

function handleLogout(req, res) {
  const token = session.getTokenFromRequest(req);
  session.destroySession(token);
  res.setHeader('Set-Cookie', session.clearCookieHeader());
  sendJson(res, 200, { ok: true });
}

// ---------------------------------------------------------------------
// Employee-facing training API (BRD Section 13)
// ---------------------------------------------------------------------

function handleTrainingsList(req, res) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  sendJson(res, 200, { trainings: trainingRepo.listOpenForEmployee() });
}

function handleMyTrainings(req, res) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  sendJson(res, 200, { trainings: trainingRepo.myTrainings(nationalId) });
}

function handleTrainingRegister(req, res, parsedUrl) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  const id = parsedUrl.searchParams.get('id') || '';
  const result = trainingRepo.register(id, nationalId);
  sendJson(res, result.ok ? 200 : 400, result);
}

function handleTrainingCancel(req, res, parsedUrl) {
  const nationalId = requireSession(req, res);
  if (!nationalId) return;
  const id = parsedUrl.searchParams.get('id') || '';
  const result = trainingRepo.cancelRegistration(id, nationalId);
  sendJson(res, result.ok ? 200 : 400, result);
}

// ---------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------

function getAdminCookie(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    cookies[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return cookies[adminAuth.COOKIE_NAME];
}

/** Returns the logged-in admin's username, or null (after sending a 401). */
function requireAdmin(req, res) {
  const token = getAdminCookie(req);
  const username = adminAuth.resolveSession(token);
  if (!username) {
    sendJson(res, 401, { error: 'admin_auth_required' });
    return null;
  }
  return username;
}

function adminCookieHeader(token) {
  const parts = [`${adminAuth.COOKIE_NAME}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (config.https.enabled) parts.push('Secure');
  return parts.join('; ');
}

function adminClearCookieHeader() {
  const parts = [`${adminAuth.COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (config.https.enabled) parts.push('Secure');
  return parts.join('; ');
}

async function handleAdminLogin(req, res) {
  const ip = sourceIp(req);
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'bad_request' });
  }
  const username = String(body.username || '').trim();

  if (lockout.checkAdminLockout(username, ip)) {
    return sendJson(res, 429, { error: 'locked_out' });
  }

  if (!adminAuth.verifyCredentials(username, body.password)) {
    lockout.recordAdminFailedAttempt(username, ip);
    return sendJson(res, 401, { error: 'invalid_credentials' });
  }

  lockout.clearAdminAttempts(username, ip);
  const token = adminAuth.issueToken(username);
  res.setHeader('Set-Cookie', adminCookieHeader(token));
  sendJson(res, 200, { ok: true });
}

function handleAdminLogout(req, res) {
  const token = getAdminCookie(req);
  adminAuth.revokeToken(token);
  res.setHeader('Set-Cookie', adminClearCookieHeader());
  sendJson(res, 200, { ok: true });
}

function handleAdminEmployeesList(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, employeeRepo.listAll());
}

async function handleAdminImportXlsx(req, res) {
  if (!requireAdmin(req, res)) return;
  let buffer;
  try {
    buffer = await readBinaryBody(req, 20 * 1024 * 1024); // 20MB cap
  } catch {
    return sendJson(res, 400, { error: 'bad_request' });
  }
  try {
    const result = importEmployeesXlsx(buffer);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

function handleAdminEmployeeDelete(req, res, parsedUrl) {
  if (!requireAdmin(req, res)) return;
  const nationalId = parsedUrl.searchParams.get('id') || '';
  const removed = employeeRepo.removeById(nationalId);
  sendJson(res, 200, { removed });
}

function handleAdminEmployeesClear(req, res) {
  if (!requireAdmin(req, res)) return;
  const removed = employeeRepo.removeAll();
  sendJson(res, 200, { removed });
}

function handleAdminAudit(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, audit.recentEntries(200));
}

// ---------------------------------------------------------------------
// Admin training API (BRD Section 13) -- reuses the same admin account
// system as employee-data management (Section 5.4); see README for why.
// ---------------------------------------------------------------------

function handleAdminTrainingsList(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { trainings: trainingRepo.listAllForAdmin() });
}

async function handleAdminTrainingCreate(req, res) {
  const username = requireAdmin(req, res);
  if (!username) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'bad_request' });
  }
  const titleAr = String(body.titleAr || '').trim();
  const titleEn = String(body.titleEn || '').trim();
  const deadline = String(body.deadline || '').trim();
  if (!titleAr || !titleEn || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return sendJson(res, 400, { error: 'invalid_input' });
  }
  const training = trainingRepo.create({
    titleAr, titleEn,
    descAr: body.descAr ? String(body.descAr).trim() : null,
    descEn: body.descEn ? String(body.descEn).trim() : null,
    deadline,
    createdBy: username,
  });
  sendJson(res, 200, { training });
}

function handleAdminTrainingRegistrants(req, res, parsedUrl) {
  if (!requireAdmin(req, res)) return;
  const id = parsedUrl.searchParams.get('id') || '';
  const training = trainingRepo.getById(id);
  if (!training) return sendJson(res, 404, { error: 'not_found' });
  sendJson(res, 200, { training, registrants: trainingRepo.listRegistrants(id) });
}

async function handleAdminTrainingAttendance(req, res, parsedUrl) {
  const username = requireAdmin(req, res);
  if (!username) return;
  const id = parsedUrl.searchParams.get('id') || '';
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'bad_request' });
  }
  const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
  const result = trainingRepo.setOutcomes(id, outcomes, username);
  sendJson(res, result.ok ? 200 : 400, result);
}

function handleAdminTrainingCancel(req, res, parsedUrl) {
  if (!requireAdmin(req, res)) return;
  const id = parsedUrl.searchParams.get('id') || '';
  const result = trainingRepo.cancelTraining(id);
  sendJson(res, result.ok ? 200 : 400, result);
}

// ---------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------

async function router(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const p = parsedUrl.pathname;
  const method = req.method;

  try {
    if (method === 'GET' && p === '/') return void serveStatic(req, res, '/login.html');
    if (method === 'GET' && p === '/landing') return void serveStatic(req, res, '/landing.html');
    if (method === 'GET' && p === '/admin') return void serveStatic(req, res, '/admin.html');
    if (method === 'GET' && ['/style.css', '/i18n.js', '/login.js', '/landing.js', '/admin.js', '/emblem.svg', '/emblem-full.png'].includes(p)) {
      return void serveStatic(req, res, p);
    }

    if (method === 'POST' && p === '/api/login') return await handleLogin(req, res);
    if (method === 'GET' && p === '/api/me') return handleMe(req, res);
    if (method === 'GET' && p === '/api/certificates') return handleCertificates(req, res);
    if (method === 'GET' && p === '/api/download') return handleDownload(req, res, parsedUrl);
    if (method === 'POST' && p === '/api/logout') return handleLogout(req, res);

    if (method === 'GET' && p === '/api/trainings') return handleTrainingsList(req, res);
    if (method === 'GET' && p === '/api/my-trainings') return handleMyTrainings(req, res);
    if (method === 'POST' && p === '/api/trainings/register') return handleTrainingRegister(req, res, parsedUrl);
    if (method === 'POST' && p === '/api/trainings/cancel') return handleTrainingCancel(req, res, parsedUrl);

    if (method === 'POST' && p === '/admin/login') return await handleAdminLogin(req, res);
    if (method === 'POST' && p === '/admin/logout') return handleAdminLogout(req, res);
    if (method === 'GET' && p === '/admin/api/employees') return handleAdminEmployeesList(req, res);
    if (method === 'POST' && p === '/admin/api/employees/import') return await handleAdminImportXlsx(req, res);
    if (method === 'DELETE' && p === '/admin/api/employees') return handleAdminEmployeeDelete(req, res, parsedUrl);
    if (method === 'POST' && p === '/admin/api/employees/clear') return handleAdminEmployeesClear(req, res);
    if (method === 'GET' && p === '/admin/api/audit') return handleAdminAudit(req, res);

    if (method === 'GET' && p === '/admin/api/trainings') return handleAdminTrainingsList(req, res);
    if (method === 'POST' && p === '/admin/api/trainings') return await handleAdminTrainingCreate(req, res);
    if (method === 'GET' && p === '/admin/api/trainings/registrants') return handleAdminTrainingRegistrants(req, res, parsedUrl);
    if (method === 'POST' && p === '/admin/api/trainings/attendance') return await handleAdminTrainingAttendance(req, res, parsedUrl);
    if (method === 'POST' && p === '/admin/api/trainings/cancel') return handleAdminTrainingCancel(req, res, parsedUrl);

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'internal_error' });
  }
}

function start() {
  const server = config.https.enabled
    ? https.createServer({
        cert: fs.readFileSync(config.https.certPath),
        key: fs.readFileSync(config.https.keyPath),
      }, router)
    : http.createServer(router);

  server.listen(config.port, config.bindHost, () => {
    console.log(`Certificate Portal listening on ${config.https.enabled ? 'https' : 'http'}://${config.bindHost}:${config.port}`);
    console.log(`Shared folder: ${config.sharedFolderPath}`);
    console.log(`Employees loaded: ${employeeRepo.count()}`);
  });

  return server;
}

module.exports = { start };
