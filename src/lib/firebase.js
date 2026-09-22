import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';

export function getFirebaseConfig() {
  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
    appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
  };
}

/**
 * Checks whether the client-side Firebase environment variables are configured
 */
export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig();
  return Boolean(
    cfg.apiKey &&
    cfg.authDomain &&
    cfg.projectId
  );
}

/**
 * Retrieves or initializes the singleton FirebaseApp instance
 */
export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error('Google sign-in is not configured on the client. Missing Firebase configuration.');
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getApp();
  }
  return initializeApp(getFirebaseConfig());
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
 * Normalizes phone numbers to standard E.164 format (+919876543210)
 */
export function normalizeE164Phone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Please enter a phone number.');
  }

  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) {
    throw new Error('Please enter a valid phone number.');
  }

  // Handle leading 00 international prefix
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If already starts with '+', validate directly
  if (cleaned.startsWith('+')) {
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(cleaned)) {
      throw new Error('Please enter a valid international phone number (e.g. +91 98765 43210).');
    }
    return cleaned;
  }

  // If 10 digits without '+' prefix (common for Indian mobile numbers 6/7/8/9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Otherwise prefix with '+' and validate
  cleaned = '+' + cleaned;
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    throw new Error('Please enter a valid phone number including country code (e.g. +91 98765 43210).');
  }

  return cleaned;
}

/**
 * Global singleton reference for RecaptchaVerifier to prevent duplicate instances
 */
let activeRecaptchaVerifier = null;

/**
 * Initializes or resets the Firebase RecaptchaVerifier on a DOM element.
 * Uses invisible reCAPTCHA for seamless user experience.
 */
export function initRecaptchaVerifier(containerOrId = 'firebase-recaptcha-container', callbacks = {}) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please check your Firebase environment variables.');
  }

  const auth = getFirebaseAuth();

  // Clean up any existing verifier
  cleanupRecaptchaVerifier();

  try {
    activeRecaptchaVerifier = new RecaptchaVerifier(auth, containerOrId, {
      size: 'invisible',
      callback: (response) => {
        if (typeof callbacks.onSuccess === 'function') {
          callbacks.onSuccess(response);
        }
      },
      'expired-callback': () => {
        cleanupRecaptchaVerifier();
        if (typeof callbacks.onExpired === 'function') {
          callbacks.onExpired();
        }
      },
      ...callbacks.parameters,
    });

    return activeRecaptchaVerifier;
  } catch (err) {
    console.warn('[Firebase RecaptchaVerifier Init Error]:', err);
    throw new Error('Failed to initialize SMS security verification. Please refresh the page and try again.');
  }
}

/**
 * Safely cleans up the active RecaptchaVerifier instance and clears DOM widgets
 */
export function cleanupRecaptchaVerifier() {
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch (e) {
      // Ignored if already destroyed
    }
    activeRecaptchaVerifier = null;
  }
}

/**
 * Sends a real Firebase SMS OTP to the normalized phone number.
 * Returns confirmationResult object required for subsequent OTP verification.
 */
export async function sendFirebasePhoneOtp(phoneNumber, verifierInstance = null) {
  if (!isFirebaseConfigured()) {
    throw new Error('Phone authentication is not configured. Please check your Firebase settings.');
  }

  const normalizedPhone = normalizeE164Phone(phoneNumber);
  const auth = getFirebaseAuth();
  const verifier = verifierInstance || activeRecaptchaVerifier;

  if (!verifier) {
    throw new Error('SMS verification helper is not ready. Please try again.');
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
    return {
      confirmationResult,
      phoneNumber: normalizedPhone,
    };
  } catch (err) {
    // Clean up verifier on error so it can be re-rendered on retry
    cleanupRecaptchaVerifier();

    if (err.code === 'auth/invalid-phone-number') {
      throw new Error('The phone number is invalid. Please enter a valid number with country code (e.g. +91 98765 43210).');
    }
    if (err.code === 'auth/missing-phone-number') {
      throw new Error('Phone number is required.');
    }
    if (err.code === 'auth/quota-exceeded') {
      throw new Error('SMS quota for this project has been exceeded. Please try again later.');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please wait a few minutes before requesting another code.');
    }
    if (err.code === 'auth/captcha-check-failed') {
      throw new Error('reCAPTCHA verification failed. Please try again.');
    }
    if (err.code === 'auth/billing-not-enabled' || err.code === 'auth/operation-not-allowed') {
      throw new Error('Phone authentication is not enabled in Firebase Console. Please check SMS settings.');
    }

    const errorMsg = err.message || 'Failed to send SMS verification code. Please try again.';
    const customErr = new Error(errorMsg);
    customErr.code = err.code || 'SMS_SEND_FAILED';
    throw customErr;
  }
}

/**
 * Confirms the SMS OTP with Firebase confirmationResult.
 * Returns the Firebase user and verified Firebase ID token for backend authentication.
 */
export async function confirmFirebasePhoneOtp(confirmationResult, otpCode) {
  if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
    throw new Error('Verification session expired or invalid. Please request a new code.');
  }

  const cleanCode = String(otpCode || '').trim();
  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    throw new Error('Please enter a valid 6-digit verification code.');
  }

  try {
    const userCredential = await confirmationResult.confirm(cleanCode);
    const idToken = await userCredential.user.getIdToken(true);

    return {
      idToken,
      user: userCredential.user,
      phoneNumber: userCredential.user.phoneNumber,
    };
  } catch (err) {
    if (err.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid verification code. Please check the SMS and try again.');
    }
    if (err.code === 'auth/code-expired') {
      throw new Error('Verification code has expired. Please request a new code.');
    }
    if (err.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact support.');
    }

    const errorMsg = err.message || 'Failed to verify code. Please try again.';
    const customErr = new Error(errorMsg);
    customErr.code = err.code || 'OTP_VERIFICATION_FAILED';
    throw customErr;
  }
}

