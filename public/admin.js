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

let ACTIVE_SECTION = 'employees';
let CURRENT_SEARCH = '';

function showSection(name) {
  ACTIVE_SECTION = name;
  CURRENT_SEARCH = '';
  el('adminSearch').value = '';
  ['employees', 'trainings', 'audit'].forEach((n) => {
    el(`scr-${n}`).classList.toggle('hidden', n !== name);
    el(`nav${n.charAt(0).toUpperCase()}${n.slice(1)}`).classList.toggle('on', n === name);
  });
  if (name === 'employees') renderEmployeesFiltered();
  if (name === 'trainings') renderTrainingsFiltered();
  if (name === 'audit') renderAudit();
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

const EMP_PAGER = createPaginator({ containerId: 'empPager', pageSize: 10, renderPage: renderEmployeesPage });
let LAST_EMPLOYEES = [];

async function loadEmployees() {
  const resp = await api('/admin/api/employees');
  if (!resp.ok) return;
  LAST_EMPLOYEES = await resp.json();
  renderEmployeesFiltered();
}

function renderEmployeesFiltered() {
  const q = ACTIVE_SECTION === 'employees' ? CURRENT_SEARCH : '';
  const filtered = q
    ? LAST_EMPLOYEES.filter((r) => `${r.national_id} ${r.mobile_e164}`.toLowerCase().includes(q))
    : LAST_EMPLOYEES;

  const emptyNote = el('empEmptyNote');
  if (!filtered.length) {
    document.querySelector('#empTable tbody').innerHTML = '';
    el('empPager').classList.add('hidden');
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');
  EMP_PAGER.setItems(filtered);
}

function renderEmployeesPage(pageItems) {
  const tbody = document.querySelector('#empTable tbody');
  tbody.innerHTML = pageItems.map((r) => `
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

const TRAININGS_PAGER = createPaginator({ containerId: 'trainingsPager', pageSize: 8, renderPage: renderTrainingsPage });
let LAST_TRAININGS = [];

async function loadTrainings() {
  const resp = await api('/admin/api/trainings');
  if (!resp.ok) return;
  const data = await resp.json();
  LAST_TRAININGS = data.trainings || [];
  renderTrainingsFiltered();
}

function renderTrainingsFiltered() {
  const q = ACTIVE_SECTION === 'trainings' ? CURRENT_SEARCH : '';
  const filtered = q
    ? LAST_TRAININGS.filter((tr) => `${tr.id} ${tr.title_en} ${tr.title_ar}`.toLowerCase().includes(q))
    : LAST_TRAININGS;

  const emptyNote = el('trainingsEmptyNote');
  if (!filtered.length) {
    document.querySelector('#trainingsTable tbody').innerHTML = '';
    el('trainingsPager').classList.add('hidden');
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');
  TRAININGS_PAGER.setItems(filtered);
}

function renderTrainingsPage(pageItems) {
  const tbody = document.querySelector('#trainingsTable tbody');
  const lang = getLang();
  tbody.innerHTML = pageItems.map((tr) => `
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

const ROSTER_PAGER = createPaginator({ containerId: 'rosterPager', pageSize: 10, renderPage: renderRosterPage });

function renderRoster(registrants) {
  const emptyNote = el('rosterEmptyNote');
  if (!registrants.length) {
    document.querySelector('#rosterTable tbody').innerHTML = '';
    el('rosterPager').classList.add('hidden');
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');
  ROSTER_PAGER.setItems(registrants);
}

function renderRosterPage(pageItems) {
  const tbody = document.querySelector('#rosterTable tbody');
  tbody.innerHTML = pageItems.map((r) => {
    const outcome = ROSTER_OUTCOMES[r.national_id] || '';
    return `
    <tr>
      <td>${r.national_id}</td>
      <td>${r.mobile_e164 || ''}</td>
      <td>${r.registered_at}</td>
      <td><div class="seg">
        <button class="${outcome === 'attended' ? 'on a' : ''}" data-id="${r.national_id}" data-outcome="attended">${at('attended')}</button>
        <button class="${outcome === 'absent' ? 'on d' : ''}" data-id="${r.national_id}" data-outcome="absent">${at('absent')}</button>
      </div></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-outcome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const outcome = btn.getAttribute('data-outcome');
      ROSTER_OUTCOMES[btn.getAttribute('data-id')] = outcome;
      // Update just this row's buttons in place -- re-rendering the page
      // through the paginator would reset it back to page 1.
      const seg = btn.closest('.seg');
      const attendedBtn = seg.querySelector('[data-outcome="attended"]');
      const absentBtn = seg.querySelector('[data-outcome="absent"]');
      attendedBtn.className = outcome === 'attended' ? 'on a' : '';
      absentBtn.className = outcome === 'absent' ? 'on d' : '';
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
const AUDIT_PAGER = createPaginator({ containerId: 'auditPager', pageSize: 10, renderPage: renderAuditPage });

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

  let filtered = LAST_AUDIT.filter((r) => wantDownloads
    ? r.event_type === 'download'
    : LOGIN_EVENT_TYPES.includes(r.event_type));

  const q = ACTIVE_SECTION === 'audit' ? CURRENT_SEARCH : '';
  if (q) {
    filtered = filtered.filter((r) => `${r.ts} ${eventLabel(r.event_type)} ${r.national_id_last4 || ''} ${r.file_ref || ''} ${r.source_ip || ''} ${r.detail || ''}`.toLowerCase().includes(q));
  }

  if (!filtered.length) {
    table.querySelector('tbody').innerHTML = '';
    el('auditPager').classList.add('hidden');
    emptyNote.textContent = wantDownloads ? at('noDownloads') : at('noLogins');
    emptyNote.classList.remove('hidden');
    return;
  }
  emptyNote.classList.add('hidden');
  AUDIT_PAGER.setItems(filtered);
}

function renderAuditPage(pageItems) {
  const tbody = el('auditTable').querySelector('tbody');
  tbody.innerHTML = pageItems.map((r) => `<tr>
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
// Header search -- filters the full dataset behind whichever section is
// currently open, then re-paginates from page 1 (not just the rows on
// the currently rendered page).
// ---------------------------------------------------------------------

function handleSearchInput(query) {
  CURRENT_SEARCH = query.trim().toLowerCase();
  if (ACTIVE_SECTION === 'employees') renderEmployeesFiltered();
  if (ACTIVE_SECTION === 'trainings') renderTrainingsFiltered();
  if (ACTIVE_SECTION === 'audit') renderAudit();
}

function onLangChanged() {
  const label = el('loginLangLabel');
  if (label) label.textContent = getLang() === 'ar' ? 'English' : 'العربية';
  renderLoginTicker();
  if (!el('adminApp').classList.contains('hidden')) {
    renderEmployeesFiltered();
    renderTrainingsFiltered();
    if (!el('rosterCard').classList.contains('hidden')) {
      renderRosterHeader();
      renderRoster(ROSTER_REGISTRANTS);
    }
    renderAudit();
  }
  if (typeof window.sidebarToggleSync === 'function') window.sidebarToggleSync();
}

document.addEventListener('DOMContentLoaded', () => {
  applyStaticLang();
  initSidebarToggle();
  onLangChanged();
  el('loginLangBtn').addEventListener('click', toggleLang);
  el('langBtn').addEventListener('click', toggleLang);

  function positionToolMenu(menu, anchorBtn) {
    const rect = anchorBtn.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const margin = 12;
    let left = rect.right - menuWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${rect.bottom + 10}px`;
  }
  el('appearanceBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = el('appearanceMenu');
    if (menu.classList.contains('open')) {
      menu.classList.remove('open');
    } else {
      positionToolMenu(menu, e.currentTarget);
      menu.classList.add('open');
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#appearanceBtn') && !e.target.closest('#appearanceMenu')) {
      el('appearanceMenu').classList.remove('open');
    }
  });
  window.addEventListener('resize', () => el('appearanceMenu').classList.remove('open'));
  const darkToggle = el('darkModeToggle');
  const cbToggle = el('colorblindToggle');
  darkToggle.checked = getTheme() === 'dark';
  cbToggle.checked = getColorblind();
  darkToggle.addEventListener('change', () => setTheme(darkToggle.checked ? 'dark' : 'light'));
  cbToggle.addEventListener('change', () => setColorblind(cbToggle.checked));

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
  el('adminSearch').addEventListener('input', (e) => handleSearchInput(e.target.value));

  checkAuth();
});
