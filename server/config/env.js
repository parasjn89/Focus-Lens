import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Explicitly load root .env file regardless of process.cwd()
dotenv.config({ path: path.resolve(projectRoot, '.env') });
dotenv.config(); // fallback to current working directory

function normalizePrivateKey(key) {
  if (!key || typeof key !== 'string') return '';
  let cleaned = key.trim();
  if (cleaned.endsWith(',')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\n/g, '\n').trim();
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/focuslens',
  sessionSecret: process.env.SESSION_SECRET || 'focuslens_super_secret_session_key_32_chars_min!',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Email Provider Configuration
  emailProvider: (process.env.EMAIL_PROVIDER || 'dev').toLowerCase().trim(),
  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
  emailHost: (process.env.EMAIL_HOST || '').trim(),
  emailPort: (process.env.EMAIL_PORT || '587').trim(),
  emailSecure: process.env.EMAIL_SECURE !== undefined
    ? process.env.EMAIL_SECURE === 'true'
    : (process.env.EMAIL_PORT === '465'),
  emailUsername: (process.env.EMAIL_USERNAME || '').trim(),
  emailPassword: (process.env.EMAIL_PASSWORD || '').trim(),
  emailFrom: (process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || 'onboarding@resend.dev').trim(),

  // SMS Provider Configuration
  smsProvider: process.env.SMS_PROVIDER || 'dev',
  smsAccountId: process.env.SMS_ACCOUNT_ID || '',
  smsAuthToken: process.env.SMS_AUTH_TOKEN || '',
  smsFromNumber: process.env.SMS_FROM_NUMBER || '',

  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
  frontendUrl: (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/$/, ''),

  // Google Calendar Integration Configuration
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  googleClientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  googleRedirectUri: (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google-calendar/callback').trim(),
  googleTokenEncryptionKey: (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').trim(),

  // Firebase Admin Configuration (Server ID Token Verification)
  firebaseProjectId: (process.env.FIREBASE_PROJECT_ID || '').trim(),
  firebaseClientEmail: (process.env.FIREBASE_CLIENT_EMAIL || '').trim(),
  firebasePrivateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
};


