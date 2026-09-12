'use strict';

const config = require('./config');

/**
 * Saudi National ID / Iqama checksum validation (Appendix A of the BRD).
 * Luhn-style check: double every digit at an even index (0-based, i.e. 1st,
 * 3rd, 5th... position), sum digits of the result, total must be a
 * multiple of 10.
 */
function isValidSaudiId(rawId) {
  const id = String(rawId || '').replace(/\D/g, '');
  if (id.length !== 10) return false;
  if (!config.acceptedIdPrefixes.includes(id[0])) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(id[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
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

function isValidMobile(rawMobile) {
  return normalizeMobile(rawMobile) !== null;
}

module.exports = {
  isValidSaudiId,
  digitsOnly,
  normalizeMobile,
  toE164,
  isValidMobile,
};
