#!/usr/bin/env node
'use strict';

// Seeds one demo employee and a few placeholder certificate files, purely
// for local testing/demoing the portal. Not for production use.
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const employeeRepo = require('../src/employeeRepo');
const adminAuth = require('../src/adminAuth');
const { toE164 } = require('../src/validators');

const DEMO_ID = '1012345672'; // passes the Appendix A checksum
const DEMO_MOBILE = toE164('512345678');
const DEMO_ADMIN_USER = 'admin';
const DEMO_ADMIN_PASS = 'ChangeMe#2026';

employeeRepo.upsert(DEMO_ID, DEMO_MOBILE);

// Only seed a throwaway demo admin if no admin account exists yet -- never
// overwrite/clutter a real one that's already been set via seed-admin.js.
const skippedAdminSeed = adminAuth.adminCount() > 0;
if (!skippedAdminSeed) adminAuth.upsertAdmin(DEMO_ADMIN_USER, DEMO_ADMIN_PASS);

fs.mkdirSync(config.sharedFolderPath, { recursive: true });
const files = [`${DEMO_ID}-1.pdf`, `${DEMO_ID}-2.pdf`, `${DEMO_ID}-3.pdf`];
for (const f of files) {
  fs.writeFileSync(path.join(config.sharedFolderPath, f), `%PDF-1.4\n% Demo placeholder for ${f}\n`);
}

console.log('Seeded demo employee:');
console.log(`  National ID: ${DEMO_ID}`);
console.log(`  Mobile:      0${DEMO_MOBILE.slice(4)}  (enter as 5${DEMO_MOBILE.slice(5)} on the login form)`);
console.log(`Seeded ${files.length} placeholder certificate files in ${config.sharedFolderPath}`);
console.log('');
if (skippedAdminSeed) {
  console.log('Admin account already exists -- left untouched.');
} else {
  console.log('Seeded demo admin account (change this before going live):');
  console.log(`  Username: ${DEMO_ADMIN_USER}`);
  console.log(`  Password: ${DEMO_ADMIN_PASS}`);
  console.log('  -> node scripts/seed-admin.js <username> <password>  to set a real one');
}
