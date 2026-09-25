import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FocusLensLogo } from '../components/FocusLensLogo.jsx';
import { GoogleIcon } from '../components/GoogleIcon.jsx';
import { signInWithGoogle, isFirebaseConfigured, loginWithEmailPassword, getSignInMethods } from '../lib/firebase.js';
import { apiFetch } from '../api/client.js';

export function LoginPage({ onNavigate, onLoginSuccess }) {
  const { login, loginWithGoogle } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await loginWithGoogle(idToken);
      if (onLoginSuccess) {
        onLoginSuccess(res?.user);
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      if (err.code === 'AUTH_CANCELLED') {
        return;
      }
      setError(err.message || 'Unable to sign in with Google. Please try again.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    const isEmail = cleanIdentifier.includes('@');
    const isPhone = !isEmail && /^\+?[0-9\s\-()]+$/.test(cleanIdentifier);
    const identifierType = isEmail ? 'email' : (isPhone ? 'phone' : 'username');

    console.log('[Auth Diagnostic] Login attempt initiated:', {
      path: '/api/auth/login',
      identifierType,
      isFirebaseConfigured: isFirebaseConfigured(),
    });

    setIsSubmitting(true);
    try {
      const res = await login(cleanIdentifier, password);
      console.log('[Auth Diagnostic] Backend login succeeded');
      if (onLoginSuccess) {
        onLoginSuccess(res?.user);
      } else if (res?.user?.verificationStatus !== 'VERIFIED') {
        onNavigate('verify');
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      console.log('[Auth Diagnostic] Backend login rejected:', {
        path: '/api/auth/login',
        status: err.status,
        code: err.code || err.data?.code,
        message: err.message,
      });

      // 1. If backend identified account as Google-only, give exact provider guidance without fallback
      if (err.code === 'GOOGLE_ACCOUNT_ONLY' || err.data?.code === 'GOOGLE_ACCOUNT_ONLY' || (err.message && err.message.includes('Google Sign-In'))) {
        setError("This account uses Google Sign-In. Continue with Google or set a FocusLens password.");
        return;
      }

      // 2. If backend rejected with invalid credentials and identifier is an email, check Firebase Auth
      // (in case password was reset or added in Firebase Auth)
      if (isFirebaseConfigured() && isEmail) {
        try {
          console.log('[Auth Diagnostic] Attempting Firebase Auth password login');
          const { idToken, user: fbUser } = await loginWithEmailPassword(cleanIdentifier, password);
          console.log('[Auth Diagnostic] Firebase Auth succeeded. Exchanging token with backend');

          const res = await loginWithGoogle(idToken);

          // Synchronize password hash to PostgreSQL database for fast subsequent logins
          try {
            await apiFetch('/api/auth/sync-firebase-password', {
              method: 'POST',
              body: JSON.stringify({ idToken, newPassword: password }),
            });
          } catch (_) {}

          if (onLoginSuccess) {
            onLoginSuccess(res?.user);
          } else {
            onNavigate('dashboard');
          }
          return;
        } catch (fbErr) {
          console.log('[Auth Diagnostic] Firebase Auth check failed:', {
            fbCode: fbErr?.code || 'unknown',
            fbMessage: fbErr?.message || 'failed',
          });

          // Check if this Firebase account only has Google provider registered
          try {
            const methods = await getSignInMethods(cleanIdentifier);
            if (methods.includes('google.com') && !methods.includes('password')) {
              setError("This account uses Google Sign-In. Continue with Google or set a FocusLens password.");
              return;
            }
          } catch (_) {}
        }
      }

      setError(err.message || 'Invalid email/phone/username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <FocusLensLogo variant="icon" size="xl" isDecorative />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
        <p className="text-sm text-slate-400 mt-1">Log in to access your personal focus session dashboard</p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {error && (
          <div className={`mb-6 p-4 rounded-xl text-xs flex items-start space-x-3 ${
            error.includes('Google Sign-In')
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
              error.includes('Google Sign-In') ? 'text-amber-400' : 'text-rose-400'
            }`} />
            <div className={`flex-1 font-medium leading-relaxed ${
              error.includes('Google Sign-In') ? 'text-amber-200' : 'text-rose-200'
            }`}>
              <div>{error}</div>
              {error.includes('Google Sign-In') && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleSubmitting}
                    className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                  >
                    <GoogleIcon className="w-3.5 h-3.5" />
                    <span>Continue with Google</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Google Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || isGoogleSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white font-medium text-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-50 hover:scale-[1.01] shadow-lg shadow-black/20"
        >
          {isGoogleSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin shrink-0" />
              <span>Signing in with Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-slate-900 px-3 text-slate-500 font-medium">Or log in with email</span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com or @username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Login</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
