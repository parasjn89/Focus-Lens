import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initRecaptchaVerifier,
  cleanupRecaptchaVerifier,
  resetRecaptchaVerifier,
  isRecaptchaVerifierActive,
  isFirebaseConfigured,
  normalizeE164Phone,
  setMockRecaptchaVerifierClass,
  resetMockRecaptchaVerifierClass,
} from '../../src/lib/firebase.js';

// Minimal mock DOM Element for testing RecaptchaVerifier lifecycle in Node environment
class MockDOMElement {
  constructor(id) {
    this.id = id;
    this.nodeType = 1;
    this.childNodes = [];
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
    }
    return child;
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  get innerHTML() {
    return this.childNodes.map((c) => c.outerHTML || '<widget/>').join('');
  }

  set innerHTML(val) {
    if (!val) {
      this.childNodes = [];
    }
  }

  hasChildNodes() {
    return this.childNodes.length > 0;
  }
}

// Mock RecaptchaVerifier mimicking browser RecaptchaVerifierImpl in Node test environment
class MockRecaptchaVerifier {
  constructor(auth, container, parameters = {}) {
    this.auth = auth;
    this.container = container;
    this.parameters = parameters;
    this.type = 'recaptcha';
    this.destroyed = false;
    this.widgetId = 1;
    this.renderCount = 0;
  }

  render() {
    if (this.destroyed) throw new Error('internal-error: verifier destroyed');
    this.renderCount += 1;
    return Promise.resolve(this.widgetId);
  }

  _reset() {
    if (this.destroyed) throw new Error('internal-error: verifier destroyed');
  }

  clear() {
    this.destroyed = true;
  }
}

describe('Firebase Phone OTP reCAPTCHA Lifecycle Suite', () => {
  let originalDocument;
  let mockElements;
  let originalEnv;

  beforeEach(() => {
    mockElements = new Map();
    originalDocument = global.document;
    originalEnv = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    };

    process.env.VITE_FIREBASE_API_KEY = 'test_firebase_api_key';
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-firebase-project';
    process.env.VITE_FIREBASE_AUTH_DOMAIN = 'test-firebase-project.firebaseapp.com';

    setMockRecaptchaVerifierClass(MockRecaptchaVerifier);

    // Set up mock document
    global.document = {
      getElementById: (id) => mockElements.get(id) || null,
      body: {
        contains: (el) => Array.from(mockElements.values()).includes(el),
      },
    };

    // Clean up any lingering verifier from prior tests
    cleanupRecaptchaVerifier();
  });

  afterEach(() => {
    cleanupRecaptchaVerifier();
    resetMockRecaptchaVerifierClass();
    global.document = originalDocument;
    if (originalEnv.apiKey) process.env.VITE_FIREBASE_API_KEY = originalEnv.apiKey;
    else delete process.env.VITE_FIREBASE_API_KEY;
    if (originalEnv.projectId) process.env.VITE_FIREBASE_PROJECT_ID = originalEnv.projectId;
    else delete process.env.VITE_FIREBASE_PROJECT_ID;
    if (originalEnv.authDomain) process.env.VITE_FIREBASE_AUTH_DOMAIN = originalEnv.authDomain;
    else delete process.env.VITE_FIREBASE_AUTH_DOMAIN;
  });

  it('1. Throws an error when the target reCAPTCHA container is missing from the DOM', () => {
    assert.throws(
      () => {
        initRecaptchaVerifier('non-existent-recaptcha-container');
      },
      {
        message: /reCAPTCHA container element "non-existent-recaptcha-container" was not found in the DOM/i,
      }
    );
  });

  it('2. First initialization creates and registers a valid RecaptchaVerifier instance', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    const verifier = initRecaptchaVerifier('firebase-login-recaptcha');

    assert.ok(verifier, 'Verifier should be returned');
    assert.equal(verifier.type, 'recaptcha');
    assert.equal(isRecaptchaVerifierActive(), true, 'Verifier should be marked active');
  });

  it('3. Repeated send click reuses the existing verifier without recreating or throwing duplicate render error', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    // First initialization (first click)
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier1);

    // Simulate reCAPTCHA having rendered a widget element into the container
    container.appendChild({ outerHTML: '<div class="grecaptcha-badge"></div>' });
    assert.equal(container.hasChildNodes(), true);

    // Second initialization (repeated click / resend without unmount)
    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');

    // MUST return the exact same instance to prevent "reCAPTCHA has already been rendered in this element"
    assert.equal(verifier1, verifier2, 'Repeated click must reuse the active verifier instance');
    assert.equal(isRecaptchaVerifierActive(), true);
  });

  it('4. Failed OTP send triggers reset and allows clean retry without duplicate render', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    // First attempt
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    container.appendChild({ outerHTML: '<iframe src="recaptcha"></iframe>' });

    // Simulate OTP failure handling: resetRecaptchaVerifier is called
    resetRecaptchaVerifier(container);

    // Container DOM must be emptied so next render cannot encounter "already rendered"
    assert.equal(container.childNodes.length, 0, 'Container DOM must be empty after reset');
    assert.equal(isRecaptchaVerifierActive(), false, 'Verifier must be inactive after reset');

    // Subsequent retry attempt
    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier2, 'New verifier should be created cleanly for retry');
    assert.equal(isRecaptchaVerifierActive(), true);
  });

  it('5. Component unmount cleanly destroys verifier and clears container DOM', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    const verifier = initRecaptchaVerifier('firebase-login-recaptcha');
    container.appendChild({ outerHTML: '<div class="widget"></div>' });

    // Component unmounts
    cleanupRecaptchaVerifier('firebase-login-recaptcha');

    assert.equal(container.childNodes.length, 0, 'Container inner elements must be removed on unmount');
    assert.equal(isRecaptchaVerifierActive(), false, 'Active verifier must be cleared on unmount');
  });

  it('6. Component remount (e.g. React StrictMode or mode switch) creates clean new verifier', () => {
    // Mount 1
    const container1 = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container1);
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier1);

    // Unmount 1
    cleanupRecaptchaVerifier('firebase-login-recaptcha');
    mockElements.delete('firebase-login-recaptcha');

    // Mount 2 (new DOM node in StrictMode or re-navigation)
    const container2 = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container2);

    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier2, 'Remount should successfully initialize new verifier');
    assert.notEqual(verifier1, verifier2, 'New verifier instance should be bound to new DOM container');
    assert.equal(isRecaptchaVerifierActive(), true);
  });

  it('7. Phone normalization handles various formats correctly before reCAPTCHA dispatch', () => {
    assert.equal(normalizeE164Phone('9876543210'), '+919876543210');
    assert.equal(normalizeE164Phone('+91 98765 43210'), '+919876543210');
    assert.equal(normalizeE164Phone('00919876543210'), '+919876543210');
    assert.throws(() => normalizeE164Phone('12345'), /valid phone number/i);
    assert.throws(() => normalizeE164Phone(''), /enter a phone number/i);
  });
});
