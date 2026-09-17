'use strict';

let CURRENT_ME = null;
let CURRENT_CERTS = [];
let CURRENT_TRAININGS = [];
let CURRENT_MINE = [];
let ACTIVE_TAB = 'train';

const TRAIN_PAGER = createPaginator({ containerId: 'trainPager', pageSize: 6, renderPage: renderTrainingsPage });
const MINE_PAGER = createPaginator({ containerId: 'minePager', pageSize: 6, renderPage: renderMinePage });
const CERT_PAGER = createPaginator({ containerId: 'certPager', pageSize: 6, renderPage: renderCertsPage });

function onLangChanged() {
  renderCerts();
  renderTrainings();
  renderMine();
  if (document.getElementById('notifMenu').classList.contains('open')) renderNotifList();
}

function formatShortDate(iso) {
  const d = new Date(iso);
  const lang = getLang();
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function switchTab(name) {
  ACTIVE_TAB = name;
  document.querySelectorAll('.side-link').forEach((b) => b.classList.remove('on'));
  document.getElementById(`tab${name.charAt(0).toUpperCase()}${name.slice(1)}`).classList.add('on');
  ['train', 'mine', 'certs'].forEach((n) => {
    document.getElementById(`panel-${n}`).classList.toggle('hidden', n !== name);
  });
  document.getElementById('trainSearch').style.display = name === 'train' ? '' : 'none';
}

function renderTrainings() {
  const list = document.getElementById('trainList');
  const empty = document.getElementById('trainEmpty');
  const q = (document.getElementById('trainSearch').value || '').trim().toLowerCase();
  const visible = q
    ? CURRENT_TRAININGS.filter((tr) => `${tr.title_ar} ${tr.title_en}`.toLowerCase().includes(q))
    : CURRENT_TRAININGS;

  if (!visible.length) {
    list.classList.add('hidden');
    document.getElementById('trainPager').classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  TRAIN_PAGER.setItems(visible);
}

function renderTrainingsPage(pageItems) {
  const list = document.getElementById('trainList');
  const lang = getLang();

  list.innerHTML = pageItems.map((tr) => {
    const already = CURRENT_MINE.some((m) => m.training_id === tr.id && m.status === 'registered');
    return `
    <div class="tcard">
      <div class="tmeta"><span class="idpill">${tr.id}</span><span class="badge open">${t('statusOpen')}</span></div>
      <div class="tt">${lang === 'ar' ? tr.title_ar : tr.title_en}</div>
      <div class="td">${lang === 'ar' ? (tr.desc_ar || '') : (tr.desc_en || '')}</div>
      <div class="tmeta"><span>${t('deadline')}</span><b dir="ltr">${formatShortDate(tr.deadline)}</b></div>
      <button class="btn" data-id="${tr.id}" ${already ? 'disabled' : ''}>${already ? t('registered') : t('register')}</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => registerTraining(btn));
  });
}

async function registerTraining(btn) {
  const id = btn.getAttribute('data-id');
  btn.disabled = true;
  btn.textContent = t('registering');
  try {
    const resp = await fetch(`/api/trainings/register?id=${encodeURIComponent(id)}`, { method: 'POST', credentials: 'same-origin' });
    const data = await resp.json();
    if (resp.status === 401) { window.location.href = '/'; return; }
    if (!resp.ok) {
      showToast(data.error === 'already_registered' ? t('alreadyRegistered') : t('registerFailed'));
      btn.disabled = false;
      btn.textContent = t('register');
      return;
    }
    await Promise.all([loadTrainings(), loadMine()]);
  } catch {
    showToast(t('registerFailed'));
    btn.disabled = false;
    btn.textContent = t('register');
  }
}

function mineStatusBadge(m) {
  if (m.outcome === 'attended') return `<span class="badge attend">${t('statusAttended')}</span>`;
  if (m.outcome === 'absent') return `<span class="badge absent">${t('statusAbsent')}</span>`;
  if (m.trainingEffectiveStatus === 'closed' || m.trainingEffectiveStatus === 'conducted') return `<span class="badge wait">${t('statusAwaitingOutcome')}</span>`;
  return `<span class="badge reg">${t('registered')}</span>`;
}

function renderMine() {
  const list = document.getElementById('mineList');
  const empty = document.getElementById('mineEmpty');
  if (!CURRENT_MINE.length) {
    list.classList.add('hidden');
    document.getElementById('minePager').classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  MINE_PAGER.setItems(CURRENT_MINE);
}

function renderMinePage(pageItems) {
  const list = document.getElementById('mineList');
  const lang = getLang();

  list.innerHTML = pageItems.map((m) => {
    const cert = CURRENT_CERTS.find((c) => c.trainingId === m.training_id);
    const canDownload = m.outcome === 'attended' && cert;
    const canCancel = !m.outcome && m.trainingEffectiveStatus === 'open';
    const dlLabel = canDownload ? t('download') : (m.outcome === 'absent' ? t('noCertYet') : t('awaitingTraining'));
    return `
    <div class="mrow">
      <div class="mi">
        <div class="mt">${lang === 'ar' ? m.title_ar : m.title_en}</div>
        <div class="ms"><span class="idpill">${m.training_id}</span><span>${t('regDate')(formatShortDate(m.registered_at))}</span></div>
      </div>
      ${mineStatusBadge(m)}
      ${canCancel ? `<button class="signout sm" data-cancel="${m.training_id}">${t('cancelReg')}</button>` : ''}
      <button class="dl" ${canDownload ? `data-file="${encodeURIComponent(cert.fileName)}"` : 'disabled'}>${dlLabel}</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.dl[data-file]').forEach((btn) => btn.addEventListener('click', () => downloadCert(btn)));
  list.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', () => cancelTraining(btn.getAttribute('data-cancel'))));
}

async function cancelTraining(id) {
  const resp = await fetch(`/api/trainings/cancel?id=${encodeURIComponent(id)}`, { method: 'POST', credentials: 'same-origin' });
  if (resp.status === 401) { window.location.href = '/'; return; }
  if (!resp.ok) { showToast(t('cancelFailed')); return; }
  await Promise.all([loadTrainings(), loadMine()]);
}

async function loadTrainings() {
  const resp = await fetch('/api/trainings', { credentials: 'same-origin' });
  if (resp.status === 401) { window.location.href = '/'; return; }
  const data = await resp.json();
  CURRENT_TRAININGS = data.trainings || [];
  renderTrainings();
}

async function loadMine() {
  const resp = await fetch('/api/my-trainings', { credentials: 'same-origin' });
  if (resp.status === 401) { window.location.href = '/'; return; }
  const data = await resp.json();
  CURRENT_MINE = data.trainings || [];
  renderMine();
  renderTrainings();
  renderCerts();
}

function showToast(msg, kind) {
  const toast = document.getElementById('msgToast');
  document.getElementById('msgToastText').textContent = msg;
  toast.classList.toggle('error', kind !== 'success');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatDate(iso) {
  const d = new Date(iso);
  const lang = getLang();
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function sealSvg() {
  // Colors are set via inline style="" (not fill=/stroke= attributes) so
  // they resolve through var() and stay theme-aware across dark mode and
  // Color Blind Mode, instead of being frozen to the light-mode hex values.
  return `<svg viewBox="0 0 46 46" fill="none"><circle cx="23" cy="20" r="13" style="fill:var(--success-bg);stroke:var(--gold)" stroke-width="1.3"/><path d="M23 12l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.7-2-3.7 2 .7-4.3-3.1-3 4.3-.6z" style="fill:var(--green-700)"/><path d="M18 31l-2 8 7-3 7 3-2-8" style="stroke:var(--gold);fill:var(--paper)" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
}

function trainingCertLabel(c) {
  if (!c.trainingId) return t('genericCert')(c.index);
  const m = CURRENT_MINE.find((x) => x.training_id === c.trainingId);
  if (!m) return c.trainingId;
  return getLang() === 'ar' ? m.title_ar : m.title_en;
}

function renderCerts() {
  const list = document.getElementById('certList');
  const empty = document.getElementById('emptyState');
  const label = document.querySelector('.section-label');
  const countEl = document.querySelector('.count');

  if (!CURRENT_CERTS.length) {
    list.classList.add('hidden');
    document.getElementById('certPager').classList.add('hidden');
    label.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.querySelector('h3').textContent = t('noCerts');
    empty.querySelector('p').textContent = t('noCertsSub');
    return;
  }

  label.classList.remove('hidden');
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  countEl.textContent = t('certAvailable')(CURRENT_CERTS.length);
  document.querySelector('.section-label h2').textContent = t('yourCerts');
  CERT_PAGER.setItems(CURRENT_CERTS);
}

function renderCertsPage(pageItems) {
  const list = document.getElementById('certList');
  list.innerHTML = pageItems.map((c) => `
    <div class="cert">
      <div class="seal" aria-hidden="true">${sealSvg()}</div>
      <div class="info">
        <div class="t">${trainingCertLabel(c)}</div>
        <div class="s">
          <span class="pill done">${t('completed')}</span>
          <span class="pill fmt">${c.ext.replace('.', '').toUpperCase()}</span>
          <span>${t('issued')(formatDate(c.issuedAt))}</span>
        </div>
      </div>
      <button class="dl" data-file="${encodeURIComponent(c.fileName)}">
        <span class="spin"></span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="dl-label">${t('download')}</span>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.dl').forEach((btn) => {
    btn.addEventListener('click', () => downloadCert(btn));
  });
}

async function downloadCert(btn) {
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');
  const note = document.getElementById('streamNote');
  note.textContent = t('retrieving');
  note.classList.add('show');

  const fileName = btn.getAttribute('data-file');
  try {
    const resp = await fetch(`/api/download?file=${fileName}`, { credentials: 'same-origin' });
    if (resp.status === 401) {
      window.location.href = '/';
      return;
    }
    if (!resp.ok) {
      note.textContent = t('serviceDown');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decodeURIComponent(fileName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    note.textContent = t('serviceDown');
  } finally {
    btn.classList.remove('busy');
    setTimeout(() => note.classList.remove('show'), 600);
  }
}

async function loadMe() {
  const resp = await fetch('/api/me', { credentials: 'same-origin' });
  if (resp.status === 401) {
    window.location.href = '/';
    return;
  }
  CURRENT_ME = await resp.json();
  document.getElementById('empIdLast4').textContent = CURRENT_ME.last4;
}

async function loadCerts() {
  const resp = await fetch('/api/certificates', { credentials: 'same-origin' });
  if (resp.status === 401) {
    window.location.href = '/';
    return;
  }
  if (resp.status === 503) {
    document.getElementById('certList').classList.add('hidden');
    document.querySelector('.section-label').classList.add('hidden');
    const empty = document.getElementById('emptyState');
    empty.classList.remove('hidden');
    empty.querySelector('h3').textContent = t('serviceDown');
    empty.querySelector('p').textContent = '';
    return;
  }
  const data = await resp.json();
  CURRENT_CERTS = data.certificates || [];
  renderCerts();
}

async function signOut() {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/';
}

function showVerifiedToastIfJustLoggedIn() {
  if (sessionStorage.getItem('portal_just_verified') !== '1') return;
  sessionStorage.removeItem('portal_just_verified');
  const toast = document.getElementById('verifiedToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------
// Notifications -- new trainings, attendance outcomes, certificates ready.
// No server-side "read" state (BRD 13.7 keeps this in-app only); a
// last-seen timestamp kept in localStorage drives the unread dot.
// ---------------------------------------------------------------------

let CURRENT_NOTIFS = [];

function notifText(n) {
  const lang = getLang();
  const title = lang === 'ar' ? n.titleAr : n.titleEn;
  if (n.type === 'new_training') return t('notifNewTraining')(title);
  if (n.type === 'attendance') return n.outcome === 'attended' ? t('notifAttended')(title) : t('notifAbsent')(title);
  if (n.type === 'cert_ready') return t('notifCertReady')(title);
  return title || '';
}

function notifIconSvg(n) {
  if (n.type === 'attendance' && n.outcome !== 'attended') {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  if (n.type === 'cert_ready') {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="5.2" stroke="currentColor" stroke-width="1.7"/><path d="M9 13.5L7.5 21l4.5-2.4 4.5 2.4-1.5-7.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  }
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 7L10 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function getNotifSeenTs() {
  return localStorage.getItem('portal_notif_seen') || '';
}
function setNotifSeenTs(ts) {
  localStorage.setItem('portal_notif_seen', ts);
}

function renderNotifDot() {
  const seen = getNotifSeenTs();
  const hasUnread = CURRENT_NOTIFS.some((n) => n.ts > seen);
  document.getElementById('notifDot').classList.toggle('hidden', !hasUnread);
}

function renderNotifList() {
  const list = document.getElementById('notifList');
  if (!CURRENT_NOTIFS.length) {
    list.innerHTML = `<div class="notif-empty">${t('notifEmpty')}</div>`;
    return;
  }
  list.innerHTML = CURRENT_NOTIFS.map((n) => `
    <div class="notif-item">
      <div class="notif-ico${n.type === 'attendance' && n.outcome !== 'attended' ? ' absent' : ''}">${notifIconSvg(n)}</div>
      <div class="notif-body">
        <div class="notif-text">${notifText(n)}</div>
        <div class="notif-time">${formatShortDate(n.ts)}</div>
      </div>
    </div>
  `).join('');
}

async function loadNotifications() {
  try {
    const resp = await fetch('/api/notifications', { credentials: 'same-origin' });
    if (resp.status === 401) return;
    const data = await resp.json();
    CURRENT_NOTIFS = data.notifications || [];
    renderNotifDot();
  } catch {
    // Non-critical -- just leave any previously loaded notifications in place.
  }
}

/** Positions a fixed-position popover against its trigger button, clamped
 * so it never runs off either edge of the viewport. */
function positionToolMenu(menu, anchorBtn) {
  const rect = anchorBtn.getBoundingClientRect();
  const menuWidth = menu.offsetWidth;
  const margin = 12;
  let left = rect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));
  menu.style.left = `${left}px`;
  menu.style.top = `${rect.bottom + 10}px`;
}

function toggleToolMenu(menuId, otherMenuId, anchorBtn) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu.classList.contains('open');
  document.getElementById(otherMenuId).classList.remove('open');
  if (!wasOpen) {
    positionToolMenu(menu, anchorBtn);
    menu.classList.add('open');
    if (menuId === 'notifMenu') {
      renderNotifList();
      if (CURRENT_NOTIFS.length) setNotifSeenTs(CURRENT_NOTIFS[0].ts);
      renderNotifDot();
    }
  } else {
    menu.classList.remove('open');
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifBtn') && !e.target.closest('#notifMenu')) {
    document.getElementById('notifMenu').classList.remove('open');
  }
  if (!e.target.closest('#appearanceBtn') && !e.target.closest('#appearanceMenu')) {
    document.getElementById('appearanceMenu').classList.remove('open');
  }
});
window.addEventListener('resize', () => {
  document.getElementById('notifMenu').classList.remove('open');
  document.getElementById('appearanceMenu').classList.remove('open');
});

document.addEventListener('DOMContentLoaded', async () => {
  applyStaticLang();
  document.getElementById('langBtn').addEventListener('click', toggleLang);
  document.getElementById('signOutBtn').addEventListener('click', signOut);
  document.getElementById('tabTrain').addEventListener('click', () => switchTab('train'));
  document.getElementById('tabMine').addEventListener('click', () => switchTab('mine'));
  document.getElementById('tabCerts').addEventListener('click', () => switchTab('certs'));
  document.getElementById('trainSearch').addEventListener('input', renderTrainings);

  document.getElementById('notifBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolMenu('notifMenu', 'appearanceMenu', e.currentTarget);
  });
  document.getElementById('appearanceBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolMenu('appearanceMenu', 'notifMenu', e.currentTarget);
  });
  const darkToggle = document.getElementById('darkModeToggle');
  const cbToggle = document.getElementById('colorblindToggle');
  darkToggle.checked = getTheme() === 'dark';
  cbToggle.checked = getColorblind();
  darkToggle.addEventListener('change', () => setTheme(darkToggle.checked ? 'dark' : 'light'));
  cbToggle.addEventListener('change', () => setColorblind(cbToggle.checked));

  showVerifiedToastIfJustLoggedIn();
  await loadMe();
  await loadCerts();
  await loadTrainings();
  await loadMine();
  await loadNotifications();
});
