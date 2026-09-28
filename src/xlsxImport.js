'use strict';

const employeeRepo = require('./employeeRepo');
const { isValidSaudiId, normalizeMobile, toE164 } = require('./validators');
const { readFirstSheetRows } = require('./xlsxReader');

/**
 * Imports employee master data from an .xlsx buffer. Expects a header row
 * containing one column whose header contains "id" and one whose header
 * contains "mobile" (case-insensitive) -- matches the ministry's actual
 * export format (columns "ID", "Mobile Number", no name column).
 * Returns { imported, skipped: [{ row, reason }] }.
 */
function importEmployeesXlsx(buffer) {
  const rows = readFirstSheetRows(buffer);
  if (rows.length === 0) return { imported: 0, skipped: [] };

  const header = rows[0].map((h) => (h || '').toString().trim().toLowerCase());
  const idIdx = header.findIndex((h) => h.includes('id'));
  const mobileIdx = header.findIndex((h) => h.includes('mobile'));
  // Optional -- older sheets (and the ministry's original export) may not
  // have these; certificate generation just won't have a name/department
  // to print until an employee's row is re-imported with them included.
  const nameIdx = header.findIndex((h) => h.includes('name'));
  const deptIdx = header.findIndex((h) => h.includes('department'));

  if (idIdx === -1 || mobileIdx === -1) {
    throw new Error('Could not find ID / Mobile columns in the sheet header.');
  }

  const seenIds = new Set();
  let imported = 0;
  const skipped = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawId = (row[idIdx] ?? '').toString().trim();
    const rawMobile = (row[mobileIdx] ?? '').toString().trim();

    if (!rawId && !rawMobile) continue; // blank trailing row

    if (!isValidSaudiId(rawId)) {
      skipped.push({ row: i + 1, reason: 'invalid national_id' });
      continue;
    }
    const nsn = normalizeMobile(rawMobile);
    if (!nsn) {
      skipped.push({ row: i + 1, reason: 'invalid mobile' });
      continue;
    }
    if (seenIds.has(rawId)) {
      skipped.push({ row: i + 1, reason: 'duplicate national_id' });
      continue;
    }
    seenIds.add(rawId);

    const name = nameIdx === -1 ? null : (row[nameIdx] ?? '').toString().trim() || null;
    const department = deptIdx === -1 ? null : (row[deptIdx] ?? '').toString().trim() || null;
    employeeRepo.upsert(rawId, toE164(nsn), name, department);
    imported++;
  }

  return { imported, skipped };
}

module.exports = { importEmployeesXlsx };
