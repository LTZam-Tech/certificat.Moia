'use strict';

const employeeRepo = require('./employeeRepo');
const { isValidSaudiId, normalizeMobile, toE164 } = require('./validators');

/**
 * Parses and imports employee master data. Expected CSV columns (header
 * required): national_id,mobile
 * Returns { imported, skipped: [{ line, reason }] }.
 */
function importEmployeesCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { imported: 0, skipped: [] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idxId = header.indexOf('national_id');
  const idxMobile = header.indexOf('mobile');

  if (idxId === -1 || idxMobile === -1) {
    throw new Error('CSV header must include: national_id,mobile');
  }

  const seenIds = new Set();
  let imported = 0;
  const skipped = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rawId = (cols[idxId] || '').trim();
    const rawMobile = (cols[idxMobile] || '').trim();

    if (!isValidSaudiId(rawId)) {
      skipped.push({ line: i + 1, reason: 'invalid national_id' });
      continue;
    }
    const nsn = normalizeMobile(rawMobile);
    if (!nsn) {
      skipped.push({ line: i + 1, reason: 'invalid mobile' });
      continue;
    }

    if (seenIds.has(rawId)) {
      skipped.push({ line: i + 1, reason: 'duplicate national_id' });
      continue;
    }
    seenIds.add(rawId);

    const mobileE164 = toE164(nsn);
    employeeRepo.upsert(rawId, mobileE164);
    imported++;
  }

  return { imported, skipped };
}

module.exports = { importEmployeesCsv };
