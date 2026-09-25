import { config } from '../config/env.js';

let mockEmailTransport = null;

/**
 * Set mock email transport function for tests
 * @param {Function|null} transportFn ({ from, to, subject, text }) => Promise<{ messageId: string }>
 */
export function setMockEmailTransport(transportFn) {
  mockEmailTransport = transportFn;
}

/**
 * Reset test mock transport
 */
export function resetMockEmailTransport() {
  mockEmailTransport = null;
}

/**
 * Helper to sanitize error messages so credentials/tokens/emails are never exposed in logs or return values
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return 'Unknown email delivery error';
  let safe = String(msg);
  if (config.emailPassword) {
    safe = safe.replaceAll(config.emailPassword, '[REDACTED_PASSWORD]');
  }
  if (config.resendApiKey) {
    safe = safe.replaceAll(config.resendApiKey, '[REDACTED_API_KEY]');
  }
  // Sanitize any recipient or personal email that Resend might echo back in error messages
  safe = safe.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  return safe;
}

/**
 * Dispatches an email via SMTP (Nodemailer)
 */
async function sendViaSmtp({ fromEmail, to, subject, text }) {
  if (!config.emailHost) {
    const errorMsg = "EMAIL_PROVIDER is set to 'smtp' but EMAIL_HOST is not configured.";
    console.error(`[Email Service Failure] ${errorMsg}`);
    return { success: false, error: errorMsg, provider: 'smtp' };
  }

  try {
    if (typeof mockEmailTransport === 'function') {
      const info = await mockEmailTransport({ from: fromEmail, to, subject, text });
      return { success: true, provider: 'smtp', messageId: info?.messageId || 'mock-smtp-id' };
    }

    // In test environment without explicit mock transport, avoid outbound network transmission
    if (config.nodeEnv === 'test') {
      return { success: true, provider: 'smtp', messageId: 'test-smtp-id' };
    }

    const nodemailer = await import('nodemailer');
    const isSecure = config.emailSecure !== undefined
      ? Boolean(config.emailSecure)
      : (String(config.emailPort) === '465');

    const transporter = nodemailer.default.createTransport({
      host: config.emailHost,
      port: parseInt(config.emailPort || '587', 10),
      secure: isSecure,
      auth: config.emailUsername ? {
        user: config.emailUsername,
        pass: config.emailPassword,
      } : undefined,
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
    });

    console.log(`[Email Service] SMTP email sent successfully (Message ID: ${info.messageId})`);
    return { success: true, provider: 'smtp', messageId: info.messageId };
  } catch (err) {
    const safeError = sanitizeErrorMessage(err.message);
    console.error(`[Email Service Failure] SMTP transmission error:`, safeError);
    return { success: false, error: safeError, provider: 'smtp' };
  }
}

/**
 * Dispatches an email via Resend
 */
async function sendViaResend({ fromEmail, to, subject, text }) {
  try {
    if (typeof mockEmailTransport === 'function') {
      const info = await mockEmailTransport({ from: fromEmail, to, subject, text });
      return { success: true, provider: 'resend', messageId: info?.messageId || 'mock-resend-id' };
    }

    // In test environment without explicit mock transport, avoid outbound API calls
    if (config.nodeEnv === 'test') {
      return { success: true, provider: 'resend', messageId: 'test-resend-id' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(config.resendApiKey);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      text,
    });

    if (error) {
      const isSandboxRestriction = (error.message || '').includes('only send testing emails to your own email address') ||
        (error.name === 'validation_error' && (error.message || '').includes('resend.com/domains'));
      const safeError = sanitizeErrorMessage(error.message || error);
      console.error(`[Resend Email Service Failure] Failed to send email:`, safeError);
      return { success: false, error: safeError, isSandboxRestriction, provider: 'resend' };
    }

    console.log(`[Resend Email Service] Email sent successfully (Message ID: ${data?.id})`);
    return { success: true, provider: 'resend', messageId: data?.id };
  } catch (err) {
    const isSandboxRestriction = (err.message || '').includes('only send testing emails to your own email address') ||
      ((err.message || '').includes('resend.com/domains'));
    const safeError = sanitizeErrorMessage(err.message);
    console.error(`[Resend Email Service Failure] Resend API error:`, safeError);
    return { success: false, error: safeError, isSandboxRestriction, provider: 'resend' };
  }
}

/**
 * Dispatches an email via Ethereal test account
 */
async function sendViaEthereal({ fromEmail, to, subject, text }) {
  try {
    const nodemailer = await import('nodemailer');
    const testAccount = await nodemailer.default.createTestAccount();
    const transporter = nodemailer.default.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
    });

    const previewUrl = nodemailer.default.getTestMessageUrl(info);
    console.log(`\n==================================================`);
    console.log(`[EMAIL PROVIDER (ETHEREAL TEST INBOX)]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Preview URL: ${previewUrl}`);
    console.log(`==================================================\n`);
    return { success: true, provider: 'ethereal', previewUrl };
  } catch (err) {
    const safeError = sanitizeErrorMessage(err.message);
    console.error(`[Email Service Failure] Ethereal test account error:`, safeError);
    return { success: false, error: safeError, provider: 'ethereal' };
  }
}

/**
 * Send email verification challenge to user
 */
export async function sendEmailVerificationChallenge({ email, otp, name }) {
  const provider = (config.emailProvider || 'dev').toLowerCase();
  const fromEmail = config.emailFrom || config.emailUsername || 'onboarding@resend.dev';

  const subject = 'Verify Your FocusLens Account';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYour FocusLens verification code is: ${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'smtp') {
    return await sendViaSmtp({ fromEmail, to: email, subject, text: textContent });
  }

  if (provider === 'resend' || (config.resendApiKey && provider !== 'ethereal' && provider !== 'dev')) {
    return await sendViaResend({ fromEmail, to: email, subject, text: textContent });
  }

  if (provider === 'ethereal') {
    return await sendViaEthereal({ fromEmail, to: email, subject, text: textContent });
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test' && config.nodeEnv !== 'production') {
    console.log(`\n==================================================`);
    console.log(`[EMAIL PROVIDER (DEV)] Verification Challenge`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Verification Code (OTP): [${otp}]`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}

/**
 * Send password reset OTP email to user
 */
export async function sendEmailPasswordResetOtp({ email, otp, name }) {
  const provider = (config.emailProvider || 'dev').toLowerCase();
  const fromEmail = config.emailFrom || config.emailUsername || 'onboarding@resend.dev';

  const subject = 'Reset Your FocusLens Password';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYour FocusLens password reset code is:\n\n${otp}\n\nThis code will expire in 10 minutes. If you did not request a password reset, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'smtp') {
    return await sendViaSmtp({ fromEmail, to: email, subject, text: textContent });
  }

  if (provider === 'resend' || (config.resendApiKey && provider !== 'ethereal' && provider !== 'dev')) {
    return await sendViaResend({ fromEmail, to: email, subject, text: textContent });
  }

  if (provider === 'ethereal') {
    return await sendViaEthereal({ fromEmail, to: email, subject, text: textContent });
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test' && config.nodeEnv !== 'production') {
    console.log(`\n==================================================`);
    console.log(`[EMAIL PROVIDER (DEV)] Password Reset Code`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Password Reset Code (OTP): [${otp}]`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}

/**
 * Send password reset email link to user (legacy support)
 */
export async function sendEmailPasswordResetLink({ email, resetUrl: providedResetUrl, resetToken, name }) {
  const provider = (config.emailProvider || 'dev').toLowerCase();
  const fromEmail = config.emailFrom || config.emailUsername || 'onboarding@resend.dev';
  const resetUrl = providedResetUrl || `${config.appBaseUrl || 'http://localhost:3001'}/reset-password?token=${resetToken}`;

  const subject = 'Reset Your FocusLens Password';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYou requested a password reset for your FocusLens account.\n\nPlease use the following link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request a password reset, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'smtp') {
    return await sendViaSmtp({ fromEmail, to: email, subject, text: textContent });
  }

  if (provider === 'resend' || (config.resendApiKey && provider !== 'ethereal' && provider !== 'dev')) {
    return await sendViaResend({ fromEmail, to: email, subject, text: textContent });
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test') {
    console.log(`\n==================================================`);
    console.log(`[EMAIL PROVIDER (DEV)] Password Reset Link`);
    console.log(`To: [REDACTED_EMAIL]`);
    console.log(`Subject: ${subject}`);
    console.log(`Password Reset Link: [Secure Link Delivered]`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}
