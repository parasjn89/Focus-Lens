import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, AlertCircle, ArrowRight, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FocusLensLogo } from '../components/FocusLensLogo.jsx';
import { GoogleIcon } from '../components/GoogleIcon.jsx';
import {
  signInWithGoogle,
  initRecaptchaVerifier,
  cleanupRecaptchaVerifier,
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
  getFirebaseDiagnostics,
} from '../lib/firebase.js';

export function LoginPage({ onNavigate, onLoginSuccess }) {
  const { login, loginWithGoogle, loginWithFirebasePhone } = useAuth();
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Phone OTP Login States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [sentPhoneFormatted, setSentPhoneFormatted] = useState('');
  const [isPhoneSending, setIsPhoneSending] = useState(false);
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  useEffect(() => {
    let timer = null;
    if (phoneCooldown > 0) {
      timer = setInterval(() => {
        setPhoneCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phoneCooldown]);

  const isPhoneSendingRef = useRef(false);

  useEffect(() => {
    return () => {
      cleanupRecaptchaVerifier('firebase-login-recaptcha');
    };
  }, []);

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

  const handleSendPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    if (isPhoneSendingRef.current || isPhoneSending) return;

    setError(null);

    const raw = phoneNumber.trim();
    if (!raw) {
      setError('Please enter your phone number.');
      return;
    }

    isPhoneSendingRef.current = true;
    setIsPhoneSending(true);
    try {
      const verifier = initRecaptchaVerifier('firebase-login-recaptcha');
      const res = await sendFirebasePhoneOtp(raw, verifier);
      setPhoneConfirmation(res.confirmationResult);
      setSentPhoneFormatted(res.phoneNumber);
      setPhoneCooldown(60);
      setPhoneOtp('');
    } catch (err) {
      setError(err.message || 'Failed to send SMS verification code.');
    } finally {
      isPhoneSendingRef.current = false;
      setIsPhoneSending(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanCode = phoneOtp.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsPhoneVerifying(true);
    try {
      const { idToken } = await confirmFirebasePhoneOtp(phoneConfirmation, cleanCode);
      const res = await loginWithFirebasePhone(idToken);
      cleanupRecaptchaVerifier('firebase-login-recaptcha');
      if (onLoginSuccess) {
        onLoginSuccess(res?.user);
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check your code and try again.');
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleChangePhone = () => {
    cleanupRecaptchaVerifier('firebase-login-recaptcha');
    setPhoneConfirmation(null);
    setPhoneOtp('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(res?.user);
      } else if (res?.user?.verificationStatus !== 'VERIFIED') {
        onNavigate('verify');
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
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
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {error.includes('Firebase is not configured') && (
                <div className="mt-3 pt-2.5 border-t border-rose-500/20">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Environment Variables Status
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                    {Object.entries(getFirebaseDiagnostics())
                      .filter(([name]) => !name.startsWith('_'))
                      .map(([name, status]) => (
                        <div key={name} className="flex justify-between items-center py-0.5">
                          <span className="text-slate-400">{name}:</span>
                          <span className={status === 'present' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {status}
                          </span>
                        </div>
                      ))}
                  </div>
                  {getFirebaseDiagnostics()._buildDiagnosticHint && (
                    <div className="mt-2 pt-2 border-t border-rose-500/10 text-[10px] text-slate-400 font-mono break-all">
                      {getFirebaseDiagnostics()._buildDiagnosticHint}
                    </div>
                  )}
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

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800 my-6">
          <button
            type="button"
            onClick={() => {
              cleanupRecaptchaVerifier('firebase-login-recaptcha');
              setAuthMode('password');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'password'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('phone'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'phone'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phone OTP Login
          </button>
        </div>

        {authMode === 'phone' ? (
          <div>
            {/* Invisible reCAPTCHA container */}
            <div id="firebase-login-recaptcha" className="flex justify-center my-1"></div>

            {!phoneConfirmation ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Mobile Phone Number *</span>
                    <span className="text-[10px] text-brand-400 font-normal">Real SMS OTP</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Enter your registered phone number with country code (e.g. +91 98765 43210).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isPhoneSending || !phoneNumber.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
                >
                  {isPhoneSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      <span>Sending SMS OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-brand-950/40 border border-brand-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider block">OTP Sent To</span>
                    <span className="text-sm font-semibold text-white font-mono">{sentPhoneFormatted}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePhone}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium underline transition-colors"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Enter 6-Digit Code *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Check your SMS</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-base font-mono tracking-widest text-center text-white placeholder-slate-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPhoneVerifying || phoneOtp.length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
                >
                  {isPhoneVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400">Didn't receive code?</span>
                  <button
                    type="button"
                    disabled={phoneCooldown > 0 || isPhoneSending}
                    onClick={handleSendPhoneOtp}
                    className="text-brand-400 hover:text-brand-300 font-medium disabled:text-slate-600 flex items-center space-x-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isPhoneSending ? 'animate-spin' : ''}`} />
                    <span>{phoneCooldown > 0 ? `Resend in ${phoneCooldown}s` : 'Resend SMS'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Email Address, Phone Number, or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com, +91XXXXXXXXXX, or @alex"
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
                  className="text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.02]"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>HTTP-only Cookie Session Security Enforced</span>
      </div>
    </div>
  );
}
