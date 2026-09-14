import { config } from '../config/env.js';

/**
 * Send email verification challenge to user
 */
export async function sendEmailVerificationChallenge({ email, otp, name }) {
  const provider = (config.emailProvider || 'dev').toLowerCase();
  const fromEmail = config.emailFrom || 'onboarding@resend.dev';

  const subject = 'Verify Your FocusLens Account';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYour FocusLens verification code is: ${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'resend' || (config.resendApiKey && provider !== 'smtp' && provider !== 'ethereal')) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(config.resendApiKey);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject,
        text: textContent,
      });

      if (error) {
        console.error(`[Resend Email Service Failure] Failed to send verification email to ${email}:`, error.message || error);
        return { success: false, error: error.message || String(error), provider: 'resend' };
      }

      console.log(`[Resend Email Service] Verification email sent successfully to ${email} (Message ID: ${data?.id})`);
      return { success: true, provider: 'resend', messageId: data?.id };
    } catch (err) {
      console.error(`[Resend Email Service Failure] Resend API error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'resend' };
    }
  }

  if (provider === 'smtp' && config.emailHost) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.emailHost,
        port: parseInt(config.emailPort || '587', 10),
        secure: config.emailPort === '465',
        auth: config.emailUsername ? {
          user: config.emailUsername,
          pass: config.emailPassword,
        } : undefined,
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject,
        text: textContent,
      });

      console.log(`[Email Service] SMTP email sent successfully to ${email} (Message ID: ${info.messageId})`);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[Email Service Failure] SMTP transmission error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'smtp' };
    }
  }

  if (provider === 'ethereal') {
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
        to: email,
        subject,
        text: textContent,
      });

      const previewUrl = nodemailer.default.getTestMessageUrl(info);
      console.log(`\n==================================================`);
      console.log(`[EMAIL PROVIDER (ETHEREAL TEST INBOX)] Verification Email`);
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Preview URL: ${previewUrl}`);
      console.log(`==================================================\n`);
      return { success: true, provider: 'ethereal', previewUrl };
    } catch (err) {
      console.error(`[Email Service Failure] Ethereal test account error:`, err.message);
    }
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test') {
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
  const fromEmail = config.emailFrom || 'onboarding@resend.dev';

  const subject = 'Reset Your FocusLens Password';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYour FocusLens password reset code is:\n\n${otp}\n\nThis code will expire in 10 minutes. If you did not request a password reset, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'resend' || (config.resendApiKey && provider !== 'smtp' && provider !== 'ethereal')) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(config.resendApiKey);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject,
        text: textContent,
      });

      if (error) {
        console.error(`[Resend Email Service Failure] Failed to send password reset email to ${email}:`, error.message || error);
        return { success: false, error: error.message || String(error), provider: 'resend' };
      }

      console.log(`[Resend Email Service] Password reset OTP sent successfully to ${email} (Message ID: ${data?.id})`);
      return { success: true, provider: 'resend', messageId: data?.id };
    } catch (err) {
      console.error(`[Resend Email Service Failure] Resend API error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'resend' };
    }
  }

  if (provider === 'smtp' && config.emailHost) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.emailHost,
        port: parseInt(config.emailPort || '587', 10),
        secure: config.emailPort === '465',
        auth: config.emailUsername ? {
          user: config.emailUsername,
          pass: config.emailPassword,
        } : undefined,
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject,
        text: textContent,
      });

      console.log(`[Email Service] SMTP password reset OTP sent successfully to ${email} (Message ID: ${info.messageId})`);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[Email Service Failure] SMTP password reset error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'smtp' };
    }
  }

  if (provider === 'ethereal') {
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
        to: email,
        subject,
        text: textContent,
      });

      const previewUrl = nodemailer.default.getTestMessageUrl(info);
      console.log(`\n==================================================`);
      console.log(`[EMAIL PROVIDER (ETHEREAL TEST INBOX)] Password Reset Email`);
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Preview URL: ${previewUrl}`);
      console.log(`==================================================\n`);
      return { success: true, provider: 'ethereal', previewUrl };
    } catch (err) {
      console.error(`[Email Service Failure] Ethereal test account error:`, err.message);
    }
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test') {
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
export async function sendEmailPasswordResetLink({ email, resetToken, name }) {
  const provider = (config.emailProvider || 'dev').toLowerCase();
  const fromEmail = config.emailFrom || 'onboarding@resend.dev';
  const resetUrl = `${config.appBaseUrl || 'http://localhost:3001'}/reset-password?token=${resetToken}`;

  const subject = 'Reset Your FocusLens Password';
  const textContent = `Hello ${name || 'FocusLens User'},\n\nYou requested a password reset for your FocusLens account.\n\nPlease use the following link or code to reset your password:\n${resetUrl}\n\nReset Token: ${resetToken}\n\nThis link will expire in 15 minutes. If you did not request a password reset, please ignore this email.\n\n- The FocusLens Team`;

  if (provider === 'resend' || (config.resendApiKey && provider !== 'smtp' && provider !== 'ethereal')) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(config.resendApiKey);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject,
        text: textContent,
      });

      if (error) {
        console.error(`[Resend Email Service Failure] Failed to send email to ${email}:`, error.message || error);
        return { success: false, error: error.message || String(error), provider: 'resend' };
      }

      return { success: true, provider: 'resend', messageId: data?.id };
    } catch (err) {
      console.error(`[Resend Email Service Failure] Resend API error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'resend' };
    }
  }

  if (provider === 'smtp' && config.emailHost) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.emailHost,
        port: parseInt(config.emailPort || '587', 10),
        secure: config.emailPort === '465',
        auth: config.emailUsername ? {
          user: config.emailUsername,
          pass: config.emailPassword,
        } : undefined,
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject,
        text: textContent,
      });

      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[Email Service Failure] SMTP password reset error to ${email}:`, err.message);
      return { success: false, error: err.message, provider: 'smtp' };
    }
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test') {
    console.log(`\n==================================================`);
    console.log(`[EMAIL PROVIDER (DEV)] Password Reset Link`);
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset Token Link: ${resetUrl}`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}
