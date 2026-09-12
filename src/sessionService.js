'use strict';

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

const COOKIE_NAME = 'portal_session';
const timeoutMinutes = config.sessionTimeoutMinutes;

const insertStmt = db.prepare(`
  INSERT INTO sessions (token, national_id, source_ip) VALUES (?, ?, ?)
`);
const getStmt = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
const touchStmt = db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE token = ?`);
const deleteStmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);
const purgeStmt = db.prepare(`DELETE FROM sessions WHERE last_seen_at < datetime('now', ?)`);

function createSession(nationalId, sourceIp) {
  const token = crypto.randomBytes(32).toString('hex');
  insertStmt.run(token, nationalId, sourceIp);
  return token;
}

/**
 * Returns the employee's National ID for a valid, non-expired session token,
 * refreshing its sliding idle timeout. Returns null if missing/expired.
 */
function resolveSession(token) {
  if (!token) return null;
  purgeStmt.run(`-${timeoutMinutes} minutes`);
  const row = getStmt.get(token);
  if (!row) return null;
  touchStmt.run(token);
  return row.national_id;
}

function destroySession(token) {
  if (token) deleteStmt.run(token);
}

function cookieHeader(token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (config.https.enabled) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (config.https.enabled) parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(cookieHeaderValue) {
  const out = {};
  (cookieHeaderValue || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function getTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

module.exports = {
  COOKIE_NAME,
  createSession,
  resolveSession,
  destroySession,
  cookieHeader,
  clearCookieHeader,
  getTokenFromRequest,
};
