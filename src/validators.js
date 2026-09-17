'use strict';

const config = require('./config');

/**
 * Saudi National ID / Iqama format validation: exactly 10 digits, first
 * digit must be an accepted prefix (1 = national, 2 = resident/Iqama,
 * per config.acceptedIdPrefixes). No checksum -- format only.
 */
function isValidSaudiId(rawId) {
  const id = String(rawId || '').replace(/\D/g, '');
  if (id.length !== 10) return false;
  if (!config.acceptedIdPrefixes.includes(id[0])) return false;
  return true;
}

/** Strip everything but digits (used for both ID and mobile raw entry). */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Normalises a Saudi mobile number to the 9-digit national significant
 * number (5XXXXXXXX), accepting common variants: 05XXXXXXXX, 9665XXXXXXXX,
 * 009665XXXXXXXX, +9665XXXXXXXX (already digits-only by the time it is
 * typed/pasted client side, but we defend again here).
 * Returns the 9-digit NSN, or null if it can't be normalised to a valid
 * Saudi mobile number.
 */
function normalizeMobile(rawMobile) {
  let d = digitsOnly(rawMobile);

  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);

  if (d.length !== 9) return null;
  if (d[0] !== '5') return null;
  return d;
}

/** Canonical E.164 form used for storage/comparison: +9665XXXXXXXX */
function toE164(nsn) {
  return `+966${nsn}`;
}

module.exports = {
  isValidSaudiId,
  normalizeMobile,
  toE164,
};
