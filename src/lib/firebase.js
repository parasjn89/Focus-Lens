import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';

export function getFirebaseConfig() {
  const staticConfig = typeof __FOCUSLENS_STATIC_FIREBASE_CONFIG__ !== 'undefined'
    ? __FOCUSLENS_STATIC_FIREBASE_CONFIG__
    : {};

  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};

  const apiKey = (
    staticConfig.apiKey ||
    import.meta.env?.VITE_FIREBASE_API_KEY ||
    procEnv.VITE_FIREBASE_API_KEY ||
    procEnv.FIREBASE_API_KEY ||
    ''
  ).trim();
  const projectId = (
    staticConfig.projectId ||
    import.meta.env?.VITE_FIREBASE_PROJECT_ID ||
    procEnv.VITE_FIREBASE_PROJECT_ID ||
    procEnv.FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  const authDomain = (
    staticConfig.authDomain ||
    import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ||
    procEnv.VITE_FIREBASE_AUTH_DOMAIN ||
    procEnv.FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : '')
  ).trim();
  const rawStorageBucket = (
    staticConfig.storageBucket ||
    import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ||
    procEnv.VITE_FIREBASE_STORAGE_BUCKET ||
    procEnv.FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : '')
  ).trim();
  const storageBucket = rawStorageBucket.endsWith('.firebasestorage.ap')
    ? `${rawStorageBucket}p`
    : rawStorageBucket;
  const messagingSenderId = (
    staticConfig.messagingSenderId ||
    import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    procEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    procEnv.FIREBASE_MESSAGING_SENDER_ID ||
    ''
  ).trim();
  const appId = (
    staticConfig.appId ||
    import.meta.env?.VITE_FIREBASE_APP_ID ||
    procEnv.VITE_FIREBASE_APP_ID ||
    procEnv.FIREBASE_APP_ID ||
    ''
  ).trim();

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

let lastPhoneAuthError = null;

export function getLastPhoneAuthError() {
  return lastPhoneAuthError;
}

export function clearLastPhoneAuthError() {
  lastPhoneAuthError = null;
}

export function setLastPhoneAuthError(err) {
  if (!err) {
    lastPhoneAuthError = null;
    return;
  }
  lastPhoneAuthError = {
    code: err.code || 'auth/unknown',
    message: err.message || '',
    rawMessage: err.rawMessage || err.originalMessage || err.message || '',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Safe client diagnostic that reports presence of Firebase config variables
 * and actual last Firebase Auth error code/message without exposing sensitive values or keys.
 */
export function getFirebaseDiagnostics() {
  const cfg = getFirebaseConfig();
  const buildDiag = typeof __FOCUSLENS_BUILD_DIAGNOSTIC__ !== 'undefined'
    ? __FOCUSLENS_BUILD_DIAGNOSTIC__
    : null;

  return {
    projectId: cfg.projectId || 'missing',
    authDomain: cfg.authDomain || 'missing',
    configCompleteness: isFirebaseConfigured() ? 'complete' : 'incomplete',
    lastErrorCode: lastPhoneAuthError?.code || null,
    lastErrorMessage: lastPhoneAuthError?.message || null,
    lastErrorRawMessage: lastPhoneAuthError?.rawMessage || null,
    'API key': cfg.apiKey ? 'present' : 'missing',
    'auth domain': cfg.authDomain ? 'present' : 'missing',
    'project ID': cfg.projectId ? 'present' : 'missing',
    'app ID': cfg.appId ? 'present' : 'missing',
    'messaging sender ID': cfg.messagingSenderId ? 'present' : 'missing',
    'storage bucket': cfg.storageBucket ? 'present' : 'missing',
    ...(buildDiag ? {
      _buildTime: buildDiag.buildTime,
      _isVercel: buildDiag.isVercel,
      _vercelEnv: buildDiag.vercelEnv,
      _branch: buildDiag.vercelGitCommitRef,
      _detectedKeys: buildDiag.detectedEnvKeys,
      _detectedKeysDetail: buildDiag.detectedKeysDetail,
      _buildDiagnosticHint: buildDiag.isVercel
        ? `Vercel (${buildDiag.vercelEnv || 'unknown'}) build at ${buildDiag.buildTime}. Matching build keys found: [${(buildDiag.detectedEnvKeys || []).join(', ')}]`
        : `Local build at ${buildDiag.buildTime}`,
    } : {}),
  };
}

if (typeof window !== 'undefined') {
  window.__FOCUSLENS_FIREBASE_DIAGNOSTICS__ = getFirebaseDiagnostics;
}

/**
 * Checks whether the client-side Firebase environment variables are configured
 */
export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(
    cfg.apiKey &&
    (cfg.authDomain || cfg.projectId) &&
    cfg.projectId
  );
}

/**
 * Retrieves or initializes the singleton FirebaseApp instance
 */
export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    const diag = getFirebaseDiagnostics();
    const missing = Object.entries(diag)
      .filter(([k, v]) => (k === 'API key' || k === 'project ID' || k === 'auth domain') && v === 'missing')
      .map(([k]) => k);
    throw new Error(`Firebase is not configured (missing: ${missing.join(', ')}). Please check your Firebase environment variables.`);
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getApp();
  }

  const cfg = getFirebaseConfig();
  return initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
}

/**
 * Retrieves the FirebaseAuth instance
 */
export function getFirebaseAuth() {
  const app = getFirebaseApp();
  return getAuth(app);
}

/**
 * Initiates Google sign-in via Firebase popup
 * Returns the verified Firebase ID token and Firebase user object
 */
export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) {
    const error = new Error('Google sign-in is not configured. Please check your Firebase settings.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  try {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();

    return {
      idToken,
      user: credential.user,
    };
  } catch (err) {
    // Map Firebase error codes to friendly, non-technical messages
    if (err.code === 'auth/popup-closed-by-user') {
      const error = new Error('Sign-in was cancelled.');
      error.code = 'AUTH_CANCELLED';
      throw error;
    }
    if (err.code === 'auth/popup-blocked') {
      const error = new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      error.code = 'POPUP_BLOCKED';
      throw error;
    }
    if (err.code === 'auth/cancelled-popup-request') {
      const error = new Error('Only one sign-in window can be open at a time.');
      error.code = 'CONCURRENT_REQUEST';
      throw error;
    }
    if (err.code === 'auth/network-request-failed') {
      const error = new Error('Network error during Google sign-in. Please check your internet connection.');
      error.code = 'NETWORK_ERROR';
      throw error;
    }
    if (err.code === 'auth/unauthorized-domain') {
      const error = new Error('This domain or localhost is not authorized in Firebase Console (Authentication > Settings > Authorized domains).');
      error.code = 'UNAUTHORIZED_DOMAIN';
      throw error;
    }
    if (err.code === 'auth/operation-not-allowed') {
      const error = new Error('Google provider is not enabled in Firebase Console (Authentication > Sign-in method).');
      error.code = 'OPERATION_NOT_ALLOWED';
      throw error;
    }

    // Generic safe error
    const error = new Error(err.message || 'Unable to sign in with Google. Please try again.');
    error.code = err.code || 'AUTH_FAILED';
    error.originalError = err;
    throw error;
  }
}

/**
 * Optional helper to clean up Firebase client auth session
 */
export async function signOutOfFirebase() {
  try {
    if (isFirebaseConfigured() && getApps().length > 0) {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    }
  } catch (err) {
    // Non-blocking cleanup
  }
}

/**
 * Zero-cost Email + Password registration using Firebase Auth Spark (Free tier)
 */
export async function registerWithEmailPassword(email, password) {
  if (!isFirebaseConfigured()) {
    const error = new Error('Authentication is not configured. Please check your Firebase settings.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const idToken = await credential.user.getIdToken();
  return { idToken, user: credential.user };
}

/**
 * Zero-cost Email + Password sign-in using Firebase Auth Spark (Free tier)
 */
export async function loginWithEmailPassword(email, password) {
  if (!isFirebaseConfigured()) {
    const error = new Error('Authentication is not configured. Please check your Firebase settings.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const idToken = await credential.user.getIdToken();
  return { idToken, user: credential.user };
}

/**
 * Links an Email + Password credential to the currently authenticated Firebase user (e.g. Google user).
 * Preserves the exact same Firebase UID and user history.
 *
 * @param {string} newPassword - Validated new password (12+ characters)
 * @returns {Promise<{ user: any, idToken: string }>}
 */
export async function linkEmailPasswordCredential(newPassword) {
  if (!isFirebaseConfigured()) {
    const error = new Error('Authentication is not configured.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
    const error = new Error('Password must be at least 12 characters long.');
    error.code = 'auth/weak-password';
    throw error;
  }

  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    const error = new Error('No authenticated user session found in Firebase. Please sign in with Google first.');
    error.code = 'auth/no-current-user';
    throw error;
  }

  const credential = EmailAuthProvider.credential(currentUser.email, newPassword);
  const result = await linkWithCredential(currentUser, credential);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

/**
 * Zero-cost email verification dispatch using Firebase Auth Spark (Free tier)
 */
export async function sendFirebaseEmailVerification(user = null) {
  const auth = getFirebaseAuth();
  const targetUser = user || auth.currentUser;
  if (!targetUser) {
    throw new Error('No active user found to send verification email.');
  }
  await sendEmailVerification(targetUser);
  return { success: true };
}

/**
 * Retrieves the list of authentication providers registered for a given email address.
 * E.g. ['google.com'] or ['password'] or ['google.com', 'password']
 *
 * @param {string} email
 * @returns {Promise<string[]>}
 */
export async function getSignInMethods(email) {
  if (!email || !email.trim() || !isFirebaseConfigured()) return [];
  try {
    const auth = getFirebaseAuth();
    return await fetchSignInMethodsForEmail(auth, email.trim());
  } catch (err) {
    return [];
  }
}

/**
 * Returns the canonical HTTPS URL for completing password reset in FocusLens.
 * Defaults to current browser origin if valid, with production fallback.
 */
export function getPasswordResetActionUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return `${origin}/reset-password`;
    }
  }
  return 'https://focus-lens-nine.vercel.app/reset-password';
}

/**
 * Maps Firebase Auth error codes to user-friendly, safe messages without exposing internal stack traces.
 */
export function mapFirebaseAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const code = err.code || '';

  switch (code) {
    case 'auth/expired-action-code':
      return 'This password reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This password reset link is invalid or has already been used. Please request a new link.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 12 characters.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account was found for this reset link.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please wait a few moments before trying again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-action-code':
      return 'Reset code is missing. Please use the link sent to your email.';
    default:
      return err.message || 'Unable to complete password reset. Please try again.';
  }
}

/**
 * Dispatches a password reset email using Firebase Auth Spark (Free tier).
 * Configures ActionCodeSettings with continueUrl pointing to the application's /reset-password route.
 * Gracefully falls back to default dispatch if the continue URL is not yet listed in Authorized Domains.
 */
export async function sendFirebasePasswordReset(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.');
  }
  const auth = getFirebaseAuth();
  const resetUrl = getPasswordResetActionUrl();
  const actionCodeSettings = {
    url: resetUrl,
  };

  try {
    await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
  } catch (err) {
    // If continue URL is rejected due to unauthorized domain, fall back to default template link
    if (err.code === 'auth/unauthorized-continue-uri' || err.code === 'auth/invalid-continue-uri') {
      await sendPasswordResetEmail(auth, email.trim());
    } else {
      throw err;
    }
  }
  return { success: true };
}

/**
 * Read-only verification of a Firebase password reset action code (oobCode).
 * Returns the email address associated with the code.
 * DOES NOT consume or invalidate the code.
 *
 * @param {string} oobCode - The one-time action code from URL parameter
 * @returns {Promise<string>} The associated user email address
 */
export async function verifyFirebasePasswordResetCode(oobCode) {
  if (!oobCode || typeof oobCode !== 'string' || !oobCode.trim()) {
    const error = new Error('Password reset code is missing.');
    error.code = 'auth/invalid-action-code';
    throw error;
  }
  const auth = getFirebaseAuth();
  return await verifyPasswordResetCode(auth, oobCode.trim());
}

/**
 * Completes the password reset by applying the new password.
 * Consumes the oobCode ONLY upon successful execution.
 *
 * @param {string} oobCode - The one-time action code from URL parameter
 * @param {string} newPassword - The validated new password
 * @returns {Promise<{ success: boolean }>}
 */
export async function confirmFirebasePasswordReset(oobCode, newPassword) {
  if (!oobCode || typeof oobCode !== 'string' || !oobCode.trim()) {
    const error = new Error('Password reset code is missing.');
    error.code = 'auth/invalid-action-code';
    throw error;
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
    const error = new Error('Password must be at least 12 characters long.');
    error.code = 'auth/weak-password';
    throw error;
  }
  const auth = getFirebaseAuth();
  await confirmPasswordReset(auth, oobCode.trim(), newPassword);
  return { success: true };
}

/**
 * Normalizes phone numbers to standard E.164 format (+919876543210)
 * Kept for optional profile contact numbers.
 */
export function normalizeE164Phone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Please enter a phone number.');
  }

  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) {
    throw new Error('Please enter a valid phone number.');
  }

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('+')) {
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(cleaned)) {
      throw new Error('Please enter a valid international phone number (e.g. +91 98765 43210).');
    }
    return cleaned;
  }

  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  cleaned = '+' + cleaned;
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    throw new Error('Please enter a valid phone number including country code (e.g. +91 98765 43210).');
  }

  return cleaned;
}

/**
 * Zero-Cost Architecture Stubs for Recaptcha & Phone Auth
 * Real phone SMS authentication is disabled to ensure zero-cost operation without Cloud Billing.
 */
export function isRecaptchaVerifierActive() {
  return false;
}

export function cleanupRecaptchaVerifier(targetContainerOrId = null) {
  // Safe no-op in zero-cost mode
}

export function resetRecaptchaVerifier(containerOrId = null) {
  // Safe no-op in zero-cost mode
  return null;
}

export function setMockRecaptchaVerifierClass(MockClass) {}
export function resetMockRecaptchaVerifierClass() {}

export function initRecaptchaVerifier(containerOrId = 'firebase-recaptcha-container', callbacks = {}) {
  // Safe no-op in zero-cost mode
  return null;
}

export function mapFirebasePhoneAuthError(err) {
  return new Error(err?.message || 'Phone authentication is disabled in this deployment.');
}

export async function sendFirebasePhoneOtp(phoneNumber, verifierInstance = null) {
  throw new Error('Phone SMS authentication is disabled in this zero-cost open-source deployment. Please use Google Sign-In or Email/Password.');
}

export async function confirmFirebasePhoneOtp(confirmationResult, otpCode) {
  throw new Error('Phone SMS authentication is disabled in this zero-cost open-source deployment.');
}
