'use strict';

const db = require('./db');

const getByIdStmt = db.prepare('SELECT * FROM employees WHERE national_id = ? AND active = 1');
const upsertStmt = db.prepare(`
  INSERT INTO employees (national_id, mobile_e164, active, updated_at)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(national_id) DO UPDATE SET
    mobile_e164 = excluded.mobile_e164,
    active = 1,
    updated_at = datetime('now')
`);
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM employees');
const listAllStmt = db.prepare('SELECT national_id, mobile_e164, updated_at FROM employees ORDER BY updated_at DESC');
const removeByIdStmt = db.prepare('DELETE FROM employees WHERE national_id = ?');
const removeAllStmt = db.prepare('DELETE FROM employees');

function findById(nationalId) {
  return getByIdStmt.get(nationalId);
}

/** Returns the employee record only if BOTH the ID and mobile match the same record (BRD 5.1). */
function verifyPair(nationalId, mobileE164) {
  const emp = findById(nationalId);
  if (!emp) return null;
  if (emp.mobile_e164 !== mobileE164) return null;
  return emp;
}

function upsert(nationalId, mobileE164) {
  upsertStmt.run(nationalId, mobileE164);
}

function count() {
  return countStmt.get().n;
}

function listAll() {
  return listAllStmt.all();
}

function removeById(nationalId) {
  const result = removeByIdStmt.run(nationalId);
  return result.changes > 0;
}

function removeAll() {
  const result = removeAllStmt.run();
  return result.changes;
}

module.exports = { findById, verifyPair, upsert, count, listAll, removeById, removeAll };
