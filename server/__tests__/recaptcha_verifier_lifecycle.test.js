import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initRecaptchaVerifier,
  cleanupRecaptchaVerifier,
  resetRecaptchaVerifier,
  isRecaptchaVerifierActive,
  isFirebaseConfigured,
  normalizeE164Phone,
  getFirebaseDiagnostics,
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
} from '../../src/lib/firebase.js';

describe('Zero-Cost Open-Source Auth & Recaptcha Lifecycle Suite', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    };

    process.env.VITE_FIREBASE_API_KEY = 'test_firebase_api_key';
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-firebase-project';
    process.env.VITE_FIREBASE_AUTH_DOMAIN = 'test-firebase-project.firebaseapp.com';
  });

  afterEach(() => {
    cleanupRecaptchaVerifier();
    if (originalEnv.apiKey) process.env.VITE_FIREBASE_API_KEY = originalEnv.apiKey;
    else delete process.env.VITE_FIREBASE_API_KEY;
    if (originalEnv.projectId) process.env.VITE_FIREBASE_PROJECT_ID = originalEnv.projectId;
    else delete process.env.VITE_FIREBASE_PROJECT_ID;
    if (originalEnv.authDomain) process.env.VITE_FIREBASE_AUTH_DOMAIN = originalEnv.authDomain;
    else delete process.env.VITE_FIREBASE_AUTH_DOMAIN;
  });

  it('1. Zero-Cost Mode: initRecaptchaVerifier returns null and never renders reCAPTCHA or requires Cloud Billing', () => {
    const verifier = initRecaptchaVerifier('non-existent-recaptcha-container');
    assert.equal(verifier, null, 'RecaptchaVerifier must return null in zero-cost mode');
    assert.equal(isRecaptchaVerifierActive(), false, 'Recaptcha must not be active');
  });

  it('2. Zero-Cost Mode: cleanupRecaptchaVerifier and resetRecaptchaVerifier are safe no-ops', () => {
    assert.doesNotThrow(() => {
      cleanupRecaptchaVerifier('some-container');
      const res = resetRecaptchaVerifier('some-container');
      assert.equal(res, null);
    });
  });

  it('3. Zero-Cost Mode: sendFirebasePhoneOtp rejects indicating phone SMS is disabled', async () => {
    await assert.rejects(
      async () => {
        await sendFirebasePhoneOtp('+919876543210');
      },
      {
        message: /Phone SMS authentication is disabled in this zero-cost open-source deployment/i,
      }
    );
  });

  it('4. Zero-Cost Mode: confirmFirebasePhoneOtp rejects indicating phone SMS is disabled', async () => {
    await assert.rejects(
      async () => {
        await confirmFirebasePhoneOtp({}, '123456');
      },
      {
        message: /Phone SMS authentication is disabled in this zero-cost open-source deployment/i,
      }
    );
  });

  it('5. Phone normalization handles valid contact formats for optional user profiles', () => {
    assert.equal(normalizeE164Phone('9876543210'), '+919876543210');
    assert.equal(normalizeE164Phone('+91 98765 43210'), '+919876543210');
    assert.equal(normalizeE164Phone('00919876543210'), '+919876543210');
    assert.throws(() => normalizeE164Phone('12345'), /valid phone number/i);
    assert.throws(() => normalizeE164Phone(''), /enter a phone number/i);
  });

  it('6. isFirebaseConfigured returns true when environment variables are set', () => {
    assert.equal(isFirebaseConfigured(), true);
  });

  it('7. getFirebaseDiagnostics reports safe details without exposing sensitive keys', () => {
    const diag = getFirebaseDiagnostics();
    assert.equal(diag.projectId, 'test-firebase-project');
    assert.equal(diag.authDomain, 'test-firebase-project.firebaseapp.com');
    assert.equal(diag.configCompleteness, 'complete');
    assert.equal(diag['API key'], 'present');
    assert.equal(diag.apiKey, undefined, 'Raw apiKey property must not be leaked');
    assert.equal(Object.values(diag).includes('test_firebase_api_key'), false, 'Raw API key must not be exposed');
  });
});
