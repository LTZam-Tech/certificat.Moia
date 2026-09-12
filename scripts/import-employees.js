#!/usr/bin/env node
'use strict';

// CLI usage: node scripts/import-employees.js path/to/employees.xlsx (or .csv)
const fs = require('fs');
const path = require('path');
const { importEmployeesCsv } = require('../src/csvImport');
const { importEmployeesXlsx } = require('../src/xlsxImport');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import-employees.js <employees.xlsx | employees.csv>');
  console.error('Sheet/CSV must have a column containing "ID" and one containing "mobile" (header row required).');
  process.exit(1);
}

const resolved = path.resolve(file);
const ext = path.extname(resolved).toLowerCase();

const result = ext === '.xlsx'
  ? importEmployeesXlsx(fs.readFileSync(resolved))
  : importEmployeesCsv(fs.readFileSync(resolved, 'utf8'));

console.log(`Imported: ${result.imported}`);
console.log(`Skipped: ${result.skipped.length}`);
result.skipped.forEach((s) => console.log(`  row ${s.row ?? s.line}: ${s.reason}`));
