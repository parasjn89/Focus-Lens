import crypto from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Returns a 32-byte Buffer to use as the AES-256 key.
 */
function getEncryptionKey() {
  if (config.googleTokenEncryptionKey) {
    const raw = config.googleTokenEncryptionKey.trim();
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    if (Buffer.byteLength(raw, 'utf8') === 32) {
      return Buffer.from(raw, 'utf8');
    }
    return crypto.createHash('sha256').update(raw).digest();
  }
  return crypto.createHash('sha256').update(config.sessionSecret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns formatted string: "iv:authTag:cipherText" in hex.
 */
export function encryptToken(plainText) {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Plaintext string is required for encryption.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM formatted string ("iv:authTag:cipherText").
 */
export function decryptToken(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') {
    throw new Error('Encrypted string is required for decryption.');
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format.');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
