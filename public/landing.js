'use strict';

let CURRENT_ME = null;
let CURRENT_CERTS = [];

function onLangChanged() {
  renderCerts();
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
        <div class="t">${t('genericCert')(c.index)}</div>
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
  document.getElementById('empIdMasked').textContent = `•••• ${CURRENT_ME.last4}`;
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
  showVerifiedToastIfJustLoggedIn();
  await loadMe();
  await loadCerts();
});
