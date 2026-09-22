import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Helper to read from system process.env (Vercel build environment) or Vite loaded env
  const getEnv = (key) => (process.env[key] || env[key] || '').trim();

  // Support both VITE_ and non-VITE_ prefixes for frontend Firebase configuration
  const apiKey = getEnv('VITE_FIREBASE_API_KEY') || getEnv('FIREBASE_API_KEY');
  const projectId = getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID');
  const authDomain =
    getEnv('VITE_FIREBASE_AUTH_DOMAIN') ||
    getEnv('FIREBASE_AUTH_DOMAIN') ||
    (projectId ? `${projectId}.firebaseapp.com` : '');
  const storageBucket =
    getEnv('VITE_FIREBASE_STORAGE_BUCKET') ||
    getEnv('FIREBASE_STORAGE_BUCKET') ||
    (projectId ? `${projectId}.appspot.com` : '');
  const messagingSenderId =
    getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') ||
    getEnv('FIREBASE_MESSAGING_SENDER_ID');
  const appId = getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID');
  const apiBaseUrl = getEnv('VITE_API_BASE_URL') || getEnv('API_BASE_URL');

  const define = {};
  // Only define when non-empty so we NEVER hardcode an empty string over Vite's native env injection
  if (apiKey) define['import.meta.env.VITE_FIREBASE_API_KEY'] = JSON.stringify(apiKey);
  if (authDomain) define['import.meta.env.VITE_FIREBASE_AUTH_DOMAIN'] = JSON.stringify(authDomain);
  if (projectId) define['import.meta.env.VITE_FIREBASE_PROJECT_ID'] = JSON.stringify(projectId);
  if (storageBucket) define['import.meta.env.VITE_FIREBASE_STORAGE_BUCKET'] = JSON.stringify(storageBucket);
  if (messagingSenderId) define['import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID'] = JSON.stringify(messagingSenderId);
  if (appId) define['import.meta.env.VITE_FIREBASE_APP_ID'] = JSON.stringify(appId);
  if (apiBaseUrl) define['import.meta.env.VITE_API_BASE_URL'] = JSON.stringify(apiBaseUrl);

  return {
    plugins: [react()],
    define,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});


