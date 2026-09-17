'use strict';

function el(id) { return document.getElementById(id); }

async function api(path, opts) {
  const resp = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts));
  return resp;
}

// ---------------------------------------------------------------------
// Bilingual strings for text generated in JS (static markup uses
// data-ar/data-en directly, handled by i18n.js's applyStaticLang()).
// ---------------------------------------------------------------------

const ADMIN_STRINGS = {
  en: {
    statusOpen: 'Open', statusClosed: 'Closed', statusConducted: 'Conducted', statusCancelled: 'Cancelled',
    view: 'View', markAttendance: 'Mark attendance',
    attended: 'Attended', absent: 'Absent',
    remove: 'Remove',
    tooManyAttempts: 'Too many failed attempts. Try again later.',
    invalidCredentials: 'Invalid username or password.',
    confirmRemoveEmployee: (id) => `Remove employee ${id}? They will no longer be able to sign in.`,
    confirmRemoveAll: 'Remove ALL employees from the system? This cannot be undone — you will need to re-import the sheet.',
    removedCount: (n) => `Removed ${n} employee(s).`,
    importing: 'Importing…',
    importedCount: (n, skipped, firstIssue) => `Imported ${n} record(s). Skipped ${skipped}.` + (firstIssue ? ` First issue: ${firstIssue}` : ''),
    importFailed: 'Import failed.',
    titleRequired: 'Title (both languages) and a deadline are required.',
    created: (id) => `Created ${id}.`,
    createFailed: 'Could not create training.',
    eventLoginSuccess: 'Login succeeded', eventLoginFailure: 'Login failed',
    eventLockout: 'Locked out', eventDownload: 'Certificate download',
    noLogins: 'No login attempts recorded yet.',
    noDownloads: 'No certificate downloads recorded yet.',
  },
  ar: {
    statusOpen: 'مفتوح', statusClosed: 'مُغلق', statusConducted: 'مُنعقد', statusCancelled: 'مُلغى',
    view: 'عرض', markAttendance: 'تسجيل الحضور',
    attended: 'حضر', absent: 'لم يحضر',
    remove: 'إزالة',
    tooManyAttempts: 'محاولات فاشلة كثيرة. حاول مرة أخرى لاحقًا.',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    confirmRemoveEmployee: (id) => `إزالة الموظف ${id}؟ لن يتمكن بعدها من تسجيل الدخول.`,
    confirmRemoveAll: 'إزالة جميع الموظفين من النظام؟ لا يمكن التراجع عن هذا — ستحتاج لإعادة استيراد الملف.',
    removedCount: (n) => `تمت إزالة ${n} موظف(ين).`,
    importing: 'جارٍ الاستيراد…',
    importedCount: (n, skipped, firstIssue) => `تم استيراد ${n} سجل(ات). تم تخطي ${skipped}.` + (firstIssue ? ` أول مشكلة: ${firstIssue}` : ''),
    importFailed: 'فشل الاستيراد.',
    titleRequired: 'العنوان بكلا اللغتين وآخر أجل مطلوبان.',
    created: (id) => `تم إنشاء ${id}.`,
    createFailed: 'تعذّر إنشاء التدريب.',
    eventLoginSuccess: 'دخول ناجح', eventLoginFailure: 'دخول فاشل',
    eventLockout: 'تم القفل', eventDownload: 'تنزيل شهادة',
    noLogins: 'لا توجد محاولات دخول مسجَّلة بعد.',
    noDownloads: 'لا توجد تنزيلات شهادات مسجَّلة بعد.',
  },
};

function at(key) {
  return ADMIN_STRINGS[getLang()][key];
}

function showLoggedOut() {
  el('loginPanel').classList.remove('hidden');
  el('adminApp').classList.add('hidden');
}

function showLoggedIn(username) {
  el('loginPanel').classList.add('hidden');
  el('adminApp').classList.remove('hidden');
  el('adminUserLabel').textContent = username || 'Admin';
}

async function checkAuth() {
  const resp = await api('/admin/api/audit');
  if (resp.ok) {
    showLoggedIn(el('user').value || 'Admin');
    renderAudit(await resp.json());
    loadEmployees();
    loadTrainings();
  } else {
    showLoggedOut();
  }
}

async function login() {
  const username = el('user').value;
  const password = el('pass').value;
  const msg = el('loginMsg');
  msg.textContent = '';
  const resp = await api('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (resp.ok) {
    el('pass').value = '';
    checkAuth();
  } else if (resp.status === 429) {
    msg.textContent = at('tooManyAttempts');
  } else {
    msg.textContent = at('invalidCredentials');
  }
}

// ---------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------

function showSection(name) {
  ['employees', 'trainings', 'audit'].forEach((n) => {
    el(`scr-${n}`).classList.toggle('hidden', n !== name);
    el(`nav${n.charAt(0).toUpperCase()}${n.slice(1)}`).classList.toggle('on', n === name);
  });
  el('adminSearch').value = '';
}

// ---------------------------------------------------------------------
// Sign-in screen policy ticker (BRD 13.6)
// ---------------------------------------------------------------------

const POLICY_STATEMENTS = {
  en: [
    'The government entity is committed to the continuous development and training of its human resources, and to nurturing outstanding competencies and talents.',
    "The government entity shall seek to provide its human resources with suitable development and training opportunities to build and strengthen their knowledge, skills, and abilities in their current roles, and to prepare them for future roles that support the government entity's strategy and objectives.",
    'The government entity shall ensure its employees have full dedicated time for all forms of development and training in programs whose nature requires it.',
    "Job development and training activities are directly linked to the government entity's strategic objectives.",
  ],
  ar: [
    'تلتزم الجهة الحكومية بتطوير وتدريب مواردها البشرية بصفة مستمرة والعناية بذوي الكفاءات والمواهب المتميزة.',
    'على الجهة الحكومية السعي إلى منح مواردها البشرية فرصاً ملائمة للتطوير والتدريب لتنمية وتعزيز معارفهم ومهاراتهم وقدراتهم في وظائفهم الحالية ولتمكينهم من تولي أدوار مستقبلية تدعم استراتيجية وأهداف الجهة الحكومية.',
    'على الجهة الحكومية أن تكفل لموظفيها التفرغ التام لكل أشكال التطوير والتدريب في البرامج التي تقتضي طبيعتها ذلك.',
    'يرتبط نشاط التطوير والتدريب الوظيفي ارتباطاً مباشراً بالأهداف الاستراتيجية للجهة الحكومية.',
  ],
};

function renderLoginTicker() {
  const track = el('loginTicker');
  const items = POLICY_STATEMENTS[getLang()].map((s) => `<span class="login-ticker-item">${s}</span><span class="ticker-palm-wrap"><span class="ticker-palm-dot"></span></span>`).join('');
  track.innerHTML = items + items; // duplicated once for a seamless loop
}

async function logout() {
  await api('/admin/logout', { method: 'POST' });
  showLoggedOut();
}

async function loadEmployees() {
  const resp = await api('/admin/api/employees');
  if (!resp.ok) return;
  const rows = await resp.json();
  const tbody = document.querySelector('#empTable tbody');
  const emptyNote = el('empEmptyNote');

  if (!rows.length) {
    tbody.innerHTML = '';
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${r.national_id}</td>
      <td dir="ltr">${r.mobile_e164}</td>
      <td>${r.updated_at}</td>
      <td><button class="rowbtn" data-id="${r.national_id}">${at('remove')}</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.rowbtn').forEach((btn) => {
    btn.addEventListener('click', () => removeEmployee(btn.getAttribute('data-id')));
  });
}

async function removeEmployee(nationalId) {
  if (!confirm(at('confirmRemoveEmployee')(nationalId))) return;
  await api(`/admin/api/employees?id=${encodeURIComponent(nationalId)}`, { method: 'DELETE' });
  loadEmployees();
}

async function clearAllEmployees() {
  if (!confirm(at('confirmRemoveAll'))) return;
  const resp = await api('/admin/api/employees/clear', { method: 'POST' });
  const data = await resp.json();
  el('importMsg').className = 'msg ok';
  el('importMsg').textContent = at('removedCount')(data.removed);
  loadEmployees();
}

async function importXlsx(file) {
  const msg = el('importMsg');
  msg.className = 'msg';
  msg.textContent = at('importing');
  const buffer = await file.arrayBuffer();
  const resp = await api('/admin/api/employees/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  const data = await resp.json();
  if (resp.ok) {
    msg.className = 'msg ok';
    const firstIssue = data.skipped.length ? `row ${data.skipped[0].row} — ${data.skipped[0].reason}` : '';
    msg.textContent = at('importedCount')(data.imported, data.skipped.length, firstIssue);
    loadEmployees();
  } else {
    msg.className = 'msg err';
    msg.textContent = data.error || at('importFailed');
  }
}

// ---------------------------------------------------------------------
// Trainings
// ---------------------------------------------------------------------

function statusBadge(status) {
  const key = { open: 'statusOpen', closed: 'statusClosed', conducted: 'statusConducted', cancelled: 'statusCancelled' }[status];
  return `<span class="badge ${status}">${key ? at(key) : status}</span>`;
}

let LAST_TRAININGS = [];

async function loadTrainings() {
  const resp = await api('/admin/api/trainings');
  if (!resp.ok) return;
  const data = await resp.json();
  LAST_TRAININGS = data.trainings || [];
  renderTrainingsTable();
}

function renderTrainingsTable() {
  const rows = LAST_TRAININGS;
  const tbody = document.querySelector('#trainingsTable tbody');
  const emptyNote = el('trainingsEmptyNote');

  if (!rows.length) {
    tbody.innerHTML = '';
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');

  const lang = getLang();
  tbody.innerHTML = rows.map((tr) => `
    <tr>
      <td><span class="idpill">${tr.id}</span></td>
      <td>${lang === 'ar' ? tr.title_ar : tr.title_en}</td>
      <td>${tr.deadline}</td>
      <td>${statusBadge(tr.effectiveStatus)}</td>
      <td>${tr.registrantCount}</td>
      <td><button class="ghost-btn" data-roster="${tr.id}">${tr.effectiveStatus === 'closed' ? at('markAttendance') : at('view')}</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-roster]').forEach((btn) => {
    btn.addEventListener('click', () => openRoster(btn.getAttribute('data-roster')));
  });
}

async function saveTraining() {
  const titleEn = el('ntTitleEn').value.trim();
  const titleAr = el('ntTitleAr').value.trim();
  const deadline = el('ntDeadline').value;
  const msg = el('trainingMsg');
  if (!titleEn || !titleAr || !deadline) {
    msg.className = 'msg err';
    msg.textContent = at('titleRequired');
    return;
  }
  const resp = await api('/admin/api/trainings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titleEn, titleAr, deadline }),
  });
  const data = await resp.json();
  if (resp.ok) {
    msg.className = 'msg ok';
    msg.textContent = at('created')(data.training.id);
    el('ntTitleEn').value = '';
    el('ntTitleAr').value = '';
    el('ntDeadline').value = '';
    loadTrainings();
  } else {
    msg.className = 'msg err';
    msg.textContent = data.error || at('createFailed');
  }
}

let ROSTER_TRAINING_ID = null;
let ROSTER_TRAINING = null;
let ROSTER_OUTCOMES = {}; // nationalId -> 'attended' | 'absent'
let ROSTER_REGISTRANTS = [];

async function openRoster(trainingId) {
  const resp = await api(`/admin/api/trainings/registrants?id=${encodeURIComponent(trainingId)}`);
  if (!resp.ok) return;
  const data = await resp.json();
  ROSTER_TRAINING_ID = trainingId;
  ROSTER_TRAINING = data.training;
  ROSTER_OUTCOMES = {};
  ROSTER_REGISTRANTS = data.registrants;
  data.registrants.forEach((r) => { if (r.outcome) ROSTER_OUTCOMES[r.national_id] = r.outcome; });

  renderRosterHeader();
  el('rosterCard').classList.remove('hidden');
  renderRoster(ROSTER_REGISTRANTS);
  el('rosterCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRosterHeader() {
  if (!ROSTER_TRAINING) return;
  el('rosterTitle').textContent = getLang() === 'ar' ? ROSTER_TRAINING.title_ar : ROSTER_TRAINING.title_en;
  el('rosterId').textContent = ROSTER_TRAINING_ID;
}

function renderRoster(registrants) {
  const tbody = document.querySelector('#rosterTable tbody');
  const emptyNote = el('rosterEmptyNote');
  if (!registrants.length) {
    tbody.innerHTML = '';
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');

  tbody.innerHTML = registrants.map((r) => {
    const outcome = ROSTER_OUTCOMES[r.national_id] || '';
    return `
    <tr>
      <td>${r.national_id}</td>
      <td>${r.mobile_e164 || ''}</td>
      <td>${r.registered_at}</td>
      <td><div class="seg">
        <button class="${outcome === 'attended' ? 'a' : ''}" data-id="${r.national_id}" data-outcome="attended">${at('attended')}</button>
        <button class="${outcome === 'absent' ? 'd' : ''}" data-id="${r.national_id}" data-outcome="absent">${at('absent')}</button>
      </div></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ROSTER_OUTCOMES[btn.getAttribute('data-id')] = btn.getAttribute('data-outcome');
      renderRoster(registrants);
    });
  });
}

function markAllAttended() {
  ROSTER_REGISTRANTS.forEach((r) => { ROSTER_OUTCOMES[r.national_id] = 'attended'; });
  renderRoster(ROSTER_REGISTRANTS);
}

async function saveOutcomes() {
  const outcomes = Object.entries(ROSTER_OUTCOMES).map(([nationalId, outcome]) => ({ nationalId, outcome }));
  if (!outcomes.length) return;
  await api(`/admin/api/trainings/attendance?id=${encodeURIComponent(ROSTER_TRAINING_ID)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcomes }),
  });
  el('rosterCard').classList.add('hidden');
  loadTrainings();
}

const LOGIN_EVENT_TYPES = ['login_success', 'login_failure', 'lockout'];

let LAST_AUDIT = [];
let ACTIVE_AUDIT_TAB = 'logins';

function eventLabel(eventType) {
  const key = {
    login_success: 'eventLoginSuccess', login_failure: 'eventLoginFailure',
    lockout: 'eventLockout', download: 'eventDownload',
  }[eventType];
  return key ? at(key) : eventType;
}

function renderAudit(rows) {
  if (rows) LAST_AUDIT = rows;
  const table = el('auditTable');
  const emptyNote = el('auditEmptyNote');
  const wantDownloads = ACTIVE_AUDIT_TAB === 'downloads';
  table.classList.toggle('audit-hide-file', !wantDownloads);

  const filtered = LAST_AUDIT.filter((r) => wantDownloads
    ? r.event_type === 'download'
    : LOGIN_EVENT_TYPES.includes(r.event_type));

  const tbody = table.querySelector('tbody');
  if (!filtered.length) {
    tbody.innerHTML = '';
    emptyNote.textContent = wantDownloads ? at('noDownloads') : at('noLogins');
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');

  tbody.innerHTML = filtered.map((r) => `<tr>
    <td>${r.ts}</td><td>${eventLabel(r.event_type)}</td><td>${r.national_id_last4 || ''}</td>
    <td class="audit-col-file">${r.file_ref || ''}</td><td>${r.source_ip || ''}</td><td>${r.detail || ''}</td>
  </tr>`).join('');
}

function setAuditTab(tab) {
  ACTIVE_AUDIT_TAB = tab;
  document.querySelectorAll('#auditTabs button').forEach((btn) => {
    btn.classList.toggle('on', btn.getAttribute('data-audit-tab') === tab);
  });
  renderAudit();
}

// ---------------------------------------------------------------------
// Header search -- filters the rows of whichever section is currently open
// ---------------------------------------------------------------------

function filterVisibleTable(query) {
  const q = query.trim().toLowerCase();
  const activeSection = document.querySelector('main.content-area > div:not(.hidden)');
  if (!activeSection) return;
  activeSection.querySelectorAll('table.plain tbody tr').forEach((tr) => {
    tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function onLangChanged() {
  const label = el('loginLangLabel');
  if (label) label.textContent = getLang() === 'ar' ? 'English' : 'العربية';
  renderLoginTicker();
  if (!el('adminApp').classList.contains('hidden')) {
    loadEmployees();
    renderTrainingsTable();
    if (!el('rosterCard').classList.contains('hidden')) {
      renderRosterHeader();
      renderRoster(ROSTER_REGISTRANTS);
    }
    renderAudit();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyStaticLang();
  onLangChanged();
  el('loginLangBtn').addEventListener('click', toggleLang);
  el('langBtn').addEventListener('click', toggleLang);
  el('adminLoginBtn').addEventListener('click', login);
  ['user', 'pass'].forEach((id) => {
    el(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  });
  el('logoutBtn').addEventListener('click', logout);
  el('pickFileBtn').addEventListener('click', () => el('xlsxFile').click());
  el('xlsxFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importXlsx(file);
  });
  el('clearAllBtn').addEventListener('click', clearAllEmployees);
  el('refreshLogBtn').addEventListener('click', async () => {
    const resp = await api('/admin/api/audit');
    if (resp.ok) renderAudit(await resp.json());
  });

  el('newTrainingBtn').addEventListener('click', () => {
    el('newTrainingForm').hidden = !el('newTrainingForm').hidden;
  });
  el('saveTrainingBtn').addEventListener('click', saveTraining);
  el('markAllAttendedBtn').addEventListener('click', markAllAttended);
  el('saveOutcomesBtn').addEventListener('click', saveOutcomes);

  el('navEmployees').addEventListener('click', () => showSection('employees'));
  el('navTrainings').addEventListener('click', () => showSection('trainings'));
  el('navAudit').addEventListener('click', () => showSection('audit'));
  document.querySelectorAll('#auditTabs button').forEach((btn) => {
    btn.addEventListener('click', () => setAuditTab(btn.getAttribute('data-audit-tab')));
  });
  el('adminSearch').addEventListener('input', (e) => filterVisibleTable(e.target.value));

  checkAuth();
});
