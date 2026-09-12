'use strict';

function onLangChanged() {}

function digitsOnly(v) {
  return (v || '').replace(/\D/g, '');
}

// Same checksum as the server (Appendix A) -- client-side check is a UX
// convenience only; the server is the sole authority.
function isValidSaudiIdClient(id) {
  if (!/^\d{10}$/.test(id)) return false;
  if (id[0] !== '1' && id[0] !== '2') return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(id[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function isValidMobileClient(v) {
  let d = digitsOnly(v);
  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^5\d{8}$/.test(d);
}

function toggleId() {
  const inp = document.getElementById('nid');
  const open = document.querySelector('#idEye .eye-open');
  const closed = document.querySelector('#idEye .eye-closed');
  const reveal = inp.type === 'password';
  inp.type = reveal ? 'text' : 'password';
  open.classList.toggle('hidden', reveal);
  closed.classList.toggle('hidden', !reveal);
}

function setFieldInvalid(fieldId, invalid) {
  document.getElementById(fieldId).classList.toggle('invalid', invalid);
}

function showAlert(message, kind) {
  const alertEl = document.getElementById('loginAlert');
  alertEl.querySelector('span').textContent = message;
  alertEl.classList.remove('info');
  if (kind === 'info') alertEl.classList.add('info');
  alertEl.classList.add('show');
}
function hideAlert() {
  document.getElementById('loginAlert').classList.remove('show');
}

async function verify() {
  const idVal = digitsOnly(document.getElementById('nid').value);
  const mobVal = document.getElementById('mob').value;

  const idOk = isValidSaudiIdClient(idVal);
  const mobOk = isValidMobileClient(mobVal);
  setFieldInvalid('f-id', !idOk);
  setFieldInvalid('f-mob', !mobOk);

  if (!idOk || !mobOk) {
    showAlert(!idOk ? t('idFormatError') : t('mobileFormatError'));
    return;
  }
  hideAlert();

  const btn = document.getElementById('verifyBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId: idVal, mobile: mobVal }),
    });
    const data = await resp.json();

    if (resp.status === 200 && data.ok) {
      sessionStorage.setItem('portal_just_verified', '1');
      window.location.href = '/landing';
      return;
    }
    if (resp.status === 429) {
      showAlert(t('lockedOut'));
    } else {
      showAlert(t('genericError'));
    }
  } catch (err) {
    showAlert(t('serviceDown'));
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyStaticLang();
  document.getElementById('nid').addEventListener('input', (e) => {
    e.target.value = digitsOnly(e.target.value).slice(0, 10);
  });
  document.getElementById('mob').addEventListener('input', (e) => {
    e.target.value = digitsOnly(e.target.value).slice(0, 9);
  });
  ['nid', 'mob'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') verify();
    });
  });
  document.getElementById('verifyBtn').addEventListener('click', verify);
  document.getElementById('langBtn').addEventListener('click', toggleLang);
});
