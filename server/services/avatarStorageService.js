import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { config, isCloudinaryConfigured } from '../config/env.js';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

// Internal custom uploader reference for testing and dependency injection
let customUploader = null;

/**
 * Injects a mock or custom Cloudinary uploader instance (for automated tests).
 * @param {{ upload: Function, destroy: Function } | null} uploader
 */
export function setCloudinaryUploader(uploader) {
  customUploader = uploader;
}

/**
 * Resets any custom Cloudinary uploader back to default.
 */
export function resetCloudinaryUploader() {
  customUploader = null;
}

/**
 * Returns the active Cloudinary uploader instance, configuring it if needed.
 */
export function getActiveCloudinaryUploader() {
  if (customUploader) {
    return customUploader;
  }
  const cloudName = (config.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (config.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (config.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET || '').trim();
  const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();

  if (cloudinaryUrl) {
    cloudinary.config({ secure: true });
    return cloudinary.uploader;
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return cloudinary.uploader;
  }
  return null;
}

/**
 * Checks if Cloudinary is active (configured via env or custom mock uploader set).
 */
export function isCloudinaryActive() {
  return Boolean(customUploader || isCloudinaryConfigured());
}

/**
 * Ensures the uploads/avatars directory exists for local development fallback only.
 * Never executes in production or Vercel serverless environments.
 */
function ensureUploadsDir() {
  const isProductionOrVercel = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProductionOrVercel) {
    return;
  }
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[Avatar Storage] Failed to ensure local uploads dir:', err?.message);
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
 * Saves an avatar to Cloudinary persistent storage (or local disk fallback in local dev).
 * Cleans up old avatar asset if present after successful upload.
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

  const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  const uploader = getActiveCloudinaryUploader();

  // 1. Production / Cloudinary Path
  if (uploader) {
    const dataUri = `data:${validation.mime};base64,${buffer.toString('base64')}`;
    const publicId = `avatar_${safeUserId}`;

    const result = await uploader.upload(dataUri, {
      folder: 'focuslens/avatars',
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      transformation: [
        { width: 512, height: 512, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
      ],
    });

    const avatarUrl = result.secure_url;
    const avatarPublicId = result.public_id;

    // Clean up previous avatar asset if old public ID was different
    // (If public ID was the same, Cloudinary overwrite: true already cleanly replaced it in-place)
    if (oldAvatarPublicId && oldAvatarPublicId !== avatarPublicId) {
      await deleteAvatarFile(oldAvatarPublicId).catch((cleanupErr) => {
        console.warn('[Avatar Storage] Failed to clean up previous avatar asset:', cleanupErr?.message);
      });
    }

    return {
      avatarUrl,
      avatarPublicId,
    };
  }

  // 2. Production Guard: Never attempt local disk in production or Vercel
  const isProductionOrVercel = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProductionOrVercel) {
    const err = new Error(
      'Cloud storage is not configured for production uploads. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Vercel environment variables.'
    );
    err.statusCode = 500;
    throw err;
  }

  // 3. Local Development Fallback ONLY (when not in production/Vercel and Cloudinary not configured)
  console.warn('[Avatar Storage] Warning: Cloudinary is not configured. Falling back to local disk storage for development.');
  ensureUploadsDir();

  const uniqueTag = crypto.randomBytes(6).toString('hex');
  const filename = `avatar_${safeUserId}_${Date.now()}_${uniqueTag}.${validation.ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  if (oldAvatarPublicId && oldAvatarPublicId !== filename) {
    await deleteAvatarFile(oldAvatarPublicId).catch(() => {});
  }

  const avatarUrl = `/api/uploads/avatars/${filename}`;
  return {
    avatarUrl,
    avatarPublicId: filename,
  };
}

/**
 * Deletes an avatar asset from Cloudinary (or local storage if local dev fallback).
 *
 * @param {string} avatarPublicId
 * @returns {Promise<boolean>}
 */
export async function deleteAvatarFile(avatarPublicId) {
  if (!avatarPublicId || typeof avatarPublicId !== 'string') {
    return false;
  }

  const uploader = getActiveCloudinaryUploader();

  // If Cloudinary is active or if the public_id looks like a Cloudinary asset
  if (uploader && (avatarPublicId.startsWith('focuslens/') || !avatarPublicId.includes('.'))) {
    try {
      await uploader.destroy(avatarPublicId, {
        invalidate: true,
        resource_type: 'image',
      });
      return true;
    } catch (err) {
      console.warn(`[Avatar Storage] Failed to delete Cloudinary asset ${avatarPublicId}:`, err?.message);
      return false;
    }
  }

  // Local fallback deletion (local dev only)
  const isProductionOrVercel = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProductionOrVercel) {
    return false;
  }

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
    console.warn(`[Avatar Storage] Failed to delete local avatar file ${safeFilename}:`, err?.message);
  }
  return false;
}

export const deleteAvatar = deleteAvatarFile;

/**
 * Gets path to an avatar file if it exists and filename is safe (local dev/legacy only).
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

  try {
    const filePath = path.join(UPLOADS_DIR, safeFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  } catch {
    return null;
  }
  return null;
}
