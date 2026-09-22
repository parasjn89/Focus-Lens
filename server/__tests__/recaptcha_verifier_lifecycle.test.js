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
  mapFirebasePhoneAuthError,
  getFirebaseDiagnostics,
  getLastPhoneAuthError,
  clearLastPhoneAuthError,
  setLastPhoneAuthError,
} from '../../src/lib/firebase.js';

// Mock DOM Element for testing RecaptchaVerifier lifecycle in Node environment
class MockDOMElement {
  constructor(id, tagName = 'div') {
    this.id = id || '';
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.attributes = new Map();
    this.style = {};
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  appendChild(child) {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  get innerHTML() {
    return this.childNodes.map((c) => c.outerHTML || '<widget/>').join('');
  }

  set innerHTML(val) {
    if (!val) {
      for (const child of this.childNodes) {
        child.parentNode = null;
      }
      this.childNodes = [];
    }
  }

  hasChildNodes() {
    return this.childNodes.length > 0;
  }

  contains(target) {
    if (!target) return false;
    if (target === this) return true;
    for (const child of this.childNodes) {
      if (child === target) return true;
      if (typeof child.contains === 'function' && child.contains(target)) return true;
    }
    return false;
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
    this.resetCount = 0;
  }

  render() {
    if (this.destroyed) throw new Error('internal-error: verifier destroyed');
    this.renderCount += 1;
    return Promise.resolve(this.widgetId);
  }

  _reset() {
    if (this.destroyed) throw new Error('internal-error: verifier destroyed');
    this.resetCount += 1;
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
      createElement: (tag) => new MockDOMElement('', tag),
      getElementById: (id) => mockElements.get(id) || null,
      body: {
        contains: (el) => {
          if (!el) return false;
          for (const topEl of mockElements.values()) {
            if (topEl === el || (typeof topEl.contains === 'function' && topEl.contains(el))) {
              return true;
            }
          }
          return false;
        },
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

  it('2. First initialization creates and registers a valid RecaptchaVerifier instance on dedicated inner target', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    const verifier = initRecaptchaVerifier('firebase-login-recaptcha');

    assert.ok(verifier, 'Verifier should be returned');
    assert.equal(verifier.type, 'recaptcha');
    assert.equal(isRecaptchaVerifierActive(), true, 'Verifier should be marked active');

    // Dedicated inner child target node should have been created
    const innerTarget = container.childNodes[0];
    assert.ok(innerTarget, 'Inner target node should be appended to container');
    assert.equal(innerTarget.getAttribute('data-recaptcha-target'), 'true');
    assert.equal(verifier.container, innerTarget, 'Verifier should attach to dedicated inner target');
  });

  it('3. Repeated send click reuses the existing verifier without recreating or throwing duplicate render error', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    // First initialization (first click)
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier1);

    // Simulate reCAPTCHA having rendered a widget element into the container
    container.childNodes[0].appendChild({ outerHTML: '<div class="grecaptcha-badge"></div>' });

    // Second initialization (repeated click / resend without unmount)
    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');

    // MUST return the exact same instance to prevent "reCAPTCHA has already been rendered in this element"
    assert.equal(verifier1, verifier2, 'Repeated click must reuse the active verifier instance');
    assert.equal(isRecaptchaVerifierActive(), true);
  });

  it('4. resetRecaptchaVerifier resets active widget state without destroying verifier, keeping it ready for retry', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    // First attempt
    const verifier = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier);
    assert.equal(verifier.resetCount, 0);

    // Non-destructive reset on error or user action
    const resetResult = resetRecaptchaVerifier('firebase-login-recaptcha');

    assert.equal(resetResult, verifier, 'resetRecaptchaVerifier should return the active verifier');
    assert.equal(verifier.resetCount, 1, 'Verifier _reset should be called');
    assert.equal(verifier.destroyed, false, 'Verifier must NOT be destroyed by widget reset');
    assert.equal(isRecaptchaVerifierActive(), true, 'Verifier must remain active after widget reset');

    // Retry call to initRecaptchaVerifier safely reuses this healthy active verifier
    const retryVerifier = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.equal(retryVerifier, verifier, 'Retry must reuse healthy verifier instance');
  });

  it('5. User editing phone number (Number A -> Number B) retains active verifier and allows clean resend', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    // First phone number send
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier1);

    // User edits phone number: LoginPage calls resetRecaptchaVerifier
    resetRecaptchaVerifier('firebase-login-recaptcha');
    assert.equal(isRecaptchaVerifierActive(), true);

    // User clicks "Send Verification Code" with new phone number B
    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.equal(verifier1, verifier2, 'Must reuse the existing verifier when phone number changes');
  });

  it('6. Component unmount cleanly destroys verifier and clears container DOM', () => {
    const container = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container);

    const verifier = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier);

    // Component unmounts
    cleanupRecaptchaVerifier('firebase-login-recaptcha');

    assert.equal(verifier.destroyed, true, 'Verifier must be destroyed on cleanup');
    assert.equal(container.childNodes.length, 0, 'Container inner elements must be removed on unmount');
    assert.equal(isRecaptchaVerifierActive(), false, 'Active verifier must be cleared on unmount');
  });

  it('7. Component remount (e.g. React StrictMode or mode switch) creates clean new verifier with fresh inner target', () => {
    // Mount 1
    const container1 = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container1);
    const verifier1 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier1);
    const firstTargetNode = verifier1.container;

    // Unmount 1
    cleanupRecaptchaVerifier('firebase-login-recaptcha');
    mockElements.delete('firebase-login-recaptcha');

    // Mount 2 (new DOM node in StrictMode or re-navigation)
    const container2 = new MockDOMElement('firebase-login-recaptcha');
    mockElements.set('firebase-login-recaptcha', container2);

    const verifier2 = initRecaptchaVerifier('firebase-login-recaptcha');
    assert.ok(verifier2, 'Remount should successfully initialize new verifier');
    assert.notEqual(verifier1, verifier2, 'New verifier instance should be bound');
    assert.notEqual(firstTargetNode, verifier2.container, 'Target node must be a fresh DOM element');
    assert.equal(isRecaptchaVerifierActive(), true);
  });

  it('8. Phone normalization handles various formats correctly before reCAPTCHA dispatch', () => {
    assert.equal(normalizeE164Phone('9876543210'), '+919876543210');
    assert.equal(normalizeE164Phone('+91 98765 43210'), '+919876543210');
    assert.equal(normalizeE164Phone('00919876543210'), '+919876543210');
    assert.throws(() => normalizeE164Phone('12345'), /valid phone number/i);
    assert.throws(() => normalizeE164Phone(''), /enter a phone number/i);
  });

  it('9. mapFirebasePhoneAuthError handles "already been rendered" specifically with auth/captcha-check-failed', () => {
    const renderedErr = mapFirebasePhoneAuthError({
      message: 'reCAPTCHA has already been rendered in this element',
      code: 'auth/unknown',
    });
    assert.equal(renderedErr.code, 'auth/captcha-check-failed');
    assert.match(renderedErr.message, /verification helper was busy/i);
    assert.doesNotMatch(renderedErr.message, /Cloud Billing/i);
    assert.doesNotMatch(renderedErr.message, /Phone authentication is not enabled/i);
  });

  it('10. mapFirebasePhoneAuthError distinguishes auth/billing-not-enabled from auth/operation-not-allowed', () => {
    const billingErr = mapFirebasePhoneAuthError({ code: 'auth/billing-not-enabled', message: 'Firebase: Error (auth/billing-not-enabled).' });
    assert.equal(billingErr.code, 'auth/billing-not-enabled');
    assert.match(billingErr.message, /Cloud Billing is not enabled/i);
    assert.match(billingErr.message, /Blaze plan/i);
    assert.doesNotMatch(billingErr.message, /Phone authentication is not enabled in Firebase Console/i);

    const operationErr = mapFirebasePhoneAuthError({ code: 'auth/operation-not-allowed', message: 'Firebase: Error (auth/operation-not-allowed).' });
    assert.equal(operationErr.code, 'auth/operation-not-allowed');
    assert.match(operationErr.message, /Phone sign-in is disabled or not allowed/i);
    assert.doesNotMatch(operationErr.message, /Cloud Billing/i);
  });

  it('11. mapFirebasePhoneAuthError accurately maps all specific Firebase auth error codes', () => {
    const domainErr = mapFirebasePhoneAuthError({ code: 'auth/unauthorized-domain' });
    assert.equal(domainErr.code, 'auth/unauthorized-domain');
    assert.match(domainErr.message, /domain is not authorized/i);

    const appErr = mapFirebasePhoneAuthError({ code: 'auth/app-not-authorized' });
    assert.equal(appErr.code, 'auth/app-not-authorized');
    assert.match(appErr.message, /not authorized to use Firebase Authentication/i);

    const quotaErr = mapFirebasePhoneAuthError({ code: 'auth/quota-exceeded' });
    assert.equal(quotaErr.code, 'auth/quota-exceeded');
    assert.match(quotaErr.message, /quota for this project has been exceeded/i);

    const rateErr = mapFirebasePhoneAuthError({ code: 'auth/too-many-requests' });
    assert.equal(rateErr.code, 'auth/too-many-requests');
    assert.match(rateErr.message, /Too many attempts/i);

    const captchaErr = mapFirebasePhoneAuthError({ code: 'auth/captcha-check-failed' });
    assert.equal(captchaErr.code, 'auth/captcha-check-failed');
    assert.match(captchaErr.message, /reCAPTCHA verification failed/i);
  });

  it('12. getFirebaseDiagnostics reports safe details without exposing sensitive keys', () => {
    const diag = getFirebaseDiagnostics();
    assert.equal(diag.projectId, 'test-firebase-project');
    assert.equal(diag.authDomain, 'test-firebase-project.firebaseapp.com');
    assert.equal(diag.configCompleteness, 'complete');
    assert.equal(diag['API key'], 'present');
    // Ensure raw secret is not in the object keys or values
    assert.equal(diag.apiKey, undefined, 'Raw apiKey property must not be leaked');
    assert.equal(Object.values(diag).includes('test_firebase_api_key'), false, 'Raw API key must not be exposed');
  });

  it('13. setLastPhoneAuthError and clearLastPhoneAuthError accurately track and clear error state', () => {
    clearLastPhoneAuthError();
    assert.equal(getLastPhoneAuthError(), null);

    const testErr = mapFirebasePhoneAuthError({ code: 'auth/billing-not-enabled', message: 'Original raw message' });
    setLastPhoneAuthError(testErr);

    const last = getLastPhoneAuthError();
    assert.ok(last);
    assert.equal(last.code, 'auth/billing-not-enabled');
    assert.match(last.message, /Cloud Billing/i);
    assert.equal(last.rawMessage, 'Original raw message');

    const diag = getFirebaseDiagnostics();
    assert.equal(diag.lastErrorCode, 'auth/billing-not-enabled');
    assert.match(diag.lastErrorMessage, /Cloud Billing/i);

    clearLastPhoneAuthError();
    assert.equal(getLastPhoneAuthError(), null);
    assert.equal(getFirebaseDiagnostics().lastErrorCode, null);
  });
});
