'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const config = require('./config');

const TEMPLATE_DIR = path.join(__dirname, 'certTemplate');
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, 'certificate.html');

/**
 * page.setContent() has no base URL (the frame stays at "about:blank"), so
 * the template's relative font/image paths never resolve -- inline
 * everything as data: URIs once at module load instead of depending on
 * file-path resolution at render time.
 */
function inlineLocalAssets(html) {
  html = html.replace(/url\("fonts\/([^"]+\.woff2)"\)/g, (m, file) => {
    const bytes = fs.readFileSync(path.join(TEMPLATE_DIR, 'fonts', file));
    return `url(data:font/woff2;base64,${bytes.toString('base64')})`;
  });
  html = html.replace(/src="images\/([^"]+\.png)"/g, (m, file) => {
    const bytes = fs.readFileSync(path.join(TEMPLATE_DIR, 'images', file));
    return `src="data:image/png;base64,${bytes.toString('base64')}"`;
  });
  return html;
}

const TEMPLATE_HTML = inlineLocalAssets(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];
const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Gregorian -> Hijri via the well-known Kuwaiti-algorithm arithmetic
 * approximation (no external library, no lookup table maintenance). It is
 * an approximation, not the Umm al-Qura calendar -- fine for a "date
 * printed on a certificate" use case, not for religious observance.
 */
function gregorianToHijri(date) {
  const jd = Math.floor(
    (1461 * (date.getFullYear() + 4800 + Math.floor((date.getMonth() + 1 - 14) / 12))) / 4 +
    (367 * (date.getMonth() + 1 - 2 - 12 * Math.floor((date.getMonth() + 1 - 14) / 12))) / 12 -
    (3 * Math.floor((date.getFullYear() + 4900 + Math.floor((date.getMonth() + 1 - 14) / 12)) / 100)) / 4 +
    date.getDate() - 32075
  );
  const l1 = jd - 1948440 + 10632;
  const n = Math.floor((l1 - 1) / 10631);
  const l2 = l1 - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIssueDateLine(date) {
  const g = { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
  const h = gregorianToHijri(date);
  const pad2 = (n) => String(n).padStart(2, '0');
  const ar = `صدرت بتاريخ ${pad2(h.day)}/${pad2(h.month)}/${h.year} هـ • الموافق ${pad2(g.day)}/${pad2(g.month + 1)}/${g.year} م`;
  const en = `Issued on ${pad2(g.day)}/${pad2(g.month + 1)}/${g.year} AD • ${pad2(h.day)}/${pad2(h.month)}/${h.year} AH`;
  return { ar, en };
}

/**
 * Fills the bilingual certificate template with the given data. All
 * user/admin-sourced values are HTML-escaped before insertion even though
 * they come from authenticated admin input, not public submissions --
 * defense in depth against a malicious sheet import corrupting the
 * rendered PDF's markup.
 */
function renderHtml({ employeeName, department, trainingTitleAr, trainingTitleEn, issuedAt }) {
  const dateLine = buildIssueDateLine(issuedAt || new Date());
  const name = escapeHtml(employeeName || '');
  const dept = escapeHtml(department || '');

  // The template is one bilingual document (AR page, then EN page) built
  // from the two sections in one pass, so the two languages' placeholders
  // are distinguished only by which page they land on -- both share the
  // same {{...}} token names, so replace per-page rather than globally.
  const [arPage, enPage] = TEMPLATE_HTML.split('<div class="cert-page" lang="en"');
  const filledAr = arPage
    .replace(/\{\{TRAINING_TITLE\}\}/g, escapeHtml(trainingTitleAr || ''))
    .replace(/\{\{EMPLOYEE_NAME\}\}/g, name)
    .replace(/\{\{DEPARTMENT\}\}/g, dept)
    .replace(/\{\{ISSUE_DATE_LINE\}\}/g, dateLine.ar);
  const filledEn = ('<div class="cert-page" lang="en"' + enPage)
    .replace(/\{\{TRAINING_TITLE\}\}/g, escapeHtml(trainingTitleEn || ''))
    .replace(/\{\{EMPLOYEE_NAME\}\}/g, name)
    .replace(/\{\{DEPARTMENT\}\}/g, dept)
    .replace(/\{\{ISSUE_DATE_LINE\}\}/g, dateLine.en);

  return filledAr + filledEn;
}

/** Common install locations for a Chromium-based browser on Windows. */
function findBrowserExecutable() {
  if (config.certGeneration && config.certGeneration.browserExecutablePath) {
    return config.certGeneration.browserExecutablePath;
  }
  const candidates = os.platform() === 'win32'
    ? [
        `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env['ProgramFiles']}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) {
    throw new Error(
      'No Chromium-based browser found for certificate generation. Install Microsoft Edge or Google ' +
      'Chrome, or set certGeneration.browserExecutablePath in config.json.'
    );
  }
  return found;
}

/**
 * Renders one training certificate PDF for one employee and writes it into
 * the shared certificate folder, using the app's own naming convention
 * ({ID}-{TrainingID}.ext) so certService's existing ownership/download
 * checks keep working unchanged.
 */
async function generateCertificatePdf(browser, { nationalId, employeeName, department, trainingId, trainingTitleAr, trainingTitleEn, issuedAt }) {
  const html = renderHtml({ employeeName, department, trainingTitleAr, trainingTitleEn, issuedAt });
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      width: '297mm',
      height: '210mm',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const fileName = `${nationalId}-${trainingId}.pdf`;
    const fullPath = path.join(config.sharedFolderPath, fileName);
    fs.mkdirSync(config.sharedFolderPath, { recursive: true });
    fs.writeFileSync(fullPath, pdfBuffer);
    return fileName;
  } finally {
    await page.close();
  }
}

/**
 * Generates certificates for every newly-Attended employee in one
 * attendance-marking action. Launches a single browser for the whole
 * batch rather than one per employee.
 */
async function generateCertificatesForAttendees(training, attendees) {
  if (attendees.length === 0) return [];
  const puppeteer = require('puppeteer-core');
  // Running as a Windows Service means no interactive desktop/window
  // station (Session 0 isolation) -- Chromium's sandbox requires one and
  // fails to launch at all without --no-sandbox. A dedicated, writable
  // profile directory inside the app's own tree avoids relying on the
  // service account having a normal user profile to create one in.
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: true,
    userDataDir: path.join(__dirname, '..', '.puppeteer-profile'),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    const issuedAt = new Date();
    const results = [];
    for (const emp of attendees) {
      const fileName = await generateCertificatePdf(browser, {
        nationalId: emp.nationalId,
        employeeName: emp.name,
        department: emp.department,
        trainingId: training.id,
        trainingTitleAr: training.title_ar,
        trainingTitleEn: training.title_en,
        issuedAt,
      });
      results.push({ nationalId: emp.nationalId, fileName });
    }
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { generateCertificatesForAttendees, renderHtml, gregorianToHijri };
