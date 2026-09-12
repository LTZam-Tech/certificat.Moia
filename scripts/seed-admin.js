#!/usr/bin/env node
'use strict';

// CLI usage: node scripts/seed-admin.js <username> <password>
// Creates the admin account (or resets its password if it already exists).
const adminAuth = require('../src/adminAuth');

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: node scripts/seed-admin.js <username> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

adminAuth.upsertAdmin(username, password);
console.log(`Admin account "${username}" created/updated.`);
