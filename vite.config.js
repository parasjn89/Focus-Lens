import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Combine process.env and loaded env entries
  const allEntries = [
    ...Object.entries(process.env),
    ...Object.entries(env),
  ];

  // Helper to trim and unquote string values
  const cleanVal = (val) => {
    if (typeof val !== 'string') return '';
    let v = val.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    return v;
  };

  // Resilient finder that matches key regardless of:
  // - leading/trailing whitespace (e.g. "VITE_FIREBASE_API_KEY ")
  // - casing (e.g. "vite_firebase_api_key")
  // - presence or absence of "VITE_" prefix
  const findValue = (...targetKeys) => {
    const normalizedTargets = new Set(
      targetKeys.flatMap((k) => {
        const clean = k.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return [
          clean,
          clean.startsWith('VITE') ? clean.slice(4) : 'VITE' + clean,
        ];
      })
    );

    for (const [rawKey, rawVal] of allEntries) {
      const val = cleanVal(rawVal);
      if (!val) continue;
      const cleanKey = rawKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (normalizedTargets.has(cleanKey)) {
        return val;
      }
    }
    return '';
  };

  // Support both VITE_ and non-VITE_ prefixes for frontend Firebase configuration
  const apiKey = findValue('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY', 'VITE_FIREBASE_APIKEY', 'FIREBASE_APIKEY');
  const projectId = findValue('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECTID', 'FIREBASE_PROJECTID');
  const authDomain =
    findValue('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTHDOMAIN', 'FIREBASE_AUTHDOMAIN') ||
    (projectId ? `${projectId}.firebaseapp.com` : '');
  const rawStorageBucket =
    findValue('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGEBUCKET', 'FIREBASE_STORAGEBUCKET') ||
    (projectId ? `${projectId}.appspot.com` : '');
  const storageBucket = rawStorageBucket.endsWith('.firebasestorage.ap')
    ? `${rawStorageBucket}p`
    : rawStorageBucket;
  const messagingSenderId = findValue(
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_MESSAGINGSENDERID',
    'FIREBASE_MESSAGINGSENDERID',
    'VITE_FIREBASE_SENDER_ID',
    'FIREBASE_SENDER_ID'
  );
  const appId = findValue('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID', 'VITE_FIREBASE_APPID', 'FIREBASE_APPID');
  const apiBaseUrl = findValue('VITE_API_BASE_URL', 'API_BASE_URL', 'VITE_BACKEND_URL', 'BACKEND_URL');

  // Collect safe diagnostic key names and lengths (NO values/secrets)
  const detectedKeysDetail = allEntries
    .filter(([k]) => /firebase|vite|sms|api|backend/i.test(k) && !/secret|password|private_key/i.test(k))
    .map(([k, v]) => ({
      key: k.trim(),
      rawLen: typeof v === 'string' ? v.length : -1,
      cleanLen: cleanVal(v).length,
    }));

  const detectedEnvKeys = Array.from(
    new Set(detectedKeysDetail.map((item) => item.key))
  ).sort();

  const buildDiagnostic = {
    buildTime: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'production',
    isVercel: Boolean(process.env.VERCEL),
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    detectedEnvKeys,
    detectedKeysDetail,
  };

  // Safe build-time log for Vercel deployment logs
  console.log('[FocusLens Build] Build Diagnostic:', {
    isVercel: buildDiagnostic.isVercel,
    vercelEnv: buildDiagnostic.vercelEnv,
    detectedKeysCount: detectedEnvKeys.length,
    firebaseApiKeyConfigured: Boolean(apiKey),
    firebaseProjectIdConfigured: Boolean(projectId),
    firebaseAuthDomainConfigured: Boolean(authDomain),
  });

  const define = {
    '__FOCUSLENS_BUILD_DIAGNOSTIC__': JSON.stringify(buildDiagnostic),
    '__FOCUSLENS_STATIC_FIREBASE_CONFIG__': JSON.stringify({
      apiKey: apiKey || '',
      authDomain: authDomain || '',
      projectId: projectId || '',
      storageBucket: storageBucket || '',
      messagingSenderId: messagingSenderId || '',
      appId: appId || '',
    }),
  };

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



