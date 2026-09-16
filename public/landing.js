'use strict';

let CURRENT_ME = null;
let CURRENT_CERTS = [];
let CURRENT_TRAININGS = [];
let CURRENT_MINE = [];
let ACTIVE_TAB = 'train';

function onLangChanged() {
  renderCerts();
  renderTrainings();
  renderMine();
}

function formatShortDate(iso) {
  const d = new Date(iso);
  const lang = getLang();
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function switchTab(name) {
  ACTIVE_TAB = name;
  document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
  document.getElementById(`tab${name.charAt(0).toUpperCase()}${name.slice(1)}`).classList.add('active');
  ['train', 'mine', 'certs'].forEach((n) => {
    document.getElementById(`panel-${n}`).classList.toggle('hidden', n !== name);
  });
}

function renderTrainings() {
  const list = document.getElementById('trainList');
  const empty = document.getElementById('trainEmpty');
  if (!CURRENT_TRAININGS.length) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  const lang = getLang();

  list.innerHTML = CURRENT_TRAININGS.map((tr) => {
    const already = CURRENT_MINE.some((m) => m.training_id === tr.id && m.status === 'registered');
    return `
    <div class="tcard">
      <div class="tmeta"><span class="idpill">${tr.id}</span><span class="badge open">${t('statusOpen')}</span></div>
      <div class="tt">${lang === 'ar' ? tr.title_ar : tr.title_en}</div>
      <div class="td">${lang === 'ar' ? (tr.desc_ar || '') : (tr.desc_en || '')}</div>
      <div class="tmeta"><span>${t('deadline')}</span><b dir="ltr">${formatShortDate(tr.deadline)}</b></div>
      <button class="btn" data-id="${tr.id}" ${already ? 'disabled style="opacity:.65;cursor:not-allowed"' : ''}>${already ? t('registered') : t('register')}</button>
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
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  const lang = getLang();

  list.innerHTML = CURRENT_MINE.map((m) => {
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
      ${canCancel ? `<button class="signout" data-cancel="${m.training_id}" style="padding:8px 12px;font-size:12.5px">${t('cancelReg')}</button>` : ''}
      <button class="dl" ${canDownload ? `data-file="${encodeURIComponent(cert.fileName)}"` : 'disabled style="opacity:.55;cursor:not-allowed"'}>${dlLabel}</button>
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

function showToast(msg) {
  const toast = document.getElementById('msgToast');
  document.getElementById('msgToastText').textContent = msg;
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
  return `<svg viewBox="0 0 46 46" fill="none"><circle cx="23" cy="20" r="13" fill="#EAF2EC" stroke="#C6A15B" stroke-width="1.3"/><path d="M23 12l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.7-2-3.7 2 .7-4.3-3.1-3 4.3-.6z" fill="#005430"/><path d="M18 31l-2 8 7-3 7 3-2-8" stroke="#C6A15B" stroke-width="1.3" stroke-linejoin="round" fill="#fff"/></svg>`;
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

  list.innerHTML = CURRENT_CERTS.map((c) => `
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

document.addEventListener('DOMContentLoaded', async () => {
  applyStaticLang();
  document.getElementById('langBtn').addEventListener('click', toggleLang);
  document.getElementById('signOutBtn').addEventListener('click', signOut);
  document.getElementById('tabTrain').addEventListener('click', () => switchTab('train'));
  document.getElementById('tabMine').addEventListener('click', () => switchTab('mine'));
  document.getElementById('tabCerts').addEventListener('click', () => switchTab('certs'));
  showVerifiedToastIfJustLoggedIn();
  await loadMe();
  await loadCerts();
  await loadTrainings();
  await loadMine();
});
