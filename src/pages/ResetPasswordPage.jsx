import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { BackButton } from '../components/BackButton.jsx';
import { FocusLensLogo } from '../components/FocusLensLogo.jsx';
import {
  verifyFirebasePasswordResetCode,
  confirmFirebasePasswordReset,
  mapFirebaseAuthError,
  loginWithEmailPassword,
} from '../lib/firebase.js';
import { parseResetParams } from '../utils/passwordReset.js';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api/client.js';

export function ResetPasswordPage({ onNavigate }) {
  const { resetPassword } = useAuth();
  const [params, setParams] = useState(() => parseResetParams(typeof window !== 'undefined' ? window.location : null));
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [status, setStatus] = useState('VERIFYING'); // 'VERIFYING' | 'READY' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const currentParams = parseResetParams(typeof window !== 'undefined' ? window.location : null);
    setParams(currentParams);

    const { oobCode, token } = currentParams;

    if (!oobCode && !token) {
      setStatus('ERROR');
      setErrorMessage('No password reset authorization found in this link. Please request a new reset link.');
      return;
    }

    if (oobCode) {
      let isMounted = true;
      setStatus('VERIFYING');

      // Read-only code verification: checks if code is valid without consuming it
      verifyFirebasePasswordResetCode(oobCode)
        .then((userEmail) => {
          if (isMounted) {
            setVerifiedEmail(userEmail || '');
            setStatus('READY');
          }
        })
        .catch((err) => {
          if (isMounted) {
            setStatus('ERROR');
            setErrorMessage(mapFirebaseAuthError(err));
          }
        });

      return () => {
        isMounted = false;
      };
    } else if (token) {
      // Backend OTP token flow
      setStatus('READY');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    const newFieldErrors = {};

    if (!password) {
      newFieldErrors.password = 'Password is required.';
    } else if (password.length < 12) {
      newFieldErrors.password = 'Password must be at least 12 characters long.';
    }

    if (!confirmPassword) {
      newFieldErrors.confirmPassword = 'Password confirmation is required.';
    } else if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setFieldErrors({});
    setStatus('SUBMITTING');

    try {
      if (params.oobCode) {
        // Complete Firebase Auth reset (consumes code once)
        await confirmFirebasePasswordReset(params.oobCode, password);

        // Synchronize new password to FocusLens PostgreSQL database if user exists
        if (verifiedEmail) {
          try {
            const { idToken } = await loginWithEmailPassword(verifiedEmail, password);
            await apiFetch('/api/auth/sync-firebase-password', {
              method: 'POST',
              body: JSON.stringify({ idToken, newPassword: password }),
            });
          } catch (syncErr) {
            // Non-blocking sync fallback
          }
        }

        setPassword('');
        setConfirmPassword('');
        setStatus('SUCCESS');
      } else if (params.token) {
        // Complete Backend token reset
        await resetPassword({
          token: params.token,
          method: 'EMAIL',
          newPassword: password,
          confirmPassword,
        });
        setPassword('');
        setConfirmPassword('');
        setStatus('SUCCESS');
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(mapFirebaseAuthError(err));
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-6">
        <BackButton onClick={() => onNavigate('login')} label="Back to Login" />
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <FocusLensLogo variant="icon" size="lg" isDecorative />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create New Password</h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {verifiedEmail ? (
              <>Resetting password for <strong className="text-slate-200 font-mono">{verifiedEmail}</strong></>
            ) : (
              'Enter your new password below to regain access to your account.'
            )}
          </p>
        </div>

        {status === 'VERIFYING' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-8 h-8 border-3 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300">Verifying reset link...</p>
            <p className="text-xs text-slate-500">Checking link authorization with Firebase</p>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Reset Link Invalid or Expired</p>
                <p className="text-rose-300/80 mt-1 leading-relaxed">
                  {errorMessage || 'This password reset link has expired or has already been used.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Request a New Reset Link</span>
            </button>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-200">Password Reset Complete</p>
                <p className="text-emerald-300/80 mt-1 leading-relaxed">
                  Your password has been successfully updated. You can now log in with your new credentials.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2"
            >
              <span>Return to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {(status === 'READY' || status === 'SUBMITTING') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="font-medium text-rose-200">{errorMessage}</div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  New Password *
                </label>
                <span className="text-[10px] text-slate-500">12+ characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={status === 'SUBMITTING'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                    fieldErrors.password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-brand-500'
                  } text-sm text-white placeholder-slate-500 outline-none transition-all disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  disabled={status === 'SUBMITTING'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: null }));
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                    fieldErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-brand-500'
                  } text-sm text-white placeholder-slate-500 outline-none transition-all disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === 'SUBMITTING' || !password || !confirmPassword}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              {status === 'SUBMITTING' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
