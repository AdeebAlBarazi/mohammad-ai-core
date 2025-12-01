// utils/cryptoBank.js
// AES-256-GCM encryption utilities for bank info objects
const crypto = require('crypto');

function getRawKey() {
  const key = process.env.BANK_INFO_ENC_KEY || '';
  if (!key) return null;
  // Derive 32-byte key from provided secret using SHA-256 to be flexible
  return crypto.createHash('sha256').update(String(key), 'utf8').digest();
}

function hasKey() {
  return !!getRawKey();
}

function encryptObject(obj) {
  const key = getRawKey();
  if (!key) throw new Error('BANK_INFO_ENC_KEY is not set');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64')
  };
}

function decryptToObject(enc) {
  if (!enc) return null;
  try {
    // Accept either stringified JSON or object
    const payload = typeof enc === 'string' ? JSON.parse(enc) : enc;
    if (payload && payload.alg === 'aes-256-gcm' && payload.ct) {
      const key = getRawKey();
      if (!key) throw new Error('BANK_INFO_ENC_KEY is not set');
      const iv = Buffer.from(payload.iv, 'base64');
      const tag = Buffer.from(payload.tag, 'base64');
      const ct = Buffer.from(payload.ct, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return JSON.parse(pt.toString('utf8'));
    }
    // Fallback: if it was stored as plain JSON, return as-is
    if (typeof payload === 'object') return payload;
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = { hasKey, encryptObject, decryptToObject };
