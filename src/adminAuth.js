'use strict';

const crypto = require('crypto');
const db = require('./db');

const COOKIE_NAME = 'portal_admin';
const SESSION_IDLE_MINUTES = 60;
const SCRYPT_KEYLEN = 64;

// token -> { username, expiresAt }
const sessions = new Map();

const getAdminStmt = db.prepare('SELECT * FROM admins WHERE username = ?');
const upsertAdminStmt = db.prepare(`
  INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)
  ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt
`);
const countAdminsStmt = db.prepare('SELECT COUNT(*) AS n FROM admins');
const deleteAdminStmt = db.prepare('DELETE FROM admins WHERE username = ?');

function hash(password, salt) {
  return crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
}

/** Creates or updates an admin account. Used by scripts/seed-admin.js. */
function upsertAdmin(username, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hash(password, salt);
  upsertAdminStmt.run(username, passwordHash, salt);
}

function removeAdmin(username) {
  deleteAdminStmt.run(username);
}

function adminCount() {
  return countAdminsStmt.get().n;
}

/** Verifies username+password against the DB. Returns true/false. */
function verifyCredentials(username, password) {
  const row = getAdminStmt.get(String(username || ''));
  if (!row) return false;
  const candidate = hash(password, row.salt);
  const expected = Buffer.from(row.password_hash, 'hex');
  const got = Buffer.from(candidate, 'hex');
  if (expected.length !== got.length) return false;
  return crypto.timingSafeEqual(expected, got);
}

function issueToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_IDLE_MINUTES * 60 * 1000 });
  return token;
}

function revokeToken(token) {
  sessions.delete(token);
}

/** Returns the admin username for a valid, non-expired session, refreshing its idle timeout. */
function resolveSession(token) {
  if (!token) return null;
  const entry = sessions.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(token);
    return null;
  }
  entry.expiresAt = Date.now() + SESSION_IDLE_MINUTES * 60 * 1000;
  return entry.username;
}

module.exports = {
  COOKIE_NAME,
  upsertAdmin,
  removeAdmin,
  adminCount,
  verifyCredentials,
  issueToken,
  revokeToken,
  resolveSession,
};
