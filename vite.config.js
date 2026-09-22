import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Support both VITE_ and non-VITE_ prefixes for frontend Firebase configuration
  const apiKey = (env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || '').trim();
  const projectId = (env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || '').trim();
  const authDomain = (
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    env.FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : '')
  ).trim();
  const storageBucket = (
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    env.FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : '')
  ).trim();
  const messagingSenderId = (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    env.FIREBASE_MESSAGING_SENDER_ID ||
    ''
  ).trim();
  const appId = (env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || '').trim();
  const apiBaseUrl = (env.VITE_API_BASE_URL || env.API_BASE_URL || '').trim();

  const define = {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(apiKey),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(appId),
  };

  if (apiBaseUrl) {
    define['import.meta.env.VITE_API_BASE_URL'] = JSON.stringify(apiBaseUrl);
  }

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


