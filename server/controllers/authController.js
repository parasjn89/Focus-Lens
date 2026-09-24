import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { dbStore } from '../db/store.js';
import {
  generateNumericOTP,
  hashVerificationToken,
  normalizePhoneNumber,
} from '../utils/verificationUtils.js';
import { sendEmailVerificationChallenge, sendEmailPasswordResetLink, sendEmailPasswordResetOtp } from '../services/emailService.js';
import { sendSmsOtpChallenge, sendSmsPasswordResetOtp } from '../services/smsService.js';
import { saveAvatar, deleteAvatarFile } from '../services/avatarStorageService.js';
import { verifyFirebaseIdToken, getFirebaseAuth, isFirebaseAdminConfigured } from '../services/firebaseAuth.js';


export function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username || null,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    avatarPublicId: user.avatarPublicId || null,
    phoneNumber: user.phoneNumber || null,
    preferredVerificationMethod: user.preferredVerificationMethod || 'EMAIL',
    verificationStatus: user.verificationStatus || 'UNVERIFIED',
    emailVerifiedAt: user.emailVerifiedAt || null,
    phoneVerifiedAt: user.phoneVerifiedAt || null,
    hasPassword: Boolean(user.passwordHash),
    isGoogleLinked: Boolean(user.googleId),
    createdAt: user.createdAt,
  };
}

export function validateUsernameFormat(username) {
  if (!username || typeof username !== 'string') {
    return 'Username is required.';
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return 'Username must be between 3 and 30 characters long.';
  }
  const usernameRegex = /^[a-zA-Z0-9._]+$/;
  if (!usernameRegex.test(trimmed)) {
    return 'Username can only contain letters, numbers, underscores, and periods.';
  }
  return null;
}

const COMMON_WEAK_PASSWORDS = new Set([
  '123456789012',
  'password12345',
  'password1234',
  'qwerty123456',
  'admin1234567',
  'focuslens1234',
  'passwordpassword',
  'letmein123456',
  'welcome123456',
  'iloveyou12345',
  '123456123456',
  'abcdefghijkl',
]);

export function validatePasswordPolicy(password, userContext = {}) {
  if (!password || password.length < 12) {
    return 'Password must be at least 12 characters long.';
  }

  const lower = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return 'This password is too common or easily guessable. Please choose a more unique password or passphrase.';
  }

  const { name, email } = userContext;
  if (name && name.length >= 3) {
    const nameParts = name.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length >= 3 && lower.includes(part)) {
        return 'Password must not contain your name or personal details.';
      }
    }
  }

  if (email) {
    const emailPrefix = email.toLowerCase().split('@')[0];
    if (emailPrefix.length >= 3 && lower.includes(emailPrefix)) {
      return 'Password must not contain your email address or personal details.';
    }
  }

  return null;
}

// Zod Validation Schemas
export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must be at most 30 characters long')
    .regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, underscores, and periods.')
    .trim(),
  name: z.string().min(2, 'Name must be at least 2 characters long').trim(),
  email: z.string().optional().nullable().transform(val => (val && typeof val === 'string' && val.trim()) ? val.trim().toLowerCase() : null),
  password: z.string().min(12, 'Password must be at least 12 characters long'),
  verificationMethod: z.enum(['EMAIL', 'PHONE']).optional().default('EMAIL'),
  phoneNumber: z.string().optional().nullable().transform(val => (val && typeof val === 'string' && val.trim()) ? val.trim() : null),
}).superRefine((data, ctx) => {
  if (data.email) {
    const emailCheck = z.string().email('Please enter a valid email address').safeParse(data.email);
    if (!emailCheck.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter a valid email address.',
        path: ['email'],
      });
    }
  }
  if (data.verificationMethod === 'EMAIL' && !data.email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email address is required when Email Verification is selected.',
      path: ['email'],
    });
  }
  if (data.verificationMethod === 'PHONE' && !data.phoneNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number is required when Phone Verification is selected.',
      path: ['phoneNumber'],
    });
  }
});

export const LoginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => (data.identifier && data.identifier.trim()) || (data.email && data.email.trim()) || (data.username && data.username.trim()), {
  message: 'Please enter your email address, phone number, or username.',
  path: ['email'],
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100, 'Name must be 100 characters or fewer').trim().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters long').max(30, 'Username must be at most 30 characters long').regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, underscores, and periods.').trim().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters long'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation do not match',
  path: ['confirmPassword'],
});

// Handler: POST /api/auth/register
export async function register(request, reply) {
  try {
    const body = RegisterSchema.parse(request.body);

    const existingUsername = await dbStore.getUserByUsername(body.username);
    if (existingUsername) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'That username is already taken. Please choose another.',
        field: 'username',
      });
    }

    if (body.email) {
      const existingEmail = await dbStore.getUserByEmail(body.email);
      if (existingEmail) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'An account with this email address already exists. Please sign in.',
          field: 'email',
        });
      }
    }

    let normalizedPhone = null;
    if (body.phoneNumber) {
      normalizedPhone = normalizePhoneNumber(body.phoneNumber);
      const existingPhoneUser = await dbStore.getUserByPhoneNumber(normalizedPhone);
      if (existingPhoneUser) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'An account with this phone number already exists. Please sign in.',
          field: 'phoneNumber',
        });
      }
    }

    const policyErr = validatePasswordPolicy(body.password, { name: body.name, email: body.email });
    if (policyErr) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: policyErr,
        field: 'password',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    const newUser = await dbStore.createUser({
      username: body.username,
      email: body.email || null,
      name: body.name,
      passwordHash,
      phoneNumber: normalizedPhone || null,
      preferredVerificationMethod: body.verificationMethod,
      verificationStatus: 'UNVERIFIED',
    });

    // Establish server session
    request.session.userId = newUser.id;

    // Issue initial verification challenge
    const otp = generateNumericOTP();
    const tokenHash = hashVerificationToken(otp);
    const ttlMs = body.verificationMethod === 'PHONE' ? 10 * 60 * 1000 : 15 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    await dbStore.setVerificationChallenge(newUser.id, { tokenHash, expiresAt, resendAvailableAt });

    if (body.verificationMethod === 'PHONE') {
      await sendSmsOtpChallenge({ phoneNumber: normalizedPhone, otp });
    } else {
      const mailResult = await sendEmailVerificationChallenge({ email: body.email, otp, name: body.name });
      if (!mailResult.success && mailResult.provider !== 'dev') {
        return reply.status(201).send({
          user: toSafeUser(newUser),
          warning: 'EMAIL_DELIVERY_FAILED',
          message: 'Account created, but we could not deliver the verification email. Please check your email address or try resending.',
        });
      }
    }

    return reply.status(201).send({
      user: toSafeUser(newUser),
      message: `Account created. Verification code sent via ${body.verificationMethod}.`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const primaryIssue = err.errors[0];
      const primaryField = primaryIssue ? primaryIssue.path[0] : undefined;
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        field: primaryField,
        errors: err.errors.map(e => ({ field: e.path[0], message: e.message })),
      });
    }

    // Gracefully handle PostgreSQL / Database level unique-constraint violations (23505)
    if (err.code === '23505' || (err.message && (err.message.includes('unique constraint') || err.message.includes('duplicate key')))) {
      const msg = (err.message || '').toLowerCase();
      const detail = (err.detail || '').toLowerCase();
      if (msg.includes('username') || detail.includes('username') || msg.includes('idx_users_username_lower')) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'That username is already taken. Please choose another.',
          field: 'username',
        });
      }
      if (msg.includes('phone') || detail.includes('phone') || msg.includes('phone_number')) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'An account with this phone number already exists. Please sign in.',
          field: 'phoneNumber',
        });
      }
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'An account with this email address already exists. Please sign in.',
        field: 'email',
      });
    }

    request.log.error(err);
    return reply.status(err.statusCode || 500).send({
      statusCode: err.statusCode || 500,
      error: err.statusCode === 400 ? 'Validation Error' : 'Internal Server Error',
      message: err.message || 'Failed to create user account.',
    });
  }
}

// Handler: POST /api/auth/login
export async function login(request, reply) {
  try {
    const body = LoginSchema.parse(request.body);
    const rawKey = (body.identifier || body.email || body.username || '').trim();
    const cleanHandle = rawKey.replace(/^@/, '');

    let user = null;
    if (rawKey.startsWith('@')) {
      user = await dbStore.getUserByUsername(cleanHandle);
    } else {
      user = await dbStore.getUserByEmail(rawKey);
      if (!user) {
        user = await dbStore.getUserByUsername(rawKey);
      }
      if (!user) {
        try {
          const normalizedPhone = normalizePhoneNumber(rawKey);
          if (normalizedPhone) {
            user = await dbStore.getUserByPhoneNumber(normalizedPhone);
          }
        } catch (_) {
          // Identifier is not a phone number, fall through
        }
      }
    }

    request.log.info({
      path: '/api/auth/login',
      identifierType: rawKey.includes('@') ? 'email' : (rawKey.startsWith('@') ? 'username_handle' : 'username_or_phone'),
      userFound: Boolean(user),
      hasPasswordHash: Boolean(user?.passwordHash),
      hasGoogleId: Boolean(user?.googleId),
    }, '[Auth Diagnostic] Evaluated login request');

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email/phone/username or password.',
      });
    }

    if (!user.passwordHash) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'GOOGLE_ACCOUNT_ONLY',
        message: "This account uses Google Sign-In. Continue with Google or set a FocusLens password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email/username or password.',
      });
    }

    // Establish server session
    request.session.userId = user.id;

    return reply.send({
      user: toSafeUser(user),
      message: 'Logged in successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to authenticate user.',
    });
  }
}

/**
 * Generates a unique, URL-safe, database-compliant username for a Google account
 */
export async function generateUniqueUsername(name, email, dbStore) {
  let base = '';
  if (name && typeof name === 'string') {
    base = name.toLowerCase().replace(/[^a-z0-9._]/g, '');
  }
  if (!base || base.length < 3) {
    if (email && typeof email === 'string') {
      const emailPrefix = email.split('@')[0] || '';
      base = emailPrefix.toLowerCase().replace(/[^a-z0-9._]/g, '');
    }
  }
  if (!base || base.length < 3) {
    base = 'user_' + crypto.randomBytes(3).toString('hex');
  }

  // Ensure base length fits comfortably within 30 characters
  base = base.slice(0, 24);

  let candidate = base;
  let counter = 1;

  while (counter <= 100) {
    const existing = await dbStore.getUserByUsername(candidate);
    if (!existing) {
      return candidate;
    }
    candidate = `${base}${counter}`;
    if (candidate.length > 30) {
      candidate = `${base.slice(0, 24)}${counter}`;
    }
    counter++;
  }

  return `user_${crypto.randomBytes(4).toString('hex')}`;
}

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required.'),
});

// Handler: POST /api/auth/google
export async function googleAuth(request, reply) {
  try {
    const body = GoogleAuthSchema.parse(request.body);
    const decodedToken = await verifyFirebaseIdToken(body.idToken);

    const email = decodedToken.email ? decodedToken.email.toLowerCase().trim() : null;
    if (!email) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Google account does not have an associated email address.',
      });
    }

    const name = (decodedToken.name || '').trim();
    const picture = decodedToken.picture || null;
    const googleId = decodedToken.uid || null;
    const emailVerified = Boolean(decodedToken.email_verified);

    // Look up existing user by verified email
    let user = await dbStore.getUserByEmail(email);

    if (user) {
      // Existing user found: sign into the existing account
      // Link googleId and verify email without overwriting existing profile data
      if (!user.googleId || user.verificationStatus !== 'VERIFIED') {
        const updated = await dbStore.linkGoogleAccount(user.id, {
          googleId: user.googleId || googleId,
          avatarUrl: user.avatarUrl || picture,
        });
        if (updated) user = updated;
      }

      // Establish signed HTTP-only FocusLens session
      request.session.userId = user.id;

      return reply.send({
        user: toSafeUser(user),
        message: 'Logged in successfully with Google.',
      });
    }

    // No existing user found: create a new FocusLens account
    const username = await generateUniqueUsername(name, email, dbStore);

    const newUser = await dbStore.createUser({
      username,
      name: name || username,
      email,
      passwordHash: null, // Google-authenticated account, no password required
      googleId,
      avatarUrl: picture,
      preferredVerificationMethod: 'EMAIL',
      verificationStatus: emailVerified ? 'VERIFIED' : 'UNVERIFIED',
      emailVerifiedAt: emailVerified ? new Date() : null,
    });

    // Establish signed HTTP-only FocusLens session
    request.session.userId = newUser.id;

    return reply.status(201).send({
      user: toSafeUser(newUser),
      message: 'Account created and logged in with Google.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }

    if (err.statusCode) {
      return reply.status(err.statusCode).send({
        statusCode: err.statusCode,
        error: err.statusCode === 401 ? 'Unauthorized' : (err.statusCode === 400 ? 'Bad Request' : 'Internal Server Error'),
        message: err.message,
      });
    }

    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message || 'Failed to authenticate with Google.',
    });
  }
}

export const FirebasePhoneAuthSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required.'),
  username: z.string().min(3).max(30).optional(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(12).optional(),
});

// Handler: POST /api/auth/firebase-phone
export async function firebasePhoneAuth(request, reply) {
  try {
    const body = FirebasePhoneAuthSchema.parse(request.body);
    const decodedToken = await verifyFirebaseIdToken(body.idToken);

    const rawPhoneNumber = decodedToken.phone_number;
    if (!rawPhoneNumber) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Firebase token does not contain a verified phone number.',
      });
    }

    const normalizedPhone = normalizePhoneNumber(rawPhoneNumber);
    let user = await dbStore.getUserByPhoneNumber(normalizedPhone);

    // Case 1: Account with this phone number ALREADY exists
    if (user) {
      // If caller passed registration details, prevent duplicate registration
      if (body.username || body.password) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'An account with this phone number already exists. Please sign in.',
          field: 'phoneNumber',
        });
      }

      // Ensure phone is marked as verified upon successful Firebase phone authentication
      if (user.verificationStatus !== 'VERIFIED' || !user.phoneVerifiedAt) {
        const updated = await dbStore.updateUserContact(user.id, {
          phoneVerifiedAt: new Date(),
          verificationStatus: 'VERIFIED',
        });
        if (updated) {
          user = updated;
        }
      }

      // Establish signed HTTP-only FocusLens session
      request.session.userId = user.id;

      return reply.send({
        user: toSafeUser(user),
        message: 'Logged in successfully with phone number.',
      });
    }

    // Case 2: No account exists for this phone number
    // If no registration data was submitted, return 404 (pure login attempt with unregistered phone)
    if (!body.username || !body.password) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No FocusLens account found with this phone number. Please create an account first.',
      });
    }

    // New Registration with verified phone number
    const cleanUsername = body.username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Username can only contain letters, numbers, underscores, and periods.',
        field: 'username',
      });
    }

    const existingUsernameUser = await dbStore.getUserByUsername(cleanUsername);
    if (existingUsernameUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'This username is already taken. Please choose another.',
        field: 'username',
      });
    }

    let normalizedEmail = null;
    if (body.email && typeof body.email === 'string' && body.email.trim()) {
      normalizedEmail = body.email.trim().toLowerCase();
      const existingEmailUser = await dbStore.getUserByEmail(normalizedEmail);
      if (existingEmailUser) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'An account with this email address already exists.',
          field: 'email',
        });
      }
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
    const name = (body.name || cleanUsername).trim();

    const newUser = await dbStore.createUser({
      username: cleanUsername,
      name,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      passwordHash,
      preferredVerificationMethod: 'PHONE',
      verificationStatus: 'VERIFIED',
      emailVerifiedAt: null,
    });

    await dbStore.updateUserContact(newUser.id, {
      phoneVerifiedAt: new Date(),
      verificationStatus: 'VERIFIED',
    });
    newUser.phoneVerifiedAt = new Date();

    // Establish signed HTTP-only FocusLens session
    request.session.userId = newUser.id;

    return reply.status(201).send({
      user: toSafeUser(newUser),
      message: 'Account created and phone number verified successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }

    if (err.statusCode) {
      return reply.status(err.statusCode).send({
        statusCode: err.statusCode,
        error: err.statusCode === 401 ? 'Unauthorized' : (err.statusCode === 400 ? 'Bad Request' : 'Internal Server Error'),
        message: err.message,
      });
    }

    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message || 'Failed to authenticate with phone number.',
    });
  }
}

// Handler: POST /api/auth/logout
export async function logout(request, reply) {
  if (request.session) {
    return new Promise((resolve) => {
      request.session.destroy((err) => {
        if (err) {
          reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Could not destroy session.',
          });
          return resolve();
        }
        reply.clearCookie('focuslens_session', { path: '/' });
        reply.send({
          success: true,
          message: 'Logged out successfully.',
        });
        resolve();
      });
    });
  } else {
    reply.clearCookie('focuslens_session', { path: '/' });
    return reply.send({
      success: true,
      message: 'Logged out.',
    });
  }
}

// Handler: GET /api/auth/me
export async function getCurrentUser(request, reply) {
  if (!request.user) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  return reply.send({
    user: request.user,
  });
}

// Handler: GET /api/auth/check-username?username=...
export async function checkUsername(request, reply) {
  const username = (request.query?.username || '').trim();
  if (!username) {
    return reply.status(400).send({ available: false, message: 'Username parameter is required.' });
  }

  const formatErr = validateUsernameFormat(username);
  if (formatErr) {
    return reply.send({ available: false, message: formatErr });
  }

  const existing = await dbStore.getUserByUsername(username);
  if (existing) {
    if (request.user && request.user.id && existing.id === request.user.id) {
      return reply.send({ available: true, message: 'This is your current username.' });
    }
    return reply.send({ available: false, message: 'That username is already taken. Please choose another.' });
  }

  return reply.send({ available: true, message: 'Username is available.' });
}

// Handler: PUT /api/auth/profile
export async function updateProfile(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  try {
    const body = UpdateProfileSchema.parse(request.body);
    const userId = request.user.id;

    if (body.username) {
      const existingUser = await dbStore.getUserByUsername(body.username);
      if (existingUser && existingUser.id !== userId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'That username is already taken. Please choose another.',
        });
      }
    }

    const updatedUser = await dbStore.updateUserProfile(userId, {
      name: body.name,
      username: body.username,
    });

    if (!updatedUser) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User account not found.',
      });
    }

    return reply.send({
      user: toSafeUser(updatedUser),
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    if (err.code === '23505' || (err.message && (err.message.includes('unique constraint') || err.message.includes('duplicate key')))) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'That username is already taken. Please choose another.',
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to update profile.',
    });
  }
}

// Handler: POST /api/auth/profile/avatar
export async function uploadAvatar(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  const userId = request.user.id;
  const body = request.body || {};
  const avatarData = body.avatarData || body.avatar || body.image;

  if (!avatarData) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'No image data provided. Please select an image file to upload.',
    });
  }

  try {
    const currentUser = await dbStore.getUserById(userId);
    const oldAvatarPublicId = currentUser?.avatarPublicId;

    const { avatarUrl, avatarPublicId } = await saveAvatar(userId, avatarData, oldAvatarPublicId);

    const updatedUser = await dbStore.updateUserAvatar(userId, {
      avatarUrl,
      avatarPublicId,
    });

    return reply.send({
      user: toSafeUser(updatedUser),
      message: 'Profile picture updated successfully.',
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || (err.message && (err.message.includes('limit') || err.message.includes('format') || err.message.includes('corrupted') || err.message.includes('invalid') || err.message.includes('Empty')) ? 400 : 500);
    return reply.status(statusCode).send({
      statusCode,
      error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
      message: err.message || 'Failed to upload profile picture.',
    });
  }
}

// Handler: DELETE /api/auth/profile/avatar
export async function removeAvatar(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  const userId = request.user.id;

  try {
    const currentUser = await dbStore.getUserById(userId);
    if (currentUser?.avatarPublicId) {
      await deleteAvatarFile(currentUser.avatarPublicId).catch(() => {});
    }

    const updatedUser = await dbStore.updateUserAvatar(userId, {
      avatarUrl: null,
      avatarPublicId: null,
    });

    return reply.send({
      user: toSafeUser(updatedUser),
      message: 'Profile picture removed successfully.',
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to remove profile picture.',
    });
  }
}

// Zod Schemas for Verification
export const VerifyCodeSchema = z.object({
  code: z.string().min(6, 'Verification code must be 6 digits').max(6, 'Verification code must be 6 digits'),
});

export const SendPhoneSchema = z.object({
  phoneNumber: z.string().min(7, 'Phone number must be at least 7 digits'),
});

export const SwitchMethodSchema = z.object({
  method: z.enum(['EMAIL', 'PHONE']),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
});

// Handler: POST /api/auth/send-email-verification
export async function sendEmailVerification(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated.' });
  }

  try {
    const user = await dbStore.getUserById(request.user.id);
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found.' });
    }

    const emailInput = (request.body && request.body.email) ? request.body.email.trim().toLowerCase() : user.email;
    if (!emailInput) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Email address is required.' });
    }

    const emailCheck = z.string().email().safeParse(emailInput);
    if (!emailCheck.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: 'Please enter a valid email address.' });
    }

    const existingEmailUser = await dbStore.getUserByEmail(emailInput);
    if (existingEmailUser && existingEmailUser.id !== user.id) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'An account with this email address already exists. Please sign in.' });
    }

    if (emailInput !== user.email) {
      await dbStore.updateUserContact(user.id, { email: emailInput, emailVerifiedAt: null });
    }

    if (emailInput === user.email && user.verificationResendAvailableAt && new Date() < new Date(user.verificationResendAvailableAt)) {
      const waitSeconds = Math.ceil((new Date(user.verificationResendAvailableAt) - new Date()) / 1000);
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
      });
    }

    const otp = generateNumericOTP();
    const tokenHash = hashVerificationToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    await dbStore.setVerificationChallenge(user.id, { tokenHash, expiresAt, resendAvailableAt });
    const mailResult = await sendEmailVerificationChallenge({ email: emailInput, otp, name: user.name });

    if (!mailResult.success && mailResult.provider !== 'dev') {
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Unable to deliver verification email at this time. Please try again in a few moments.',
      });
    }

    return reply.send({
      success: true,
      email: emailInput,
      message: 'Verification code sent to your email.',
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send email verification code.' });
  }
}

// Handler: POST /api/auth/verify-email
export async function verifyEmail(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated.' });
  }

  try {
    const body = VerifyCodeSchema.parse(request.body);
    const user = await dbStore.getUserById(request.user.id);

    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found.' });
    }

    if (!user.verificationTokenHash) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No active verification challenge. Please request a new code.' });
    }

    if (new Date() > new Date(user.verificationExpiresAt)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Verification code expired. Please request a new code.' });
    }

    if ((user.verificationAttempts || 0) >= 5) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Maximum verification attempts exceeded. Please request a new code.' });
    }

    const inputHash = hashVerificationToken(body.code);
    if (inputHash !== user.verificationTokenHash) {
      await dbStore.incrementVerificationAttempts(user.id);
      const remaining = 5 - ((user.verificationAttempts || 0) + 1);
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: remaining > 0 ? `Invalid verification code. ${remaining} attempts remaining.` : 'Invalid verification code. Maximum attempts exceeded.',
      });
    }

    const updatedUser = await dbStore.verifyUserEmail(user.id);
    return reply.send({
      user: toSafeUser(updatedUser),
      message: 'Email successfully verified!',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: err.errors.map(e => e.message).join(', ') });
    }
    request.log.error(err);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to verify email.' });
  }
}

// Handler: POST /api/auth/send-phone-verification
export async function sendPhoneVerification(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated.' });
  }

  try {
    const body = SendPhoneSchema.parse(request.body);
    const normalizedPhone = normalizePhoneNumber(body.phoneNumber);

    const existingPhoneUser = await dbStore.getUserByPhoneNumber(normalizedPhone);
    if (existingPhoneUser && existingPhoneUser.id !== request.user.id) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'This phone number is already registered to another account.' });
    }

    const user = await dbStore.getUserById(request.user.id);
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found.' });
    }

    if (normalizedPhone === user.phoneNumber && user.verificationResendAvailableAt && new Date() < new Date(user.verificationResendAvailableAt)) {
      const waitSeconds = Math.ceil((new Date(user.verificationResendAvailableAt) - new Date()) / 1000);
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Please wait ${waitSeconds} seconds before requesting a new SMS code.`,
      });
    }

    const otp = generateNumericOTP();
    const tokenHash = hashVerificationToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    await dbStore.updateUserContact(user.id, { phoneNumber: normalizedPhone, phoneVerifiedAt: null });
    await dbStore.setVerificationChallenge(user.id, { tokenHash, expiresAt, resendAvailableAt });
    await sendSmsOtpChallenge({ phoneNumber: normalizedPhone, otp });

    return reply.send({
      success: true,
      phoneNumber: normalizedPhone,
      message: 'Verification code sent via SMS.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: err.errors.map(e => e.message).join(', ') });
    }
    request.log.error(err);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send SMS verification code.' });
  }
}

// Handler: POST /api/auth/verify-phone
export async function verifyPhone(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated.' });
  }

  try {
    const body = VerifyCodeSchema.parse(request.body);
    const user = await dbStore.getUserById(request.user.id);

    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found.' });
    }

    if (!user.verificationTokenHash) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No active verification challenge. Please request a new SMS code.' });
    }

    if (new Date() > new Date(user.verificationExpiresAt)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'SMS verification code expired. Please request a new code.' });
    }

    if ((user.verificationAttempts || 0) >= 5) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Maximum verification attempts exceeded. Please request a new code.' });
    }

    const inputHash = hashVerificationToken(body.code);
    if (inputHash !== user.verificationTokenHash) {
      await dbStore.incrementVerificationAttempts(user.id);
      const remaining = 5 - ((user.verificationAttempts || 0) + 1);
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: remaining > 0 ? `Invalid SMS verification code. ${remaining} attempts remaining.` : 'Invalid SMS code. Maximum attempts exceeded.',
      });
    }

    const updatedUser = await dbStore.verifyUserPhone(user.id);
    return reply.send({
      user: toSafeUser(updatedUser),
      message: 'Phone number successfully verified!',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: err.errors.map(e => e.message).join(', ') });
    }
    request.log.error(err);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to verify phone number.' });
  }
}

// Handler: POST /api/auth/switch-verification-method
export async function switchVerificationMethod(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated.' });
  }

  try {
    const body = SwitchMethodSchema.parse(request.body);
    const userId = request.user.id;
    let normalizedPhone = null;
    let normalizedEmail = null;

    if (body.method === 'PHONE') {
      const phoneInput = body.phoneNumber || request.user.phoneNumber;
      if (!phoneInput) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Phone number is required when switching to Phone Verification.' });
      }
      normalizedPhone = normalizePhoneNumber(phoneInput);

      const existingPhoneUser = await dbStore.getUserByPhoneNumber(normalizedPhone);
      if (existingPhoneUser && existingPhoneUser.id !== userId) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'This phone number is already registered to another account.' });
      }
    }

    if (body.method === 'EMAIL') {
      const emailInput = (body.email || request.user.email || '').trim().toLowerCase();
      if (!emailInput) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Email address is required when switching to Email Verification.' });
      }
      const emailCheck = z.string().email().safeParse(emailInput);
      if (!emailCheck.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: 'Please enter a valid email address.' });
      }
      normalizedEmail = emailInput;

      const existingEmailUser = await dbStore.getUserByEmail(normalizedEmail);
      if (existingEmailUser && existingEmailUser.id !== userId) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'This email address is already registered to another account.' });
      }
    }

    const updatedUser = await dbStore.switchVerificationMethod(userId, {
      preferredVerificationMethod: body.method,
      phoneNumber: normalizedPhone || undefined,
      email: normalizedEmail || undefined,
    });

    const otp = generateNumericOTP();
    const tokenHash = hashVerificationToken(otp);
    const ttlMs = body.method === 'PHONE' ? 10 * 60 * 1000 : 15 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    await dbStore.setVerificationChallenge(userId, { tokenHash, expiresAt, resendAvailableAt });

    if (body.method === 'PHONE') {
      await sendSmsOtpChallenge({ phoneNumber: normalizedPhone || updatedUser.phoneNumber, otp });
    } else {
      const mailResult = await sendEmailVerificationChallenge({ email: normalizedEmail || updatedUser.email, otp, name: updatedUser.name });
      if (!mailResult.success && mailResult.provider !== 'dev') {
        return reply.send({
          user: toSafeUser(updatedUser),
          warning: 'EMAIL_DELIVERY_FAILED',
          message: 'Switched preferred verification method to EMAIL, but we could not deliver the verification email. Please check your email address or try resending.',
        });
      }
    }

    return reply.send({
      user: toSafeUser(updatedUser),
      message: `Switched preferred verification method to ${body.method}. A new verification code has been sent.`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ statusCode: 400, error: 'Validation Error', message: err.errors.map(e => e.message).join(', ') });
    }
    request.log.error(err);
    return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to switch verification method.' });
  }
}

// Handler: POST /api/auth/change-password
export async function changePassword(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  try {
    const body = ChangePasswordSchema.parse(request.body);
    const userId = request.user.id;

    const user = await dbStore.getUserById(userId);
    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Current password is incorrect.',
      });
    }

    const isCurrentValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Current password is incorrect.',
      });
    }

    const policyErr = validatePasswordPolicy(body.newPassword, { name: user.name, email: user.email });
    if (policyErr) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: policyErr,
      });
    }

    const isSamePassword = await bcrypt.compare(body.newPassword, user.passwordHash);
    if (isSamePassword) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'New password cannot be the same as your current password.',
      });
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(body.newPassword, saltRounds);

    await dbStore.updateUserPassword(userId, newHash);

    return reply.send({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to change password.',
    });
  }
}

// Handler: DELETE /api/account
export async function deleteAccount(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Not authenticated.',
    });
  }

  try {
    const userId = request.user.id;
    await dbStore.deleteUser(userId);

    request.session.destroy();

    return reply.send({
      success: true,
      message: 'User account and all associated focus session records deleted successfully.',
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to delete account.',
    });
  }
}

// Zod Schemas for Password Reset
export const ForgotPasswordSchema = z.object({
  method: z.enum(['EMAIL', 'PHONE', 'AUTO']).optional().default('AUTO'),
  identifier: z.string().min(1, 'Email address, phone number, or username is required'),
});

export const VerifyResetTokenSchema = z.object({
  method: z.enum(['EMAIL', 'PHONE']).optional().default('EMAIL'),
  identifier: z.string().optional(),
  code: z.string().optional(),
  token: z.string().optional(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token or code is required'),
  method: z.enum(['EMAIL', 'PHONE']).optional().default('EMAIL'),
  identifier: z.string().optional(),
  newPassword: z.string().min(12, 'Password must be at least 12 characters long'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation do not match',
  path: ['confirmPassword'],
});

// Handler: POST /api/auth/forgot-password
export async function forgotPassword(request, reply) {
  try {
    const body = ForgotPasswordSchema.parse(request.body);
    const genericResponse = {
      success: true,
      message: "If an account exists, a verification code has been sent.",
    };

    const rawId = body.identifier.trim();
    const cleanHandle = rawId.replace(/^@/, '');

    let user = null;
    let normalizedPhone = null;

    if (rawId.startsWith('@')) {
      user = await dbStore.getUserByUsername(cleanHandle);
    } else {
      user = await dbStore.getUserByEmail(rawId);
      if (!user) {
        try {
          normalizedPhone = normalizePhoneNumber(rawId);
          user = await dbStore.getUserByPhoneNumber(normalizedPhone);
        } catch (e) {}
      }
      if (!user) {
        user = await dbStore.getUserByUsername(rawId);
      }
    }

    // ACCOUNT ENUMERATION PROTECTION:
    if (!user) {
      await new Promise(r => setTimeout(r, 50));
      return reply.send(genericResponse);
    }

    // Determine actual reset method based on user's available contact methods
    let resetType = body.method;
    if (resetType === 'AUTO' || !resetType) {
      if (user.phoneNumber && body.method === 'PHONE') {
        resetType = 'PHONE';
      } else if (user.email && !user.phoneNumber) {
        resetType = 'EMAIL';
      } else if (user.phoneNumber && !user.email) {
        resetType = 'PHONE';
      } else if (user.email) {
        resetType = 'EMAIL';
      } else if (user.phoneNumber) {
        resetType = 'PHONE';
      }
    }

    if (resetType === 'EMAIL' && !user.email && user.phoneNumber) {
      resetType = 'PHONE';
    }
    if (resetType === 'PHONE' && !user.phoneNumber && user.email) {
      resetType = 'EMAIL';
    }

    // Check rate limit on existing reset requests
    const existingReset = await dbStore.getActivePasswordResetByUser(user.id, resetType);
    if (existingReset && existingReset.resendAvailableAt && new Date() < new Date(existingReset.resendAvailableAt)) {
      const waitSeconds = Math.ceil((new Date(existingReset.resendAvailableAt) - new Date()) / 1000);
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
      });
    }

    const resendAvailableAt = new Date(Date.now() + 60 * 1000);
    const otp = generateNumericOTP();
    const tokenHash = hashVerificationToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await dbStore.createPasswordReset({
      userId: user.id,
      resetType,
      tokenHash,
      expiresAt,
      resendAvailableAt,
    });

    if (resetType === 'EMAIL' && user.email) {
      let resetLinkDelivered = false;

      // Primary: Generate Firebase password reset link via Firebase Admin SDK
      if (isFirebaseAdminConfigured()) {
        try {
          const adminAuth = await getFirebaseAuth();
          const targetHandlerUrl = process.env.NODE_ENV === 'development' && process.env.FRONTEND_URL
            ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/reset-password`
            : 'https://focus-lens-nine.vercel.app/reset-password';

          const link = await adminAuth.generatePasswordResetLink(user.email, {
            url: targetHandlerUrl,
          });

          // Safely extract oobCode using URL / URLSearchParams APIs
          const parsedAdminLink = new URL(link);
          const oobCode = parsedAdminLink.searchParams.get('oobCode');

          if (oobCode) {
            const customResetUrl = new URL(targetHandlerUrl);
            customResetUrl.searchParams.set('mode', 'resetPassword');
            customResetUrl.searchParams.set('oobCode', oobCode);

            const emailResult = await sendEmailPasswordResetLink({
              email: user.email,
              resetUrl: customResetUrl.toString(),
              name: user.name,
            });

            if (emailResult && emailResult.success) {
              resetLinkDelivered = true;
            } else if (emailResult && !emailResult.success) {
              if (emailResult.isSandboxRestriction) {
                request.log.warn(`[Email Delivery Notice] Resend sandbox recipient restriction: current sandbox sender requires sending to verified account owner or verifying production domain.`);
              } else {
                request.log.error(`[Email Delivery Failure] Failed to deliver custom Firebase reset link: ${emailResult.error}`);
              }
            }
          }
        } catch (adminErr) {
          request.log.warn(`[Firebase Admin Reset] Unable to generate Firebase Admin reset link: ${adminErr.message}`);
        }
      }

      // Fallback: If Admin SDK is unconfigured or fails (e.g. offline unit tests), deliver standard OTP email
      if (!resetLinkDelivered && !isFirebaseAdminConfigured()) {
        const emailResult = await sendEmailPasswordResetOtp({
          email: user.email,
          otp,
          name: user.name,
        });
        if (emailResult && !emailResult.success) {
          request.log.error(`[Email Delivery Failure] Failed to deliver password reset email: ${emailResult.error}`);
        }
      }
    } else if (user.phoneNumber) {
      const targetPhone = normalizedPhone || user.phoneNumber;
      const smsResult = await sendSmsPasswordResetOtp({
        phoneNumber: targetPhone,
        otp,
      });
      if (smsResult && !smsResult.success) {
        request.log.error(`[SMS Delivery Failure] Failed to deliver password reset SMS to ${targetPhone}: ${smsResult.error}`);
      }
    }

    return reply.send({
      ...genericResponse,
      resetType,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.send({
      success: true,
      message: "If an account exists, a verification code has been sent.",
    });
  }
}

// Handler: POST /api/auth/verify-reset-token
export async function verifyResetToken(request, reply) {
  try {
    const body = VerifyResetTokenSchema.parse(request.body);
    const rawCode = (body.code || body.token || '').trim();
    if (!rawCode) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Verification code is required.',
      });
    }

    let user = null;
    let method = body.method || 'EMAIL';
    if (body.identifier) {
      if (method === 'EMAIL') {
        user = await dbStore.getUserByEmail(body.identifier);
      } else {
        try {
          const phone = normalizePhoneNumber(body.identifier);
          user = await dbStore.getUserByPhoneNumber(phone);
        } catch (e) {}
      }
    }

    const tokenHash = hashVerificationToken(rawCode);
    let resetRecord = null;

    if (user) {
      resetRecord = await dbStore.getActivePasswordResetByUser(user.id, method);
    } else {
      resetRecord = await dbStore.getPasswordResetByTokenHash(tokenHash);
    }

    if (!resetRecord) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or expired verification code.',
      });
    }

    if (resetRecord.usedAt) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'This verification code has already been used.',
      });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    if ((resetRecord.attempts || 0) >= 5) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    // Check code match
    if (hashVerificationToken(rawCode) !== resetRecord.tokenHash) {
      const attempts = await dbStore.incrementPasswordResetAttempts(resetRecord.id);
      const remaining = 5 - attempts;
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: remaining > 0 ? `Invalid verification code. ${remaining} attempts remaining.` : 'Invalid verification code. Maximum attempts exceeded.',
      });
    }

    // Create a short-lived (5 min) verified authorization token for password reset
    const verifiedToken = crypto.randomBytes(32).toString('hex');
    const verifiedTokenHash = hashVerificationToken(verifiedToken);
    const verifiedExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await dbStore.createPasswordReset({
      userId: resetRecord.userId,
      resetType: resetRecord.resetType,
      tokenHash: verifiedTokenHash,
      expiresAt: verifiedExpiresAt,
      resendAvailableAt: new Date(Date.now() + 60 * 1000),
    });

    // Mark previous OTP challenge as used
    await dbStore.markPasswordResetUsed(resetRecord.id);

    return reply.send({
      valid: true,
      resetToken: verifiedToken,
      resetType: resetRecord.resetType,
      message: 'Verification code confirmed. You may now set a new password.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to verify verification code.',
    });
  }
}

// Handler: POST /api/auth/reset-password
export async function resetPassword(request, reply) {
  try {
    const body = ResetPasswordSchema.parse(request.body);
    const rawCredential = (body.token || body.code || '').trim();
    const tokenHash = hashVerificationToken(rawCredential);

    const resetRecord = await dbStore.getPasswordResetByTokenHash(tokenHash);
    if (!resetRecord) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or expired password reset session.',
      });
    }

    if (resetRecord.usedAt) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'This reset session has already been used.',
      });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Reset authorization has expired. Please request a new code.',
      });
    }

    // Identify user server-side from database reset record
    const user = await dbStore.getUserById(resetRecord.userId);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User account not found.',
      });
    }

    // Validate new password against existing password policy
    const policyErr = validatePasswordPolicy(body.newPassword, { name: user.name, email: user.email });
    if (policyErr) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: policyErr,
      });
    }

    // Hash new password using bcrypt
    const saltRounds = 10;
    const newHash = await bcrypt.hash(body.newPassword, saltRounds);

    // Update user password in DB
    await dbStore.updateUserPassword(user.id, newHash);

    // Invalidate reset credential
    await dbStore.markPasswordResetUsed(resetRecord.id);

    // Invalidate existing authenticated sessions for that user
    if (request.session) {
      request.session.destroy();
    }

    return reply.send({
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to reset password.',
    });
  }
}

export const SyncFirebasePasswordSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required.'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters long.'),
});

// Handler: POST /api/auth/sync-firebase-password
export async function syncFirebasePassword(request, reply) {
  try {
    const body = SyncFirebasePasswordSchema.parse(request.body);
    const decodedToken = await verifyFirebaseIdToken(body.idToken);

    const email = decodedToken.email ? decodedToken.email.toLowerCase().trim() : null;
    if (!email) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Firebase token does not have an associated email address.',
      });
    }

    let user = await dbStore.getUserByEmail(email);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User account not found.',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.newPassword, saltRounds);

    await dbStore.updateUserPassword(user.id, passwordHash);

    // If user was Google-authenticated, ensure googleId is linked
    if (!user.googleId && decodedToken.uid) {
      await dbStore.linkGoogleAccount(user.id, {
        googleId: decodedToken.uid,
        avatarUrl: user.avatarUrl || decodedToken.picture || null,
      });
    }

    return reply.send({
      success: true,
      message: 'Password synchronized successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    if (err.statusCode) {
      return reply.status(err.statusCode).send({
        statusCode: err.statusCode,
        error: err.statusCode === 401 ? 'Unauthorized' : 'Bad Request',
        message: err.message,
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message || 'Failed to synchronize password.',
    });
  }
}

export const SetPasswordSchema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters long.'),
  confirmPassword: z.string().min(1, 'Password confirmation is required.'),
  idToken: z.string().optional(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New password and confirmation do not match.',
  path: ['confirmPassword'],
});

// Handler: POST /api/auth/set-password
export async function setPassword(request, reply) {
  try {
    const body = SetPasswordSchema.parse(request.body);
    const userId = request.user?.id || request.session?.userId;
    if (!userId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'You must be logged in to set a password.',
      });
    }

    const user = await dbStore.getUserById(userId);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User account not found.',
      });
    }

    if (user.passwordHash) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'This account already has a password. Please use Change Password instead.',
      });
    }

    const policyErr = validatePasswordPolicy(body.newPassword, { name: user.name, email: user.email });
    if (policyErr) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: policyErr,
      });
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(body.newPassword, saltRounds);
    await dbStore.updateUserPassword(user.id, newHash);

    return reply.send({
      success: true,
      message: 'FocusLens password set successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message || 'Failed to set password.',
    });
  }
}



