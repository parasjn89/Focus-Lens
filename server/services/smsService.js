import { config } from '../config/env.js';

/**
 * Send SMS OTP verification message to normalized phone number
 */
export async function sendSmsOtpChallenge({ phoneNumber, otp }) {
  const provider = (config.smsProvider || 'dev').toLowerCase();
  const fromNumber = config.smsFromNumber || '+18005550199';
  const smsBody = `Your FocusLens verification code is: ${otp}. Valid for 10 minutes.`;

  if (provider === 'twilio' && config.smsAccountId && config.smsAuthToken) {
    try {
      const twilioModule = await import('twilio');
      const twilioClient = twilioModule.default(config.smsAccountId, config.smsAuthToken);

      await twilioClient.messages.create({
        body: smsBody,
        from: fromNumber,
        to: phoneNumber,
      });

      return { success: true, provider: 'twilio' };
    } catch (err) {
      console.warn(`[SMS Service] Twilio transmission error to ${phoneNumber}:`, err.message);
      return { success: false, error: err.message, provider: 'twilio' };
    }
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test' && config.nodeEnv !== 'production') {
    console.log(`\n==================================================`);
    console.log(`[SMS PROVIDER (DEV)] Verification Challenge`);
    console.log(`To: ${phoneNumber}`);
    console.log(`SMS Body: ${smsBody}`);
    console.log(`Verification Code (OTP): [${otp}]`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}

/**
 * Send SMS password reset OTP message to normalized phone number
 */
export async function sendSmsPasswordResetOtp({ phoneNumber, otp }) {
  const provider = (config.smsProvider || 'dev').toLowerCase();
  const fromNumber = config.smsFromNumber || '+18005550199';
  const smsBody = `Your FocusLens password reset OTP is: ${otp}. Valid for 10 minutes.`;

  if (provider === 'twilio' && config.smsAccountId && config.smsAuthToken) {
    try {
      const twilioModule = await import('twilio');
      const twilioClient = twilioModule.default(config.smsAccountId, config.smsAuthToken);

      await twilioClient.messages.create({
        body: smsBody,
        from: fromNumber,
        to: phoneNumber,
      });

      return { success: true, provider: 'twilio' };
    } catch (err) {
      console.warn(`[SMS Service] Twilio password reset SMS error to ${phoneNumber}:`, err.message);
      return { success: false, error: err.message, provider: 'twilio' };
    }
  }

  // Development Fallback Abstraction
  if (config.nodeEnv !== 'test' && config.nodeEnv !== 'production') {
    console.log(`\n==================================================`);
    console.log(`[SMS PROVIDER (DEV)] Password Reset OTP`);
    console.log(`To: ${phoneNumber}`);
    console.log(`SMS Body: ${smsBody}`);
    console.log(`Password Reset OTP: [${otp}]`);
    console.log(`==================================================\n`);
  }

  return { success: true, provider: 'dev' };
}

