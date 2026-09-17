import crypto from 'crypto';

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateNumericOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash a verification token or OTP with SHA-256 before database storage
 */
export function hashVerificationToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Normalize and validate phone numbers to E.164 format (e.g., +14155552671 or +919876543210)
 */
export function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  let cleaned = String(phoneNumber).trim().replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  } else if (!cleaned.startsWith('+')) {
    // Default to + if missing
    cleaned = '+' + cleaned;
  }

  // E.164 format regex: + followed by 7 to 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    const err = new Error('Invalid phone number format. Please provide a valid E.164 international phone number (e.g. +919876543210 or +14155552671).');
    err.statusCode = 400;
    throw err;
  }

  return cleaned;
}

/**
 * Format email address to lowercase and trimmed
 */
export function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}
