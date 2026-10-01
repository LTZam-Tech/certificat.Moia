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
    saveOutcomesFailed: 'Could not save outcomes. Please try again.',
    certGenerationFailed: (msg) => `Outcomes were saved, but certificate generation failed: ${msg}`,
    dashConductedOn: (d) => `Conducted ${d}`,
    dashDeadline: (d) => `Deadline ${d}`,
    dashRegistrants: (n) => `${n} registrant${n === 1 ? '' : 's'}`,
    daysLeft: 'days left',
    awaitingOutcome: 'Awaiting outcome',
    legendRegistrations: 'Registrations',
    legendAttended: 'Attendance recorded',
    noAttendanceYet: 'No attendance recorded yet',
    attendanceRatePct: (p) => `${p}% attendance rate`,
    nextTrainingOn: (title, date) => `Next: ${title} · ${date}`,
    noUpcomingTrainings: 'No upcoming trainings',
    departmentsCount: (n) => `${n} department${n === 1 ? '' : 's'} tracked`,
    noDepartmentData: 'No department data yet',
    outcomeBreakdown: (a, ab, aw) => `Attended ${a} · Absent ${ab} · Awaiting ${aw}`,
    recentAttendanceRate: (n) => `Across the last ${n} conducted training${n === 1 ? '' : 's'}`,
    noneConductedYet: 'No trainings conducted yet',
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
    saveOutcomesFailed: 'تعذّر حفظ النتائج. حاول مرة أخرى.',
    certGenerationFailed: (msg) => `تم حفظ النتائج، لكن توليد الشهادة فشل: ${msg}`,
    dashConductedOn: (d) => `انعقد في ${d}`,
    dashDeadline: (d) => `الأجل ${d}`,
    dashRegistrants: (n) => `${n} مسجَّل`,
    daysLeft: 'يوم متبقٍ',
    awaitingOutcome: 'بانتظار النتيجة',
    legendRegistrations: 'التسجيلات',
    legendAttended: 'الحضور المُسجَّل',
    noAttendanceYet: 'لا يوجد حضور مسجَّل بعد',
    attendanceRatePct: (p) => `نسبة حضور ${p}%`,
    nextTrainingOn: (title, date) => `التالي: ${title} · ${date}`,
    noUpcomingTrainings: 'لا توجد تدريبات قادمة',
    departmentsCount: (n) => `${n} إدارة مُتابَعة`,
    noDepartmentData: 'لا توجد بيانات إدارات بعد',
    outcomeBreakdown: (a, ab, aw) => `حضر ${a} · لم يحضر ${ab} · بانتظار ${aw}`,
    recentAttendanceRate: (n) => `عبر آخر ${n} تدريب(ات) مُنعقدة`,
    noneConductedYet: 'لا توجد تدريبات مُنعقدة بعد',
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
    loadDashboard();
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

let ACTIVE_SECTION = 'dashboard';
let CURRENT_SEARCH = '';

/** Restarts a CSS entrance animation on elements that are already in the DOM
 * (toggling .hidden doesn't replay an animation on its own, so without this
 * the dashboard's fade-in only ever plays once, the very first time). */
function replayEntrance(container) {
  container.querySelectorAll('.dash-card, .dash-kpi').forEach((elm) => {
    elm.style.animation = 'none';
    void elm.offsetWidth; // force reflow so the next line re-triggers the animation
    elm.style.animation = '';
  });
}

function showSection(name) {
  ACTIVE_SECTION = name;
  CURRENT_SEARCH = '';
  el('adminSearch').value = '';
  ['dashboard', 'employees', 'trainings', 'search', 'audit'].forEach((n) => {
    el(`scr-${n}`).classList.toggle('hidden', n !== name);
    el(`nav${n.charAt(0).toUpperCase()}${n.slice(1)}`).classList.toggle('on', n === name);
  });
  const activeScreen = el(`scr-${name}`);
  activeScreen.style.animation = 'none';
  void activeScreen.offsetWidth;
  activeScreen.style.animation = '';

  if (name === 'employees') renderEmployeesFiltered();
  if (name === 'trainings') renderTrainingsFiltered();
  if (name === 'audit') renderAudit();
  if (name === 'dashboard') { replayEntrance(activeScreen); loadDashboard(); }
  if (name === 'search') populateSearchLookups();
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
  populateSearchLookups();
}

function renderEmployeesFiltered() {
  const q = ACTIVE_SECTION === 'employees' ? CURRENT_SEARCH : '';
  const filtered = q
    ? LAST_EMPLOYEES.filter((r) => `${r.national_id} ${r.mobile_e164} ${r.name || ''} ${r.department || ''}`.toLowerCase().includes(q))
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
      <td>${r.name || '—'}</td>
      <td>${r.department || '—'}</td>
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
  populateSearchLookups();
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
      <td>${tr.created_by || '—'}</td>
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

function exportRoster(kind) {
  if (!ROSTER_TRAINING_ID) return;
  window.open(`/admin/api/trainings/export?id=${encodeURIComponent(ROSTER_TRAINING_ID)}&kind=${kind}`, '_blank');
}

function markAllAttended() {
  ROSTER_REGISTRANTS.forEach((r) => { ROSTER_OUTCOMES[r.national_id] = 'attended'; });
  renderRoster(ROSTER_REGISTRANTS);
}

async function saveOutcomes() {
  const outcomes = Object.entries(ROSTER_OUTCOMES).map(([nationalId, outcome]) => ({ nationalId, outcome }));
  if (!outcomes.length) return;
  const resp = await api(`/admin/api/trainings/attendance?id=${encodeURIComponent(ROSTER_TRAINING_ID)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcomes }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    alert(data.error || at('saveOutcomesFailed'));
    return;
  }
  if (data.certificateError) {
    alert(at('certGenerationFailed')(data.certificateError));
  }
  el('rosterCard').classList.add('hidden');
  loadTrainings();
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

let LAST_DASHBOARD = null;

async function loadDashboard() {
  const resp = await api('/admin/api/dashboard');
  if (!resp.ok) return;
  LAST_DASHBOARD = await resp.json();
  renderDashboard();
}

function fmtDate(s) {
  return s ? s.slice(0, 10) : '';
}

/** Animates a KPI number counting up from 0 to `target` (easeOutCubic). */
function animateCountUp(node, target, duration) {
  duration = duration || 700;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else node.textContent = target;
  }
  requestAnimationFrame(tick);
}

function renderDashboard() {
  if (!LAST_DASHBOARD) return;
  const d = LAST_DASHBOARD;
  const lang = getLang();

  animateCountUp(el('kpiConductedNum'), d.totals.totalConducted);
  animateCountUp(el('kpiUpcomingNum'), d.totals.totalUpcoming);
  animateCountUp(el('kpiEmployeesNum'), d.totals.totalEmployees);
  animateCountUp(el('kpiRegistrationsNum'), d.totals.totalRegistrations);
  renderDashKpiBacks(d);

  renderDashConducted(d.latestConducted, lang);
  renderDashUpcoming(d.upcoming, lang);
  renderDashTrend(d.monthlyTrend);
  renderDashOutcomes(d.outcomes);
  renderDashDepartments(d.departmentBreakdown);
}

/** The quick one-line insight shown on the back of each KPI tile when flipped. */
function renderDashKpiBacks(d) {
  const { attended, absent, awaiting } = d.outcomes;
  const attendanceDenominator = attended + absent;
  const attendanceRate = attendanceDenominator ? Math.round((attended / attendanceDenominator) * 100) : null;
  el('kpiConductedBack').textContent = attendanceRate === null ? at('noAttendanceYet') : at('attendanceRatePct')(attendanceRate);

  const nextUp = d.upcoming[0];
  el('kpiUpcomingBack').textContent = nextUp
    ? at('nextTrainingOn')((getLang() === 'ar' ? nextUp.title_ar : nextUp.title_en), nextUp.deadline)
    : at('noUpcomingTrainings');

  const deptCount = new Set(LAST_EMPLOYEES.map((e) => e.department).filter(Boolean)).size;
  el('kpiEmployeesBack').textContent = deptCount ? at('departmentsCount')(deptCount) : at('noDepartmentData');

  el('kpiRegistrationsBack').textContent = at('outcomeBreakdown')(attended, absent, awaiting);
}

/** Compact "glance" summary shown on the front face of the conducted/upcoming cards (the detailed list lives on the back). */
function renderDashStatFront(containerId, bigNum, subText) {
  el(containerId).innerHTML = `
    <div class="big-num">${bigNum}</div>
    <div class="big-sub">${subText}</div>`;
}

function renderDashConducted(rows, lang) {
  const wrap = el('dashConductedList');
  const empty = el('dashConductedEmpty');

  const totalAttended = rows.reduce((s, r) => s + r.attendedCount, 0);
  const totalRegistrants = rows.reduce((s, r) => s + r.registrantCount, 0);
  const pct = totalRegistrants ? Math.round((totalAttended / totalRegistrants) * 100) : null;
  renderDashStatFront(
    'dashConductedFront',
    pct === null ? rows.length : `${pct}%`,
    rows.length ? at('recentAttendanceRate')(rows.length) : at('noneConductedYet')
  );

  if (!rows.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  wrap.innerHTML = rows.map((tr, i) => {
    const title = lang === 'ar' ? tr.title_ar : tr.title_en;
    const pct = tr.registrantCount ? Math.round((tr.attendedCount / tr.registrantCount) * 100) : 0;
    return `
      <div class="dash-list-item dash-list-item-click" data-training="${tr.id}" style="animation-delay:${i * 70}ms">
        <div>
          <div class="dash-list-title">${title}</div>
          <div class="dash-list-sub">${at('dashConductedOn')(fmtDate(tr.conductedAt))} · ${at('dashRegistrants')(tr.registrantCount)}</div>
        </div>
        <div class="dash-list-stat">${pct}%<small>${at('attended')}</small></div>
      </div>`;
  }).join('');
  wrap.querySelectorAll('[data-training]').forEach((node) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      showSection('trainings');
      openRoster(node.getAttribute('data-training'));
    });
  });
}

function renderDashUpcoming(rows, lang) {
  const wrap = el('dashUpcomingList');
  const empty = el('dashUpcomingEmpty');

  const totalUpcoming = LAST_DASHBOARD ? LAST_DASHBOARD.totals.totalUpcoming : rows.length;
  const nextUp = rows[0];
  renderDashStatFront(
    'dashUpcomingFront',
    totalUpcoming,
    nextUp ? at('nextTrainingOn')(lang === 'ar' ? nextUp.title_ar : nextUp.title_en, nextUp.deadline) : at('noUpcomingTrainings')
  );

  if (!rows.length) {
    wrap.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  wrap.innerHTML = rows.map((tr, i) => {
    const title = lang === 'ar' ? tr.title_ar : tr.title_en;
    const days = Math.max(0, Math.round((new Date(tr.deadline) - today) / 86400000));
    return `
      <div class="dash-list-item dash-list-item-click" data-training="${tr.id}" style="animation-delay:${i * 70}ms">
        <div>
          <div class="dash-list-title">${title}</div>
          <div class="dash-list-sub">${at('dashDeadline')(tr.deadline)} · ${at('dashRegistrants')(tr.registrantCount)}</div>
        </div>
        <div class="dash-list-stat">${days}<small>${at('daysLeft')}</small></div>
      </div>`;
  }).join('');
  wrap.querySelectorAll('[data-training]').forEach((node) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      showSection('trainings');
      openRoster(node.getAttribute('data-training'));
    });
  });
}

function renderDashTrend(months) {
  const container = el('dashTrendChart');
  const w = 760;
  const h = 220;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const maxVal = Math.max(1, ...months.map((m) => Math.max(m.registrations, m.attended)));
  const stepX = (w - padL - padR) / Math.max(1, months.length - 1);
  const scaleY = (v) => h - padB - (v / maxVal) * (h - padT - padB);
  const scaleX = (i) => padL + i * stepX;

  function pathFor(key) {
    return months.map((m, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(m[key]).toFixed(1)}`).join(' ');
  }
  function areaFor(key) {
    return `${pathFor(key)} L ${scaleX(months.length - 1).toFixed(1)} ${h - padB} L ${scaleX(0).toFixed(1)} ${h - padB} Z`;
  }

  const everyN = Math.max(1, Math.ceil(months.length / 6));
  const monthLabels = months.map((m, i) => {
    if (i % everyN !== 0) return '';
    const [y, mo] = m.ym.split('-');
    return `<text x="${scaleX(i).toFixed(1)}" y="${h - 6}" font-size="10" text-anchor="middle" style="fill:var(--muted)">${mo}/${y.slice(2)}</text>`;
  }).join('');

  const gridLines = [0, 0.5, 1].map((f) => {
    const y = padT + f * (h - padT - padB);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" style="stroke:var(--line)" stroke-width="1"/>`;
  }).join('');

  container.innerHTML = `
    <div class="dash-trend-legend">
      <span><i style="background:var(--green-700)"></i>${at('legendRegistrations')}</span>
      <span><i style="background:var(--gold)"></i>${at('legendAttended')}</span>
    </div>
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="220" preserveAspectRatio="none">
      ${gridLines}
      <path class="trend-area" data-order="0" d="${areaFor('registrations')}" style="fill:color-mix(in srgb, var(--green-700) 18%, transparent);stroke:none"/>
      <path class="trend-line" d="${pathFor('registrations')}" style="fill:none;stroke:var(--green-700);stroke-width:2.2"/>
      <path class="trend-area" data-order="1" d="${areaFor('attended')}" style="fill:color-mix(in srgb, var(--gold) 25%, transparent);stroke:none"/>
      <path class="trend-line" d="${pathFor('attended')}" style="fill:none;stroke:var(--gold);stroke-width:2.2"/>
      ${monthLabels}
    </svg>`;

  animateTrendChart(container.querySelector('svg'));
  renderDashTrendTable(months);
}

/** The back-face table for the trend card -- exact figures for admins who want the numbers, not just the shape. */
function renderDashTrendTable(months) {
  const recent = months.slice(-6);
  const rows = recent.map((m) => {
    const [y, mo] = m.ym.split('-');
    return `<tr><td>${mo}/${y}</td><td>${m.registrations}</td><td>${m.attended}</td></tr>`;
  }).join('');
  el('dashTrendTable').innerHTML = `
    <table class="plain">
      <thead><tr>
        <th data-ar="الشهر" data-en="Month">Month</th>
        <th data-ar="التسجيلات" data-en="Registrations">Registrations</th>
        <th data-ar="الحضور المُسجَّل" data-en="Attendance recorded">Attendance recorded</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  applyStaticLang();
}

/** Draws the trend lines in (stroke sweep) and fades the area fills in behind them. */
function animateTrendChart(svg) {
  const lines = svg.querySelectorAll('.trend-line');
  lines.forEach((path) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
  });
  svg.querySelectorAll('.trend-area').forEach((area) => { area.style.opacity = '0'; });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    lines.forEach((path, i) => {
      path.style.transition = `stroke-dashoffset 1.1s ease-out ${i * 150}ms`;
      path.style.strokeDashoffset = '0';
    });
    svg.querySelectorAll('.trend-area').forEach((area) => {
      const order = Number(area.getAttribute('data-order')) || 0;
      area.style.transition = `opacity 900ms ease-out ${400 + order * 200}ms`;
      area.style.opacity = '1';
    });
  }));
}

/**
 * Builds a multi-segment donut/pie: one stacked <circle> per segment, each
 * animated growing from 0 length to its share of the circumference. A large
 * fixed gap (bigger than the circle ever needs) keeps the dash pattern from
 * wrapping around and drawing a second arc, regardless of segment length.
 */
const PIE_STROKE = 26;

function pieChartSvg(segments, size, centerLabel) {
  const stroke = PIE_STROKE;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const GAP = 9999;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.value / total) * c;
    const dashoffset = -cumulative;
    cumulative += len;
    return `<circle class="pie-seg" data-key="${seg.key}" data-final-len="${len.toFixed(2)}" cx="${mid}" cy="${mid}" r="${r}" fill="none"
      style="stroke:${seg.color};stroke-width:${stroke}px;stroke-dasharray:0 ${GAP}" stroke-dashoffset="${dashoffset.toFixed(2)}"
      pointer-events="visibleStroke" transform="rotate(-90 ${mid} ${mid})"><title>${seg.label}: ${seg.value}</title></circle>`;
  }).join('');

  const centerText = centerLabel === undefined ? '' : `<text x="${mid}" y="${mid + 6}" text-anchor="middle" font-size="20" font-weight="800" style="fill:var(--ink)">${centerLabel}</text>`;

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="pie-svg">
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" style="stroke:var(--line);stroke-width:${stroke}px"/>
    ${arcs}
    ${centerText}
  </svg>`;
}

/** Kicks off the "grow" transition on a freshly-inserted pieChartSvg -- a slow, springy sweep so it reads clearly as motion. */
function animatePieSegments(container) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    container.querySelectorAll('.pie-seg').forEach((circle, i) => {
      const len = circle.getAttribute('data-final-len');
      circle.style.transition = `stroke-dasharray 1.1s cubic-bezier(.34,1.56,.64,1) ${i * 180}ms`;
      circle.style.strokeDasharray = `${len} 9999`;
    });
  }));
}

function pieLegend(segments, total) {
  return `<div class="pie-legend">${segments.map((seg) => `
    <div class="pie-legend-row" data-key="${seg.key}">
      <span class="pie-legend-swatch" style="background:${seg.color}"></span>
      <span class="pie-legend-label">${seg.label}</span>
      <span class="pie-legend-val">${seg.value} (${total ? Math.round((seg.value / total) * 100) : 0}%)</span>
    </div>`).join('')}</div>`;
}

/** Wires click-to-drill-down on whichever elements (pie arcs and/or legend rows) carry [data-key] within `root`. */
function wireSegmentClicks(root, buildFilter) {
  root.querySelectorAll('[data-key]').forEach((node) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      openSearch('registrations', buildFilter(node.getAttribute('data-key')));
    });
  });
}

function renderDashOutcomes(outcomes) {
  const total = outcomes.attended + outcomes.absent + outcomes.awaiting;
  const segments = [
    { key: 'attended', value: outcomes.attended, color: 'var(--green-700)', label: at('attended') },
    { key: 'absent', value: outcomes.absent, color: 'var(--danger)', label: at('absent') },
    { key: 'awaiting', value: outcomes.awaiting, color: 'var(--warning)', label: at('awaitingOutcome') },
  ];

  const front = el('dashOutcomesFront');
  front.innerHTML = pieChartSvg(segments, 190, total);
  animatePieSegments(front);
  wireSegmentClicks(front, (key) => ({ outcome: key }));

  const back = el('dashOutcomesGauges');
  back.innerHTML = pieLegend(segments, total);
  wireSegmentClicks(back, (key) => ({ outcome: key }));
}

const DEPT_PALETTE = ['var(--green-700)', 'var(--gold)', 'var(--info)', 'var(--warning)', 'var(--danger)', 'var(--green-500)'];

function renderDashDepartments(rows) {
  const front = el('dashDeptFront');
  const frontEmpty = el('dashDeptEmptyFront');
  const back = el('dashDeptChart');
  const backEmpty = el('dashDeptEmpty');

  if (!rows.length) {
    front.innerHTML = '';
    back.innerHTML = '';
    frontEmpty.classList.remove('hidden');
    backEmpty.classList.remove('hidden');
    return;
  }
  frontEmpty.classList.add('hidden');
  backEmpty.classList.add('hidden');

  const total = rows.reduce((s, r) => s + r.total, 0);
  const segments = rows.map((r, i) => ({ key: r.department, value: r.total, color: DEPT_PALETTE[i % DEPT_PALETTE.length], label: r.department }));

  front.innerHTML = pieChartSvg(segments, 190, total);
  animatePieSegments(front);
  wireSegmentClicks(front, (key) => ({ department: key }));

  back.innerHTML = pieLegend(segments, total);
  wireSegmentClicks(back, (key) => ({ department: key }));
}

// ---------------------------------------------------------------------
// Advanced search
// ---------------------------------------------------------------------

let ACTIVE_SEARCH_TAB = 'trainings';

function setSearchTab(tab) {
  ACTIVE_SEARCH_TAB = tab;
  document.querySelectorAll('#searchTabs button').forEach((btn) => {
    btn.classList.toggle('on', btn.getAttribute('data-search-tab') === tab);
  });
  el('searchTrainingsPanel').classList.toggle('hidden', tab !== 'trainings');
  el('searchRegistrationsPanel').classList.toggle('hidden', tab !== 'registrations');
}

/** Populates the Department/Training dropdowns from already-loaded data, preserving any current selection. */
function populateSearchLookups() {
  const depts = Array.from(new Set(LAST_EMPLOYEES.map((e) => e.department).filter(Boolean))).sort();
  const deptSel = el('srDepartment');
  const currentDept = deptSel.value;
  deptSel.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
  depts.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    deptSel.appendChild(opt);
  });
  if (depts.includes(currentDept)) deptSel.value = currentDept;

  const lang = getLang();
  const trainSel = el('srTraining');
  const currentTrain = trainSel.value;
  trainSel.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
  LAST_TRAININGS.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.id} — ${lang === 'ar' ? t.title_ar : t.title_en}`;
    trainSel.appendChild(opt);
  });
  if (LAST_TRAININGS.some((t) => t.id === currentTrain)) trainSel.value = currentTrain;
}

/** Switches to Advanced Search, selects a tab, pre-fills its filters, and runs the search. Used by dashboard drill-downs. */
function openSearch(tab, filters) {
  showSection('search');
  setSearchTab(tab);
  if (tab === 'trainings') {
    el('stStatus').value = filters.status || '';
    el('stDateFrom').value = filters.dateFrom || '';
    el('stDateTo').value = filters.dateTo || '';
    el('stQuery').value = filters.q || '';
    runTrainingsSearch();
  } else {
    el('srNationalId').value = filters.nationalId || '';
    el('srDepartment').value = filters.department || '';
    el('srTraining').value = filters.trainingId || '';
    el('srOutcome').value = filters.outcome || '';
    el('srDateFrom').value = filters.dateFrom || '';
    el('srDateTo').value = filters.dateTo || '';
    runRegistrationsSearch();
  }
}

const ST_PAGER = createPaginator({ containerId: 'stPager', pageSize: 10, renderPage: renderStPage });
let LAST_ST_RESULTS = [];

async function runTrainingsSearch() {
  const params = new URLSearchParams({
    status: el('stStatus').value,
    dateFrom: el('stDateFrom').value,
    dateTo: el('stDateTo').value,
    q: el('stQuery').value.trim(),
  });
  const resp = await api(`/admin/api/search/trainings?${params.toString()}`);
  if (!resp.ok) return;
  const data = await resp.json();
  LAST_ST_RESULTS = data.trainings || [];
  renderStResults();
}

function renderStResults() {
  const empty = el('stEmptyNote');
  if (!LAST_ST_RESULTS.length) {
    document.querySelector('#stTable tbody').innerHTML = '';
    el('stPager').classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  ST_PAGER.setItems(LAST_ST_RESULTS);
}

function renderStPage(pageItems) {
  const tbody = document.querySelector('#stTable tbody');
  const lang = getLang();
  tbody.innerHTML = pageItems.map((tr) => `
    <tr class="clickable-row" data-roster="${tr.id}">
      <td><span class="idpill">${tr.id}</span></td>
      <td>${lang === 'ar' ? tr.title_ar : tr.title_en}</td>
      <td>${tr.deadline}</td>
      <td>${statusBadge(tr.effectiveStatus)}</td>
      <td>${tr.registrantCount}</td>
      <td>${tr.attendedCount || 0}</td>
      <td>${tr.absentCount || 0}</td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-roster]').forEach((row) => {
    row.addEventListener('click', () => {
      showSection('trainings');
      openRoster(row.getAttribute('data-roster'));
    });
  });
}

function resetTrainingsSearch() {
  el('stStatus').value = '';
  el('stDateFrom').value = '';
  el('stDateTo').value = '';
  el('stQuery').value = '';
  runTrainingsSearch();
}

const SR_PAGER = createPaginator({ containerId: 'srPager', pageSize: 10, renderPage: renderSrPage });
let LAST_SR_RESULTS = [];

function srQueryParams() {
  return new URLSearchParams({
    nationalId: el('srNationalId').value.trim(),
    department: el('srDepartment').value,
    trainingId: el('srTraining').value,
    outcome: el('srOutcome').value,
    dateFrom: el('srDateFrom').value,
    dateTo: el('srDateTo').value,
  });
}

async function runRegistrationsSearch() {
  const resp = await api(`/admin/api/search/registrations?${srQueryParams().toString()}`);
  if (!resp.ok) return;
  const data = await resp.json();
  LAST_SR_RESULTS = data.registrations || [];
  renderSrResults();
}

function renderSrResults() {
  const empty = el('srEmptyNote');
  if (!LAST_SR_RESULTS.length) {
    document.querySelector('#srTable tbody').innerHTML = '';
    el('srPager').classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  SR_PAGER.setItems(LAST_SR_RESULTS);
}

function srOutcomeBadge(r) {
  if (r.outcome === 'attended') return `<span class="badge attend">${at('attended')}</span>`;
  if (r.outcome === 'absent') return `<span class="badge absent">${at('absent')}</span>`;
  return `<span class="badge wait">${at('awaitingOutcome')}</span>`;
}

function renderSrPage(pageItems) {
  const tbody = document.querySelector('#srTable tbody');
  const lang = getLang();
  tbody.innerHTML = pageItems.map((r) => `
    <tr>
      <td>${r.national_id}</td>
      <td>${r.name || '—'}</td>
      <td>${r.department || '—'}</td>
      <td dir="ltr">${r.mobile_e164 || ''}</td>
      <td><span class="idpill">${r.training_id}</span> ${lang === 'ar' ? r.title_ar : r.title_en}</td>
      <td>${r.registered_at}</td>
      <td>${srOutcomeBadge(r)}</td>
    </tr>`).join('');
}

function resetRegistrationsSearch() {
  el('srNationalId').value = '';
  el('srDepartment').value = '';
  el('srTraining').value = '';
  el('srOutcome').value = '';
  el('srDateFrom').value = '';
  el('srDateTo').value = '';
  runRegistrationsSearch();
}

function exportRegistrationsSearch() {
  window.open(`/admin/api/search/registrations/export?${srQueryParams().toString()}`, '_blank');
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
    renderDashboard();
    populateSearchLookups();
    if (LAST_ST_RESULTS.length) renderStResults();
    if (LAST_SR_RESULTS.length) renderSrResults();
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
  el('exportEmployeesBtn').addEventListener('click', () => window.open('/admin/api/employees/export', '_blank'));
  el('downloadTemplateBtn').addEventListener('click', () => window.open('/admin/api/employees/import-template', '_blank'));
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
  el('exportAttendedBtn').addEventListener('click', () => exportRoster('attended'));
  el('exportNotAttendedBtn').addEventListener('click', () => exportRoster('not-attended'));

  el('navDashboard').addEventListener('click', () => showSection('dashboard'));
  el('navEmployees').addEventListener('click', () => showSection('employees'));
  el('navTrainings').addEventListener('click', () => showSection('trainings'));
  el('navSearch').addEventListener('click', () => showSection('search'));
  el('navAudit').addEventListener('click', () => showSection('audit'));
  document.querySelectorAll('#auditTabs button').forEach((btn) => {
    btn.addEventListener('click', () => setAuditTab(btn.getAttribute('data-audit-tab')));
  });
  el('adminSearch').addEventListener('input', (e) => handleSearchInput(e.target.value));

  // Dashboard drill-downs into Advanced Search.
  function dashCardKeydown(handler) {
    return (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-key]')) {
        e.preventDefault();
        handler();
      }
    };
  }
  el('dashConductedCard').addEventListener('click', () => openSearch('trainings', { status: 'conducted' }));
  el('dashConductedCard').addEventListener('keydown', dashCardKeydown(() => openSearch('trainings', { status: 'conducted' })));
  el('dashUpcomingCard').addEventListener('click', () => openSearch('trainings', { status: 'open' }));
  el('dashUpcomingCard').addEventListener('keydown', dashCardKeydown(() => openSearch('trainings', { status: 'open' })));
  el('dashTrendCard').addEventListener('click', () => openSearch('registrations', {}));
  el('dashTrendCard').addEventListener('keydown', dashCardKeydown(() => openSearch('registrations', {})));
  el('dashOutcomesCard').addEventListener('click', (e) => { if (!e.target.closest('[data-key]')) openSearch('registrations', {}); });
  el('dashOutcomesCard').addEventListener('keydown', dashCardKeydown(() => openSearch('registrations', {})));
  el('dashDeptCard').addEventListener('click', (e) => { if (!e.target.closest('[data-key]')) openSearch('registrations', {}); });
  el('dashDeptCard').addEventListener('keydown', dashCardKeydown(() => openSearch('registrations', {})));
  el('kpiConducted').addEventListener('click', () => openSearch('trainings', { status: 'conducted' }));
  el('kpiUpcoming').addEventListener('click', () => openSearch('trainings', { status: 'open' }));
  el('kpiEmployees').addEventListener('click', () => showSection('employees'));
  el('kpiRegistrations').addEventListener('click', () => openSearch('registrations', {}));

  // Flip cards: the flip icon toggles the card face and must never also
  // trigger the card's own drill-down click handler.
  document.querySelectorAll('[data-flip-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const card = toggle.closest('.flip-card');
      // A detach/reattach with no other change forces the browser to redo
      // this node's style computation from scratch. Some engines can
      // otherwise leave a long-lived node's 3D transform "stuck" at
      // identity after a pure class toggle -- this guarantees the rotateY
      // actually takes effect every time, at negligible cost (it's a no-op
      // visually and sub-millisecond).
      const parent = card.parentElement;
      const next = card.nextSibling;
      parent.removeChild(card);
      void parent.offsetWidth;
      parent.insertBefore(card, next);
      card.classList.toggle('flipped');
    });
  });

  // Advanced search.
  document.querySelectorAll('#searchTabs button').forEach((btn) => {
    btn.addEventListener('click', () => setSearchTab(btn.getAttribute('data-search-tab')));
  });
  el('stSearchBtn').addEventListener('click', runTrainingsSearch);
  el('stResetBtn').addEventListener('click', resetTrainingsSearch);
  el('srSearchBtn').addEventListener('click', runRegistrationsSearch);
  el('srResetBtn').addEventListener('click', resetRegistrationsSearch);
  el('srExportBtn').addEventListener('click', exportRegistrationsSearch);

  checkAuth();
});
