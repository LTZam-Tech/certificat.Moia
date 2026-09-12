'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  national_id   TEXT PRIMARY KEY,
  mobile_e164   TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile_e164);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  national_id_hash TEXT,
  national_id_last4 TEXT,
  event_type    TEXT NOT NULL,      -- login_success | login_failure | download | lockout
  file_ref      TEXT,
  source_ip     TEXT,
  detail        TEXT
);

CREATE TABLE IF NOT EXISTS failed_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  key_type      TEXT NOT NULL,      -- 'id' | 'ip'
  key_value     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_failed_key ON failed_attempts(key_type, key_value, ts);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  national_id   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  source_ip     TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  username      TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
