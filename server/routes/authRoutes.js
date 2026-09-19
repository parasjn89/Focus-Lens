import {
  register,
  login,
  googleAuth,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  deleteAccount,
  sendEmailVerification,
  verifyEmail,
  sendPhoneVerification,
  verifyPhone,
  switchVerificationMethod,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  checkUsername,
  uploadAvatar,
  removeAvatar,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { getSafeAvatarPath } from '../services/avatarStorageService.js';
import fs from 'fs';
import path from 'path';

export async function authRoutes(fastify, options) {
  fastify.post('/api/auth/register', register);
  fastify.post('/api/auth/login', login);
  fastify.post('/api/auth/google', googleAuth);
  fastify.post('/api/auth/logout', logout);
  fastify.get('/api/auth/check-username', checkUsername);

  fastify.get('/api/auth/me', { preHandler: requireAuth }, getCurrentUser);
  fastify.put('/api/auth/profile', { preHandler: requireAuth }, updateProfile);
  fastify.post('/api/auth/change-password', { preHandler: requireAuth }, changePassword);
  fastify.delete('/api/account', { preHandler: requireAuth }, deleteAccount);

  // Profile Picture / Avatar Endpoints
  fastify.post('/api/auth/profile/avatar', {
    preHandler: requireAuth,
    bodyLimit: 5242880, // 5MB payload limit for avatars
  }, uploadAvatar);
  fastify.delete('/api/auth/profile/avatar', { preHandler: requireAuth }, removeAvatar);

  // Serve Avatar Images Safely with security headers
  fastify.get('/api/uploads/avatars/:filename', async (request, reply) => {
    const { filename } = request.params;
    const filePath = getSafeAvatarPath(filename);

    if (!filePath) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Avatar image not found.',
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);

    reply.header('Content-Type', mimeType);
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(stream);
  });

  // Account Verification Endpoints
  fastify.post('/api/auth/send-email-verification', { preHandler: requireAuth }, sendEmailVerification);
  fastify.post('/api/auth/verify-email', { preHandler: requireAuth }, verifyEmail);
  fastify.post('/api/auth/send-phone-verification', { preHandler: requireAuth }, sendPhoneVerification);
  fastify.post('/api/auth/verify-phone', { preHandler: requireAuth }, verifyPhone);
  fastify.post('/api/auth/switch-verification-method', { preHandler: requireAuth }, switchVerificationMethod);

  // Password Reset Endpoints
  fastify.post('/api/auth/forgot-password', forgotPassword);
  fastify.post('/api/auth/verify-reset-token', verifyResetToken);
  fastify.post('/api/auth/reset-password', resetPassword);
}


