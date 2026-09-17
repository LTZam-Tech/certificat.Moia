'use strict';

const db = require('./db');
const config = require('./config');

const { maxAttempts, lockoutMinutes } = config.lockout;

const countStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM failed_attempts
  WHERE key_type = ? AND key_value = ? AND ts >= datetime('now', ?)
`);
const insertStmt = db.prepare(`
  INSERT INTO failed_attempts (key_type, key_value) VALUES (?, ?)
`);
const clearStmt = db.prepare(`
  DELETE FROM failed_attempts WHERE key_type = ? AND key_value = ?
`);

function windowParam(minutes) {
  return `-${minutes} minutes`;
}

/** Returns true if the given identifier (national ID or IP) is currently locked out. */
function isLockedOut(keyType, keyValue) {
  const row = countStmt.get(keyType, keyValue, windowParam(lockoutMinutes));
  return row.n >= maxAttempts;
}

function recordFailure(keyType, keyValue) {
  insertStmt.run(keyType, keyValue);
}

function clearFailures(keyType, keyValue) {
  clearStmt.run(keyType, keyValue);
}

/** Checks both the National ID and source IP throttles. */
function checkLockout(nationalId, sourceIp) {
  return isLockedOut('id', nationalId) || isLockedOut('ip', sourceIp);
}

function recordFailedAttempt(nationalId, sourceIp) {
  recordFailure('id', nationalId);
  recordFailure('ip', sourceIp);
}

function clearAttempts(nationalId, sourceIp) {
  clearFailures('id', nationalId);
  clearFailures('ip', sourceIp);
}

/** Same throttle, keyed for admin login attempts (separate counters from employee login). */
function checkAdminLockout(username, sourceIp) {
  return isLockedOut('admin_user', username) || isLockedOut('admin_ip', sourceIp);
}

function recordAdminFailedAttempt(username, sourceIp) {
  recordFailure('admin_user', username);
  recordFailure('admin_ip', sourceIp);
}

function clearAdminAttempts(username, sourceIp) {
  clearFailures('admin_user', username);
  clearFailures('admin_ip', sourceIp);
}

module.exports = {
  checkLockout,
  recordFailedAttempt,
  clearAttempts,
  checkAdminLockout,
  recordAdminFailedAttempt,
  clearAdminAttempts,
};
