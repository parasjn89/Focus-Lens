import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { mapErrorToField } from '../../src/utils/registrationValidation.js';

describe('Registration Validation UX & Field Mapping Test Suite', () => {
  let app;
  const tag = () => Math.random().toString(36).substring(2, 7);
  const genPhone = () => `+919${Math.floor(100000000 + Math.random() * 900000000)}`;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('Part 1: mapErrorToField Mapping Logic', () => {
    test('1. Username uniqueness error maps to "username" with clear, friendly instruction', () => {
      const result1 = mapErrorToField(new Error('That username is already taken. Please choose another.'));
      assert.equal(result1.field, 'username');
      assert.equal(result1.message, 'Username is already taken. Please choose another username.');

      const result2 = mapErrorToField({ message: 'Username is already taken' });
      assert.equal(result2.field, 'username');
      assert.equal(result2.message, 'Username is already taken. Please choose another username.');

      const result3 = mapErrorToField({ field: 'username', message: 'That username is already taken. Please choose another.' });
      assert.equal(result3.field, 'username');
      assert.equal(result3.message, 'Username is already taken. Please choose another username.');
    });

    test('2. Username format/length error maps to "username"', () => {
      const result = mapErrorToField(new Error('Username must be between 3 and 30 characters long.'));
      assert.equal(result.field, 'username');
      assert.equal(result.message, 'Username must be between 3 and 30 characters long.');
    });

    test('3. Duplicate email error maps to "email" with sign-in guidance', () => {
      const result1 = mapErrorToField(new Error('An account with this email address already exists. Please sign in.'));
      assert.equal(result1.field, 'email');
      assert.equal(result1.message, 'An account with this email address already exists. Please sign in.');

      const result2 = mapErrorToField({ field: 'email', message: 'Email address already exists' });
      assert.equal(result2.field, 'email');
      assert.equal(result2.message, 'An account with this email address already exists. Please sign in.');
    });

    test('4. Duplicate phone error maps to "phoneNumber" with sign-in guidance', () => {
      const result1 = mapErrorToField(new Error('An account with this phone number already exists. Please sign in.'));
      assert.equal(result1.field, 'phoneNumber');
      assert.equal(result1.message, 'An account with this phone number already exists. Please sign in.');

      const result2 = mapErrorToField({ field: 'phoneNumber', message: 'Phone number already registered' });
      assert.equal(result2.field, 'phoneNumber');
      assert.equal(result2.message, 'An account with this phone number already exists. Please sign in.');
    });

    test('5. Password confirmation mismatch maps to "confirmPassword"', () => {
      const result = mapErrorToField(new Error('Passwords do not match.'));
      assert.equal(result.field, 'confirmPassword');
      assert.equal(result.message, 'Passwords do not match.');
    });

    test('6. Password policy / length errors map to "password"', () => {
      const result1 = mapErrorToField(new Error('Password must be at least 12 characters long.'));
      assert.equal(result1.field, 'password');
      assert.equal(result1.message, 'Password must be at least 12 characters long.');

      const result2 = mapErrorToField(new Error('This password is too common or easily guessable. Please choose a more unique password or passphrase.'));
      assert.equal(result2.field, 'password');
    });

    test('7. Full name validation error maps to "name"', () => {
      const result = mapErrorToField(new Error('Name must be at least 2 characters long'));
      assert.equal(result.field, 'name');
    });

    test('8. Generic server or network errors return field: null and preserve message', () => {
      const result1 = mapErrorToField(new Error('Network error: connection refused'));
      assert.equal(result1.field, null);
      assert.equal(result1.message, 'Network error: connection refused');

      const result2 = mapErrorToField(new Error('API Request timed out'));
      assert.equal(result2.field, null);
      assert.equal(result2.message, 'API Request timed out');

      const result3 = mapErrorToField(null);
      assert.equal(result3.field, null);
      assert.match(result3.message, /registration failed/i);
    });

    test('9. Backend response with nested data.field is honored', () => {
      const err = new Error('Field failed');
      err.data = { field: 'username' };
      const result = mapErrorToField(err);
      assert.equal(result.field, 'username');
    });
  });

  describe('Part 2: Backend API Registration Validation Attributes', () => {
    test('10. Duplicate username response includes field: "username"', async () => {
      const username = `dupux_${tag()}`;
      const email1 = `dupux1_${tag()}@example.com`;
      const email2 = `dupux2_${tag()}@example.com`;

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'User One',
          username,
          email: email1,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res1.statusCode, 201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'User Two',
          username,
          email: email2,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res2.statusCode, 400);
      const body2 = JSON.parse(res2.payload);
      assert.equal(body2.field, 'username');
      assert.equal(body2.message, 'That username is already taken. Please choose another.');
    });

    test('11. Duplicate email response includes field: "email"', async () => {
      const email = `dupemail_${tag()}@example.com`;

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Email User 1',
          username: `u1_${tag()}`,
          email,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res1.statusCode, 201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Email User 2',
          username: `u2_${tag()}`,
          email,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res2.statusCode, 400);
      const body2 = JSON.parse(res2.payload);
      assert.equal(body2.field, 'email');
      assert.equal(body2.message, 'An account with this email address already exists. Please sign in.');
    });

    test('12. Duplicate phone response includes field: "phoneNumber"', async () => {
      const phone = genPhone();

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Phone User 1',
          username: `pu1_${tag()}`,
          phoneNumber: phone,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'PHONE',
        },
      });
      assert.equal(res1.statusCode, 201);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Phone User 2',
          username: `pu2_${tag()}`,
          phoneNumber: phone,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'PHONE',
        },
      });
      assert.equal(res2.statusCode, 400);
      const body2 = JSON.parse(res2.payload);
      assert.equal(body2.field, 'phoneNumber');
      assert.equal(body2.message, 'An account with this phone number already exists. Please sign in.');
    });

    test('13. Password policy violation response includes field: "password"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Password User',
          username: `pw_${tag()}`,
          email: `pw_${tag()}@example.com`,
          password: '123456789012', // Common weak password
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.field, 'password');
      assert.match(body.message, /common|easily guessable/i);
    });

    test('14. Zod schema validation response includes field and errors array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'A', // too short (< 2)
          username: `u_${tag()}`,
          email: `shortname_${tag()}@example.com`,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.field, 'name');
      assert.ok(Array.isArray(body.errors));
      assert.equal(body.errors[0].field, 'name');
    });

    test('15. Valid unique registration succeeds with HTTP 201', async () => {
      const username = `success_${tag()}`;
      const email = `success_${tag()}@example.com`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Successful Registrant',
          username,
          email,
          password: 'SecurePassphrase9876!',
          verificationMethod: 'EMAIL',
        },
      });
      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.equal(body.user.username, username);
      assert.equal(body.user.email, email);
    });
  });
});
