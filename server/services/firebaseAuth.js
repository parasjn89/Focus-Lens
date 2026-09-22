import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config/env.js';

let authInstance = null;
let mockVerifier = null;

/**
 * Checks if Firebase Admin SDK environment credentials are provided
 */
export function isFirebaseAdminConfigured() {
  return Boolean(
    config.firebaseProjectId &&
    config.firebaseClientEmail &&
    config.firebasePrivateKey
  );
}

/**
 * Safely initializes Firebase Admin Auth singleton using modern modular SDK
 */
export function getFirebaseAuth() {
  if (!isFirebaseAdminConfigured()) {
    const error = new Error('Google authentication is not configured on the server. Firebase Admin credentials are missing.');
    error.statusCode = 500;
    error.code = 'FIREBASE_NOT_CONFIGURED';
    throw error;
  }

  if (authInstance) {
    return authInstance;
  }

  const existingApps = getApps();
  let app;
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    try {
      app = initializeApp({
        credential: cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          privateKey: config.firebasePrivateKey,
        }),
      });
    } catch (err) {
      const error = new Error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
      error.statusCode = 500;
      error.cause = err.message;
      throw error;
    }
  }

  authInstance = getAuth(app);
  return authInstance;
}

/**
 * Legacy compatibility wrapper returning object with auth() method
 */
export function getFirebaseAdmin() {
  const auth = getFirebaseAuth();
  return {
    auth: () => auth,
  };
}

/**
 * Hook for unit/integration tests to inject a deterministic mock verifier
 * @param {Function|null} verifierFn (idToken) => Promise<decodedToken>
 */
export function setMockVerifier(verifierFn) {
  mockVerifier = verifierFn;
}

/**
 * Resets the test mock verifier
 */
export function resetMockVerifier() {
  mockVerifier = null;
}

/**
 * Verifies a Firebase ID token and returns the decoded payload.
 * Strictly uses server-side Firebase Admin SDK.
 *
 * @param {string} idToken The Firebase JWT ID token sent from the browser
 * @returns {Promise<Object>} Decoded token payload with verified Google identity
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const error = new Error('Firebase ID token is required.');
    error.statusCode = 400;
    error.code = 'MISSING_ID_TOKEN';
    throw error;
  }

  // Use test mock verifier if configured
  if (typeof mockVerifier === 'function') {
    return await mockVerifier(idToken.trim());
  }

  const auth = getFirebaseAuth();

  try {
    const decodedToken = await auth.verifyIdToken(idToken.trim(), true);

    if (!decodedToken || !decodedToken.uid) {
      const error = new Error('Invalid Firebase authentication token.');
      error.statusCode = 401;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    return decodedToken;
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      const error = new Error('Firebase authentication token has expired. Please sign in again.');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }

    if (
      err.code === 'auth/invalid-id-token' ||
      err.code === 'auth/argument-error' ||
      err.code === 'auth/id-token-revoked'
    ) {
      const error = new Error('Invalid or revoked Firebase authentication token.');
      error.statusCode = 401;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    const error = new Error(err.message || 'Unable to verify Firebase authentication token.');
    error.statusCode = err.statusCode || 401;
    error.code = err.code || 'TOKEN_VERIFICATION_FAILED';
    throw error;
  }
}
