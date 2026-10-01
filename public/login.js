'use strict';

function onLangChanged() {}

function digitsOnly(v) {
  return (v || '').replace(/\D/g, '');
}

// Same format rule as the server -- client-side check is a UX convenience
// only; the server is the sole authority.
function isValidSaudiIdClient(id) {
  if (!/^\d{10}$/.test(id)) return false;
  if (id[0] !== '1' && id[0] !== '2') return false;
  return true;
}

function isValidMobileClient(v) {
  let d = digitsOnly(v);
  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^5\d{8}$/.test(d);
}

// A single icon, content-swapped on toggle -- one <svg> element in the DOM
// at all times, so there's never a chance of both states rendering at once.
const EYE_OPEN_SVG = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/>';
const EYE_CLOSED_SVG = '<path d="M4 4l16 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a15.9 15.9 0 0 1-3.1 3.9M6.2 7.3A15.8 15.8 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 3.2-.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';

function toggleId() {
  const inp = document.getElementById('nid');
  const icon = document.getElementById('idEyeIcon');
  const reveal = inp.type === 'password';
  inp.type = reveal ? 'text' : 'password';
  icon.innerHTML = reveal ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
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

let OTP_PHASE = false;
let PENDING_ID = '';
let PENDING_MOBILE = '';

function enterOtpPhase() {
  OTP_PHASE = true;
  document.getElementById('f-id').classList.add('hidden');
  document.getElementById('f-mob').classList.add('hidden');
  document.getElementById('f-otp').classList.remove('hidden');
  document.getElementById('backBtn').classList.remove('hidden');
  document.querySelector('#verifyBtn .btn-label').textContent = t('otpVerifyBtn');
  document.getElementById('otp').focus();
}

function exitOtpPhase() {
  OTP_PHASE = false;
  document.getElementById('f-id').classList.remove('hidden');
  document.getElementById('f-mob').classList.remove('hidden');
  document.getElementById('f-otp').classList.add('hidden');
  document.getElementById('backBtn').classList.add('hidden');
  document.getElementById('otp').value = '';
  const label = document.querySelector('#verifyBtn .btn-label');
  label.textContent = label.getAttribute(`data-${getLang()}`);
  hideAlert();
}

async function submitCredentials() {
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

    if (resp.status === 200 && data.ok && data.otpRequired) {
      PENDING_ID = idVal;
      PENDING_MOBILE = mobVal;
      enterOtpPhase();
      showAlert(t('otpSent'), 'info');
      return;
    }
    if (resp.status === 429) {
      showAlert(t('lockedOut'));
    } else if (resp.status === 502) {
      showAlert(t('otpSendFailed'));
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

async function submitOtp() {
  const code = digitsOnly(document.getElementById('otp').value);
  if (code.length !== 6) {
    showAlert(t('otpFormatError'));
    return;
  }
  hideAlert();

  const btn = document.getElementById('verifyBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const resp = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId: PENDING_ID, mobile: PENDING_MOBILE, code }),
    });
    const data = await resp.json();

    if (resp.status === 200 && data.ok) {
      sessionStorage.setItem('portal_just_verified', '1');
      window.location.href = '/landing';
      return;
    }
    if (data.error === 'otp_expired') showAlert(t('otpExpired'));
    else if (data.error === 'otp_locked' || resp.status === 429) showAlert(t('lockedOut'));
    else showAlert(t('otpInvalid'));
  } catch (err) {
    showAlert(t('serviceDown'));
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function verify() {
  if (OTP_PHASE) submitOtp();
  else submitCredentials();
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
  document.getElementById('backBtn').addEventListener('click', exitOtpPhase);
  document.getElementById('idEye').addEventListener('click', toggleId);
  document.getElementById('otp').addEventListener('input', (e) => {
    e.target.value = digitsOnly(e.target.value).slice(0, 6);
  });
  document.getElementById('otp').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') verify();
  });
  document.getElementById('langBtn').addEventListener('click', toggleLang);
});
