'use strict';

function el(id) { return document.getElementById(id); }

async function api(path, opts) {
  const resp = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts));
  return resp;
}

function showLoggedOut() {
  el('loginPanel').classList.remove('hidden');
  el('adminPanel').classList.add('hidden');
  el('logoutBtn').classList.add('hidden');
}

function showLoggedIn() {
  el('loginPanel').classList.add('hidden');
  el('adminPanel').classList.remove('hidden');
  el('logoutBtn').classList.remove('hidden');
}

async function checkAuth() {
  const resp = await api('/admin/api/audit');
  if (resp.ok) {
    showLoggedIn();
    renderAudit(await resp.json());
    loadEmployees();
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
    msg.textContent = 'Too many failed attempts. Try again later.';
  } else {
    msg.textContent = 'Invalid username or password.';
  }
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
      <td><button class="rowbtn" data-id="${r.national_id}">Remove</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.rowbtn').forEach((btn) => {
    btn.addEventListener('click', () => removeEmployee(btn.getAttribute('data-id')));
  });
}

async function removeEmployee(nationalId) {
  if (!confirm(`Remove employee ${nationalId}? They will no longer be able to sign in.`)) return;
  await api(`/admin/api/employees?id=${encodeURIComponent(nationalId)}`, { method: 'DELETE' });
  loadEmployees();
}

async function clearAllEmployees() {
  if (!confirm('Remove ALL employees from the system? This cannot be undone — you will need to re-import the sheet.')) return;
  const resp = await api('/admin/api/employees/clear', { method: 'POST' });
  const data = await resp.json();
  el('importMsg').className = 'msg ok';
  el('importMsg').textContent = `Removed ${data.removed} employee(s).`;
  loadEmployees();
}

async function importXlsx(file) {
  const msg = el('importMsg');
  msg.className = 'msg';
  msg.textContent = 'Importing…';
  const buffer = await file.arrayBuffer();
  const resp = await api('/admin/api/employees/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  const data = await resp.json();
  if (resp.ok) {
    msg.className = 'msg ok';
    msg.textContent = `Imported ${data.imported} record(s). Skipped ${data.skipped.length}.` +
      (data.skipped.length ? ` First issue: row ${data.skipped[0].row} — ${data.skipped[0].reason}` : '');
    loadEmployees();
  } else {
    msg.className = 'msg err';
    msg.textContent = data.error || 'Import failed.';
  }
}

function renderAudit(rows) {
  const tbody = document.querySelector('#auditTable tbody');
  tbody.innerHTML = rows.map((r) => `<tr>
    <td>${r.ts}</td><td>${r.event_type}</td><td>${r.national_id_last4 || ''}</td>
    <td>${r.file_ref || ''}</td><td>${r.source_ip || ''}</td><td>${r.detail || ''}</td>
  </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
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

  checkAuth();
});
