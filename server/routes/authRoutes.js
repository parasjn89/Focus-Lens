import {
  register,
  login,
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
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export async function authRoutes(fastify, options) {
  fastify.post('/api/auth/register', register);
  fastify.post('/api/auth/login', login);
  fastify.post('/api/auth/logout', logout);
  fastify.get('/api/auth/check-username', checkUsername);

  fastify.get('/api/auth/me', { preHandler: requireAuth }, getCurrentUser);
  fastify.put('/api/auth/profile', { preHandler: requireAuth }, updateProfile);
  fastify.post('/api/auth/change-password', { preHandler: requireAuth }, changePassword);
  fastify.delete('/api/account', { preHandler: requireAuth }, deleteAccount);

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


