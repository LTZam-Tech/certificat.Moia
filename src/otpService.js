'use strict';

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const smsService = require('./smsService');

const OTP_TTL_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const upsertStmt = db.prepare(`
  INSERT INTO otp_codes (national_id, code_hash, expires_at, attempts)
  VALUES (?, ?, datetime('now', ?), 0)
  ON CONFLICT(national_id) DO UPDATE SET
    code_hash = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts = 0,
    created_at = datetime('now')
`);
const getStmt = db.prepare('SELECT * FROM otp_codes WHERE national_id = ?');
const bumpAttemptsStmt = db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE national_id = ?');
const deleteStmt = db.prepare('DELETE FROM otp_codes WHERE national_id = ?');

/** HMAC rather than a bare hash -- codes are only 6 digits, so a keyed
 * function (using the app's own private secret) is what actually makes
 * a stolen otp_codes table useless without the server's secret too. */
function hashCode(code) {
  return crypto.createHmac('sha256', config.sessionSecret).update(code).digest('hex');
}

/** Generates a fresh OTP for this National ID, stores it, and texts it to
 * the given (already-verified) mobile number. Overwrites any prior code. */
async function issueOtp(nationalId, mobileE164) {
  const code = smsService.generateOtpCode();
  upsertStmt.run(nationalId, hashCode(code), `+${OTP_TTL_MINUTES} minutes`);
  const message = `رمز التحقق الخاص ببوابة الشهادات: ${code} (صالح لمدة ${OTP_TTL_MINUTES} دقائق) / Your Certificate Portal verification code: ${code}`;
  await smsService.sendSms({ number: mobileE164, message });
}

/**
 * Checks a submitted code against the stored one. Returns:
 *  'ok'      - correct, not expired -- caller should consume it and log in
 *  'invalid' - wrong code (attempt already recorded)
 *  'expired' - no code on file, or past its TTL
 *  'locked'  - too many wrong attempts against this code
 */
function verifyOtp(nationalId, submittedCode) {
  const row = getStmt.get(nationalId);
  if (!row) return 'expired';
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) return 'locked';

  const isExpired = new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now();
  if (isExpired) {
    deleteStmt.run(nationalId);
    return 'expired';
  }

  if (hashCode(submittedCode) !== row.code_hash) {
    bumpAttemptsStmt.run(nationalId);
    return 'invalid';
  }

  deleteStmt.run(nationalId);
  return 'ok';
}

module.exports = { issueOtp, verifyOtp };
