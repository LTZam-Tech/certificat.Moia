'use strict';

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function hashId(nationalId) {
  if (!nationalId) return null;
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(nationalId)
    .digest('hex');
}

function last4(nationalId) {
  if (!nationalId) return null;
  return nationalId.slice(-4);
}

const insertStmt = db.prepare(`
  INSERT INTO audit_log (national_id_hash, national_id_last4, event_type, file_ref, source_ip, detail)
  VALUES (?, ?, ?, ?, ?, ?)
`);

/**
 * Records an audit event. Per BRD 5.9, the National ID is never logged in
 * plaintext -- only a salted hash (for correlating a person's own history)
 * and the last 4 digits (for support/debugging).
 */
function log(eventType, { nationalId = null, fileRef = null, sourceIp = null, detail = null } = {}) {
  insertStmt.run(hashId(nationalId), last4(nationalId), eventType, fileRef, sourceIp, detail);
}

function recentEntries(limit = 100) {
  return db
    .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(limit);
}

module.exports = { log, recentEntries, hashId, last4 };
