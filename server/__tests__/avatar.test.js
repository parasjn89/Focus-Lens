import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { setCloudinaryUploader, resetCloudinaryUploader } from '../services/avatarStorageService.js';

describe('Profile Picture / Avatar Cloudinary Test Suite', () => {
  let app;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;

  // Track mock Cloudinary calls
  const mockUploads = [];
  const mockDestroys = [];

  const tag = () => Math.random().toString(36).substring(2, 7);

  // Helper: Create sample valid image base64 data URLs
  // Valid minimal 1x1 JPEG
  const validJpegBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
    0x3F, 0x00, 0x37, 0xFF, 0xD9
  ]);
  const validJpegDataUrl = `data:image/jpeg;base64,${validJpegBuffer.toString('base64')}`;

  // Valid minimal 1x1 PNG
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  const validPngDataUrl = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

  // Valid minimal WebP buffer
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4C, 0x0E, 0x00, 0x00, 0x00, 0x2F, 0x00, 0x00, 0x00,
    0x00, 0x07, 0x10, 0x11, 0x1B, 0x04, 0x00, 0x00
  ]);
  const validWebpDataUrl = `data:image/webp;base64,${validWebpBuffer.toString('base64')}`;

  // Mock Cloudinary Uploader
  const mockCloudinary = {
    upload: async (dataUri, options) => {
      mockUploads.push({ dataUriLength: dataUri.length, options });
      const version = Date.now();
      const folder = options.folder || 'focuslens/avatars';
      const publicId = `${folder}/${options.public_id || 'test_avatar'}`;
      return {
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/demo/image/upload/v${version}/${publicId}.jpg`,
        version,
        format: 'jpg',
        resource_type: 'image',
      };
    },
    destroy: async (publicId, options) => {
      mockDestroys.push({ publicId, options });
      return { result: 'ok' };
    },
  };

  before(async () => {
    // Set up mock Cloudinary before app initialization
    setCloudinaryUploader(mockCloudinary);

    app = buildApp({ logger: false });
    await app.ready();

    // Register User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User A',
        username: `avtr_a_${tag()}`,
        email: `avtr_a_${tag()}@example.com`,
        password: 'Password12345!',
        verificationMethod: 'EMAIL',
      },
    });
    assert.equal(resA.statusCode, 201);
    const bodyA = JSON.parse(resA.payload);
    userAId = bodyA.user.id;
    userACookie = `${resA.cookies[0].name}=${resA.cookies[0].value}`;

    // Register User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User B',
        username: `avtr_b_${tag()}`,
        email: `avtr_b_${tag()}@example.com`,
        password: 'Password12345!',
        verificationMethod: 'EMAIL',
      },
    });
    assert.equal(resB.statusCode, 201);
    const bodyB = JSON.parse(resB.payload);
    userBId = bodyB.user.id;
    userBCookie = `${resB.cookies[0].name}=${resB.cookies[0].value}`;
  });

  after(async () => {
    resetCloudinaryUploader();
    await app.close();
  });

  beforeEach(() => {
    // Reset mock tracking arrays
    mockUploads.length = 0;
    mockDestroys.length = 0;
    // Ensure default mock uploader is restored
    setCloudinaryUploader(mockCloudinary);
  });

  test('1. Default avatar when absent: new user has null avatarUrl and avatarPublicId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.avatarUrl, null);
    assert.equal(body.user.avatarPublicId, null);
  });

  test('2. Unauthenticated user cannot upload avatar (returns 401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      payload: { avatarData: validJpegDataUrl },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(mockUploads.length, 0, 'No Cloudinary upload should happen for unauthenticated requests');
  });

  test('3. Authenticated user can upload a valid JPEG profile picture -> uploaded to Cloudinary', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: validJpegDataUrl },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.user.avatarUrl);
    assert.match(body.user.avatarUrl, /^https:\/\/res\.cloudinary\.com\//);
    assert.ok(body.user.avatarPublicId);
    assert.match(body.user.avatarPublicId, /^focuslens\/avatars\/avatar_/);

    // Verify Cloudinary mock was called with correct folder and options
    assert.equal(mockUploads.length, 1);
    assert.equal(mockUploads[0].options.folder, 'focuslens/avatars');
    assert.equal(mockUploads[0].options.overwrite, true);
    assert.equal(mockUploads[0].options.invalidate, true);

    // Verify persistence in database
    const dbUser = await dbStore.getUserById(userAId);
    assert.equal(dbUser.avatarUrl, body.user.avatarUrl);
    assert.equal(dbUser.avatarPublicId, body.user.avatarPublicId);
  });

  test('4. Uploading a valid PNG profile picture replaces previous avatar and cleans up previous asset', async () => {
    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const oldPublicId = JSON.parse(meBefore.payload).user.avatarPublicId;
    const oldUrl = JSON.parse(meBefore.payload).user.avatarUrl;
    assert.ok(oldPublicId, 'User A should have an existing avatar');

    // Upload new PNG
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: validPngDataUrl },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.user.avatarUrl);
    assert.match(body.user.avatarUrl, /^https:\/\/res\.cloudinary\.com\//);
    // New version/URL returned
    assert.notEqual(body.user.avatarUrl, oldUrl);

    // Upload called
    assert.equal(mockUploads.length, 1);

    // Verify DB updated
    const dbUser = await dbStore.getUserById(userAId);
    assert.equal(dbUser.avatarUrl, body.user.avatarUrl);
  });

  test('5. Uploading a valid WebP profile picture succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: validWebpDataUrl },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.match(body.user.avatarUrl, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(mockUploads.length, 1);
  });

  test('6. Server rejects invalid/spoofed file format (e.g. text disguised as image) via magic byte check', async () => {
    const fakeDataUrl = 'data:image/jpeg;base64,' + Buffer.from('NOT AN IMAGE FILE CONTENT').toString('base64');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: fakeDataUrl },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /unsupported image format/i);
    assert.equal(mockUploads.length, 0, 'No Cloudinary upload on invalid magic bytes');
  });

  test('7. Server rejects oversized file exceeding 2MB limit', async () => {
    const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024);
    oversizedBuffer[0] = 0xFF;
    oversizedBuffer[1] = 0xD8;
    oversizedBuffer[2] = 0xFF;
    oversizedBuffer[3] = 0xE0;
    const oversizedDataUrl = `data:image/jpeg;base64,${oversizedBuffer.toString('base64')}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: oversizedDataUrl },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /exceeds the 2MB limit/i);
    assert.equal(mockUploads.length, 0);
  });

  test('8. Failed Cloudinary upload does NOT corrupt or modify existing avatar in database', async () => {
    // Record current user A avatar
    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const beforeAvatarUrl = JSON.parse(meBefore.payload).user.avatarUrl;
    assert.ok(beforeAvatarUrl);

    // Inject failing Cloudinary uploader
    setCloudinaryUploader({
      upload: async () => {
        throw new Error('Cloudinary API network timeout (simulated)');
      },
      destroy: async () => ({ result: 'ok' }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: validJpegDataUrl },
    });

    assert.equal(res.statusCode, 500);

    // Verify User A avatar in DB is completely untouched
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const afterAvatarUrl = JSON.parse(meAfter.payload).user.avatarUrl;
    assert.equal(afterAvatarUrl, beforeAvatarUrl, 'Existing avatar must remain intact when upload fails');
  });

  test('9. Strict User Isolation (IDOR Protection): User B cannot modify or delete User A\'s avatar', async () => {
    // Get User A's current avatar
    const resA = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const userAAvatar = JSON.parse(resA.payload).user.avatarUrl;
    assert.ok(userAAvatar);

    // User B attempts to delete avatar - affects only User B
    const resDelB = await app.inject({
      method: 'DELETE',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userBCookie },
    });
    assert.equal(resDelB.statusCode, 200);

    // User A's avatar must still be untouched!
    const resACheck = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const userAAvatarAfter = JSON.parse(resACheck.payload).user.avatarUrl;
    assert.equal(userAAvatarAfter, userAAvatar);

    // User B attempts to supply User A's userId in the body
    const resSpoof = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userBCookie },
      payload: {
        userId: userAId, // Attempted IDOR
        avatarData: validPngDataUrl,
      },
    });
    assert.equal(resSpoof.statusCode, 200);
    const bodySpoof = JSON.parse(resSpoof.payload);
    // Modified user MUST be User B, not User A
    assert.equal(bodySpoof.user.id, userBId);

    // User A's avatar still completely unchanged
    const resAVerify = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    assert.equal(JSON.parse(resAVerify.payload).user.avatarUrl, userAAvatar);
  });

  test('10. Removing avatar: DELETE /api/auth/profile/avatar clears URL and deletes asset from Cloudinary', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });
    const publicId = JSON.parse(meRes.payload).user.avatarPublicId;
    assert.ok(publicId);

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
    });
    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.payload);
    assert.equal(body.user.avatarUrl, null);
    assert.equal(body.user.avatarPublicId, null);

    // Cloudinary destroy called for publicId
    assert.equal(mockDestroys.length, 1);
    assert.equal(mockDestroys[0].publicId, publicId);

    // Database record cleared
    const dbUser = await dbStore.getUserById(userAId);
    assert.equal(dbUser.avatarUrl, null);
    assert.equal(dbUser.avatarPublicId, null);
  });

  test('11. Existing user profile fields (name, email, username) remain intact during avatar operations', async () => {
    const user = await dbStore.getUserById(userAId);
    const originalName = user.name;
    const originalEmail = user.email;
    const originalUsername = user.username;

    // Upload avatar
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userACookie },
      payload: { avatarData: validJpegDataUrl },
    });
    assert.equal(res.statusCode, 200);

    const updatedUser = await dbStore.getUserById(userAId);
    assert.equal(updatedUser.name, originalName);
    assert.equal(updatedUser.email, originalEmail);
    assert.equal(updatedUser.username, originalUsername);
  });

  test('12. Avatar persists across user logout and re-login', async () => {
    // User B has an avatar from previous test
    const upRes = await app.inject({
      method: 'POST',
      url: '/api/auth/profile/avatar',
      headers: { cookie: userBCookie },
      payload: { avatarData: validJpegDataUrl },
    });
    assert.equal(upRes.statusCode, 200);
    const uploadedUrl = JSON.parse(upRes.payload).user.avatarUrl;
    assert.ok(uploadedUrl);

    // Get User B's username
    const meB = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userBCookie },
    });
    const userBUsername = JSON.parse(meB.payload).user.username;

    // Log out User B
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: userBCookie },
    });
    assert.equal(logoutRes.statusCode, 200);

    // Log in User B again
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: userBUsername,
        password: 'Password12345!',
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    assert.equal(loginBody.user.avatarUrl, uploadedUrl);
  });

  test('13. Production Guard: In production/Vercel mode without Cloudinary, rejects with clear 500 error and NO filesystem writes', async () => {
    // Simulate production environment with no Cloudinary configured
    const origNodeEnv = process.env.NODE_ENV;
    const origVercel = process.env.VERCEL;
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';

    // Clear custom uploader to simulate unconfigured Cloudinary in production
    setCloudinaryUploader(null);

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/profile/avatar',
        headers: { cookie: userACookie },
        payload: { avatarData: validJpegDataUrl },
      });

      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.payload);
      assert.match(body.message, /CLOUDINARY_CLOUD_NAME/i);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origVercel !== undefined) {
        process.env.VERCEL = origVercel;
      } else {
        delete process.env.VERCEL;
      }
      setCloudinaryUploader(mockCloudinary);
    }
  });

  test('14. Privacy Guard continues to strictly reject media payloads on session endpoints', async () => {
    const forbiddenPayloads = [
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', video: 'webcam_video_stream' },
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', image: 'raw_frame_blob' },
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', screenshot: 'screen_capture' },
    ];

    for (const payload of forbiddenPayloads) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { cookie: userACookie },
        payload,
      });
      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.error, 'Privacy Violation');
    }
  });
});
