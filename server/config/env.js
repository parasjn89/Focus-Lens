import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/focuslens',
  sessionSecret: process.env.SESSION_SECRET || 'focuslens_super_secret_session_key_32_chars_min!',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Email Provider Configuration
  emailProvider: process.env.EMAIL_PROVIDER || 'dev',
  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
  emailHost: process.env.EMAIL_HOST || '',
  emailPort: process.env.EMAIL_PORT || '587',
  emailUsername: process.env.EMAIL_USERNAME || '',
  emailPassword: process.env.EMAIL_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'onboarding@resend.dev',

  // SMS Provider Configuration
  smsProvider: process.env.SMS_PROVIDER || 'dev',
  smsAccountId: process.env.SMS_ACCOUNT_ID || '',
  smsAuthToken: process.env.SMS_AUTH_TOKEN || '',
  smsFromNumber: process.env.SMS_FROM_NUMBER || '',

  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
};
