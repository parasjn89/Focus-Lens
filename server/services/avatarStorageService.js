import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

/**
 * Ensures the uploads/avatars directory exists.
 */
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Validates the raw binary buffer against genuine image magic bytes (signatures).
 * Does not trust client-provided MIME headers.
 *
 * Supported formats:
 * - JPEG/JPG: 0xFF, 0xD8, 0xFF
 * - PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
 * - WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
 *
 * @param {Buffer} buffer
 * @returns {{ valid: boolean, ext?: string, mime?: string, error?: string }}
 */
export function validateImageMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'Empty or invalid file payload.' };
  }

  if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 2MB limit. (Received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  // Check minimum header length
  if (buffer.length < 12) {
    return { valid: false, error: 'Unsupported or corrupted image file.' };
  }

  // 1. JPEG Check (FF D8 FF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, ext: 'jpg', mime: 'image/jpeg' };
  }

  // 2. PNG Check (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, ext: 'png', mime: 'image/png' };
  }

  // 3. WebP Check ('RIFF' at 0..3, 'WEBP' at 8..11)
  const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (isRiff && isWebp) {
    return { valid: true, ext: 'webp', mime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Unsupported image format. Allowed formats: JPG, JPEG, PNG, and WebP.',
  };
}

/**
 * Parses image buffer from base64 Data URL or raw Buffer.
 *
 * @param {string|Buffer} input
 * @returns {Buffer}
 */
export function parseImageInput(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === 'string') {
    const matches = input.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches[2]) {
      return Buffer.from(matches[2], 'base64');
    }
    // Attempt standard base64 decoding if raw base64 string provided
    return Buffer.from(input, 'base64');
  }

  throw new Error('Invalid image input provided.');
}

/**
 * Saves an avatar to storage (local disk) and cleans up old avatar if present.
 *
 * @param {string} userId
 * @param {string|Buffer} imageInput
 * @param {string} [oldAvatarPublicId]
 * @returns {Promise<{ avatarUrl: string, avatarPublicId: string }>}
 */
export async function saveAvatar(userId, imageInput, oldAvatarPublicId = null) {
  const buffer = parseImageInput(imageInput);
  const validation = validateImageMagicBytes(buffer);

  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  ensureUploadsDir();

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueTag = crypto.randomBytes(6).toString('hex');
  const filename = `avatar_${safeUserId}_${Date.now()}_${uniqueTag}.${validation.ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  // Clean up previous avatar if present
  if (oldAvatarPublicId) {
    await deleteAvatarFile(oldAvatarPublicId).catch(() => {});
  }

  const avatarUrl = `/api/uploads/avatars/${filename}`;
  return {
    avatarUrl,
    avatarPublicId: filename,
  };
}

/**
 * Deletes an avatar file from storage.
 *
 * @param {string} avatarPublicId
 * @returns {Promise<boolean>}
 */
export async function deleteAvatarFile(avatarPublicId) {
  if (!avatarPublicId || typeof avatarPublicId !== 'string') {
    return false;
  }

  // Prevent directory traversal attacks
  const safeFilename = path.basename(avatarPublicId);
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(safeFilename)) {
    return false;
  }

  const filePath = path.join(UPLOADS_DIR, safeFilename);
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
  } catch (err) {
    console.warn(`[Avatar Storage] Failed to delete avatar file ${safeFilename}:`, err.message);
  }
  return false;
}

/**
 * Gets path to an avatar file if it exists and filename is safe.
 *
 * @param {string} filename
 * @returns {string|null}
 */
export function getSafeAvatarPath(filename) {
  if (!filename || typeof filename !== 'string') return null;

  const safeFilename = path.basename(filename);
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(safeFilename)) {
    return null;
  }

  const filePath = path.join(UPLOADS_DIR, safeFilename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}
