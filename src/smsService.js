'use strict';

const https = require('https');
const crypto = require('crypto');
const config = require('./config');

const SMS_HOST = 'services.rich.sa';
const SMS_PATH = '/RiCHClientServiceREST.svc/SendSmsLoginPost';

/**
 * Sends an SMS via the RiCH gateway. The gateway's own account credentials
 * travel in the request body on every call (per its API contract) rather
 * than a separate auth step -- config.sms holds those, never the
 * recipient's own login credentials.
 * Returns the raw response body text; the gateway's success/failure
 * signal isn't documented anywhere we have, so callers should log the
 * first real response and adjust once its shape is known.
 */
function sendSms({ number, message }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      username: config.sms.username,
      password: config.sms.password,
      message,
      sender: config.sms.sender,
      number,
    });

    const req = https.request(
      {
        hostname: SMS_HOST,
        path: SMS_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body });
          } else {
            reject(new Error(`SMS gateway returned ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** Generates a cryptographically random 6-digit numeric OTP code. */
function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

module.exports = { sendSms, generateOtpCode };
