import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
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
