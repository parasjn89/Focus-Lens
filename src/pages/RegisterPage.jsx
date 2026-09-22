import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, User, Mail, Lock, Phone, AlertCircle, ArrowRight, ShieldCheck, X, KeyRound, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mapErrorToField } from '../utils/registrationValidation.js';
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

export { mapErrorToField };

export function RegisterPage({ onNavigate, onRegisterSuccess }) {
  const { register, loginWithGoogle, registerWithFirebasePhone } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('EMAIL');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone OTP Registration Step States
  const [isPhoneOtpStep, setIsPhoneOtpStep] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [sentPhoneFormatted, setSentPhoneFormatted] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [phoneErrorDetail, setPhoneErrorDetail] = useState(null);

  // Field-specific validation errors: { username?, name?, email?, phoneNumber?, password?, confirmPassword? }
  const [fieldErrors, setFieldErrors] = useState({});
  // Global error banner message
  const [error, setError] = useState(null);
  // Non-blocking toast notification
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleGoogleSignUp = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await loginWithGoogle(idToken);
      if (onRegisterSuccess) {
        onRegisterSuccess('dashboard', { user: res?.user });
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      if (err.code === 'AUTH_CANCELLED') {
        return;
      }
      setError(err.message || 'Unable to sign in with Google. Please try again.');
      showToast(err.message || 'Unable to sign in with Google. Please try again.', 'error');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Input refs for automatic focus & smooth scrolling
  const usernameInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const globalErrorRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const isPhoneSendingRef = useRef(false);

  const showToast = (message, type = 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 5000);
  };

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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      cleanupRecaptchaVerifier('firebase-register-recaptcha');
    };
  }, []);

  const focusAndScrollField = (fieldName) => {
    const refMap = {
      username: usernameInputRef,
      name: nameInputRef,
      email: emailInputRef,
      phoneNumber: phoneInputRef,
      password: passwordInputRef,
      confirmPassword: confirmPasswordInputRef,
    };
    const targetRef = refMap[fieldName];
    if (targetRef && targetRef.current) {
      // Focus element without sudden scroll jump, then smoothly center it in view
      targetRef.current.focus({ preventScroll: true });
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const clearFieldError = (fieldName) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    // Clear global error if it mentions this field
    if (error && error.toLowerCase().includes(fieldName.toLowerCase())) {
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().replace(/^@/, '');
    const newFieldErrors = {};

    // 1. Client-side validation checks
    if (!cleanUsername) {
      newFieldErrors.username = 'Username is required.';
    } else if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      newFieldErrors.username = 'Username must be between 3 and 30 characters long.';
    } else if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      newFieldErrors.username = 'Username can only contain letters, numbers, underscores, and periods.';
    }

    if (!name.trim()) {
      newFieldErrors.name = 'Full name is required.';
    }

    if (verificationMethod === 'EMAIL') {
      if (!email.trim()) {
        newFieldErrors.email = 'Email address is required when Email Verification is selected.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newFieldErrors.email = 'Please enter a valid email address.';
      }
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newFieldErrors.email = 'Please enter a valid email address.';
    }

    if (verificationMethod === 'PHONE') {
      if (!phoneNumber.trim()) {
        newFieldErrors.phoneNumber = 'Phone number is required when Phone Verification is selected.';
      }
    }

    if (!password) {
      newFieldErrors.password = 'Password is required.';
    } else if (password.length < 12) {
      newFieldErrors.password = 'Password must be at least 12 characters long.';
    }

    if (!confirmPassword) {
      newFieldErrors.confirmPassword = 'Please confirm your password.';
    } else if (password && confirmPassword && password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      const priorityOrder = ['username', 'name', 'email', 'phoneNumber', 'password', 'confirmPassword'];
      const firstInvalidField = priorityOrder.find((f) => newFieldErrors[f]);
      if (firstInvalidField) {
        focusAndScrollField(firstInvalidField);
        showToast(newFieldErrors[firstInvalidField], 'error');
        setError(newFieldErrors[firstInvalidField]);
      }
      return;
    }

    // If PHONE verification is selected, trigger Firebase real SMS OTP flow
    if (verificationMethod === 'PHONE') {
      if (isPhoneSendingRef.current || isSubmitting) return;
      isPhoneSendingRef.current = true;
      setIsSubmitting(true);
      try {
        const verifier = initRecaptchaVerifier('firebase-register-recaptcha');
        const sendRes = await sendFirebasePhoneOtp(phoneNumber.trim(), verifier);
        setPhoneConfirmation(sendRes.confirmationResult);
        setSentPhoneFormatted(sendRes.phoneNumber);
        setPhoneCooldown(60);
        setPhoneOtp('');
        setPhoneErrorDetail(null);
        setIsPhoneOtpStep(true);
        showToast('SMS verification code sent to your phone.', 'info');
      } catch (err) {
        setError(err.message || 'Failed to send SMS verification code.');
        showToast(err.message || 'Failed to send SMS verification code.', 'error');
        setPhoneErrorDetail({
          code: err.code || 'auth/unknown',
          message: err.message,
          rawMessage: err.rawMessage || err.originalMessage || null,
        });
      } finally {
        isPhoneSendingRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    // Standard EMAIL verification registration flow
    setIsSubmitting(true);
    try {
      const res = await register(
        cleanUsername,
        name.trim(),
        email.trim() || null,
        password,
        verificationMethod,
        phoneNumber.trim() || null
      );
      const regDetails = {
        method: verificationMethod,
        phoneNumber: phoneNumber.trim() || res?.user?.phoneNumber || null,
        email: email.trim() || res?.user?.email || null,
      };
      if (onRegisterSuccess) onRegisterSuccess('verify', regDetails);
      else onNavigate('verify');
    } catch (err) {
      const { field, message } = mapErrorToField(err);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
        setError(message);
        showToast(message, 'error');
        focusAndScrollField(field);
      } else {
        // Generic server or network error without a specific field target
        setError(message);
        showToast(message, 'error');
        globalErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegisterPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanCode = phoneOtp.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, '');

    setIsPhoneVerifying(true);
    try {
      const { idToken } = await confirmFirebasePhoneOtp(phoneConfirmation, cleanCode);
      const res = await registerWithFirebasePhone({
        idToken,
        username: cleanUsername,
        name: name.trim(),
        email: email.trim() || null,
        password,
      });

      cleanupRecaptchaVerifier('firebase-register-recaptcha');
      if (onRegisterSuccess) {
        onRegisterSuccess('dashboard', { user: res?.user });
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      const { field, message } = mapErrorToField(err);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
      setError(message || err.message || 'Phone verification failed.');
      showToast(message || err.message || 'Phone verification failed.', 'error');
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    if (phoneCooldown > 0 || isSubmitting || isPhoneSendingRef.current) return;
    setError(null);
    isPhoneSendingRef.current = true;
    setIsSubmitting(true);
    try {
      const verifier = initRecaptchaVerifier('firebase-register-recaptcha');
      const sendRes = await sendFirebasePhoneOtp(phoneNumber.trim(), verifier);
      setPhoneConfirmation(sendRes.confirmationResult);
      setSentPhoneFormatted(sendRes.phoneNumber);
      setPhoneCooldown(60);
      setPhoneErrorDetail(null);
      showToast('New verification code sent via SMS.', 'info');
    } catch (err) {
      setError(err.message || 'Failed to resend SMS verification code.');
      showToast(err.message || 'Failed to resend SMS verification code.', 'error');
      setPhoneErrorDetail({
        code: err.code || 'auth/unknown',
        message: err.message,
        rawMessage: err.rawMessage || err.originalMessage || null,
      });
    } finally {
      isPhoneSendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleChangeRegisterPhone = () => {
    cleanupRecaptchaVerifier('firebase-register-recaptcha');
    setIsPhoneOtpStep(false);
    setPhoneConfirmation(null);
    setPhoneOtp('');
    setError(null);
    setPhoneErrorDetail(null);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 relative">
      {/* Floating Non-Blocking Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-rose-500/40 text-slate-200 px-4 py-3.5 rounded-xl shadow-2xl backdrop-blur-md flex items-start space-x-3 transition-all duration-300 transform translate-y-0"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs leading-relaxed font-medium">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white transition-colors p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <FocusLensLogo variant="icon" size="xl" isDecorative />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create FocusLens Account</h1>
        <p className="text-sm text-slate-400 mt-1">Start tracking your deep work with privacy guarantees</p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {/* Global Error Banner (Scroll Target for Non-Field / Generic Errors) */}
        {error && (
          <div
            ref={globalErrorRef}
            tabIndex={-1}
            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 outline-none"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="font-medium text-rose-200">{error}</div>

                {phoneErrorDetail?.code && (
                  <div className="pt-2 border-t border-rose-500/20 space-y-2 font-mono text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Firebase Error Code:</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 font-semibold border border-rose-500/30">
                        {phoneErrorDetail.code}
                      </span>
                    </div>

                    {phoneErrorDetail.code === 'auth/billing-not-enabled' && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-sans leading-relaxed">
                        <p className="font-semibold text-amber-300 mb-1">Action Required in Google Cloud:</p>
                        <p>Google requires all Firebase projects using Phone SMS Authentication to have a linked Cloud Billing account (Blaze pay-as-you-go plan) to prevent SMS abuse. Please link a billing account to project <code className="font-mono bg-black/40 px-1 py-0.5 rounded text-amber-100">{getFirebaseDiagnostics().projectId}</code> in Google Cloud Console.</p>
                      </div>
                    )}

                    {phoneErrorDetail.code === 'auth/operation-not-allowed' && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-sans leading-relaxed">
                        <p className="font-semibold text-amber-300 mb-1">Action Required in Firebase Console:</p>
                        <p>Verify that the Phone provider is set to &ldquo;Enabled&rdquo; under Authentication &gt; Sign-in method in project <code className="font-mono bg-black/40 px-1 py-0.5 rounded text-amber-100">{getFirebaseDiagnostics().projectId}</code>.</p>
                      </div>
                    )}

                    {phoneErrorDetail.code === 'auth/unauthorized-domain' && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-sans leading-relaxed">
                        <p className="font-semibold text-amber-300 mb-1">Action Required in Firebase Console:</p>
                        <p>Add this domain to Authentication &gt; Settings &gt; Authorized domains in Firebase Console.</p>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Project: <strong className="text-slate-300">{getFirebaseDiagnostics().projectId}</strong></span>
                      <span>Auth Domain: <strong className="text-slate-300">{getFirebaseDiagnostics().authDomain}</strong></span>
                      <span>Config: <strong className="text-slate-300">{getFirebaseDiagnostics().configCompleteness}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Google Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
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

        {/* Aesthetic Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-3 text-slate-500 font-medium">or register with credentials</span>
          </div>
        </div>

        {/* Invisible reCAPTCHA container */}
        <div id="firebase-register-recaptcha" className="flex justify-center my-1"></div>

        {isPhoneOtpStep ? (
          <form onSubmit={handleVerifyRegisterPhoneOtp} className="space-y-5">
            <div className="text-center pb-2">
              <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Verify Your Mobile Number</h3>
              <p className="text-xs text-slate-400 mt-1">
                We sent a 6-digit SMS verification code to{' '}
                <span className="text-white font-mono font-semibold">{sentPhoneFormatted}</span>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter 6-Digit SMS Code *
                </label>
                <button
                  type="button"
                  onClick={handleChangeRegisterPhone}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium underline transition-colors"
                >
                  Change phone number
                </button>
              </div>
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
                  <span>Verifying Code & Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Verify & Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400">Didn't receive SMS?</span>
              <button
                type="button"
                disabled={phoneCooldown > 0 || isSubmitting}
                onClick={handleResendRegisterOtp}
                className="text-brand-400 hover:text-brand-300 font-medium disabled:text-slate-600 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>{phoneCooldown > 0 ? `Resend in ${phoneCooldown}s` : 'Resend SMS'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* 1. Username Field */}
          <div>
            <label htmlFor="register-username" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Username (Unique Handle) *</span>
              <span className="text-[10px] text-slate-400 font-normal">Must be unique</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400 font-bold text-sm">
                @
              </div>
              <input
                id="register-username"
                ref={usernameInputRef}
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError('username');
                }}
                placeholder="parasjain"
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.username
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all font-mono`}
              />
            </div>
            {fieldErrors.username && (
              <p
                id="username-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.username}</span>
              </p>
            )}
          </div>

          {/* 2. Full Name Field */}
          <div>
            <label htmlFor="register-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="register-name"
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="Paras Jain"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.name
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all`}
              />
            </div>
            {fieldErrors.name && (
              <p
                id="name-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.name}</span>
              </p>
            )}
          </div>

          {/* 3. Verification Method Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>Verification Choice *</span>
              <span className="text-[10px] text-slate-400 font-normal">Choose Email OR Phone</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                  verificationMethod === 'EMAIL'
                    ? 'bg-brand-600/15 border-brand-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="verificationMethod"
                  value="EMAIL"
                  checked={verificationMethod === 'EMAIL'}
                  onChange={() => {
                    setVerificationMethod('EMAIL');
                    clearFieldError('phoneNumber');
                  }}
                  className="sr-only"
                />
                <Mail className={`w-5 h-5 mb-1 ${verificationMethod === 'EMAIL' ? 'text-brand-400' : 'text-slate-500'}`} />
                <span className="text-xs font-medium">Email Verification</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Verify via code in email</span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                  verificationMethod === 'PHONE'
                    ? 'bg-brand-600/15 border-brand-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="verificationMethod"
                  value="PHONE"
                  checked={verificationMethod === 'PHONE'}
                  onChange={() => {
                    setVerificationMethod('PHONE');
                    clearFieldError('email');
                  }}
                  className="sr-only"
                />
                <Phone className={`w-5 h-5 mb-1 ${verificationMethod === 'PHONE' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-xs font-medium">Phone SMS</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Verify via SMS code</span>
              </label>
            </div>
          </div>

          {/* 4. Email Field */}
          <div>
            <label htmlFor="register-email" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Email Address {verificationMethod === 'EMAIL' ? '*' : '(Optional)'}</span>
              {verificationMethod === 'PHONE' && <span className="text-[10px] text-slate-500 font-normal">Can add later</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="register-email"
                ref={emailInputRef}
                type="email"
                required={verificationMethod === 'EMAIL'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="alex@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.email
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all`}
              />
            </div>
            {fieldErrors.email && (
              <p
                id="email-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          {/* 5. Phone Field */}
          <div>
            <label htmlFor="register-phone" className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Phone Number {verificationMethod === 'PHONE' ? '*' : '(Optional)'}</span>
              {verificationMethod === 'EMAIL' && <span className="text-[10px] text-slate-500 font-normal">Can add later</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="register-phone"
                ref={phoneInputRef}
                type="tel"
                required={verificationMethod === 'PHONE'}
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  clearFieldError('phoneNumber');
                }}
                placeholder="+15551234567 or +919876543210"
                aria-invalid={Boolean(fieldErrors.phoneNumber)}
                aria-describedby={fieldErrors.phoneNumber ? 'phone-error' : undefined}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.phoneNumber
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all`}
              />
            </div>
            {fieldErrors.phoneNumber && (
              <p
                id="phone-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.phoneNumber}</span>
              </p>
            )}
          </div>

          {/* 6. Password Field */}
          <div>
            <label htmlFor="register-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password (12+ characters) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="register-password"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                placeholder="At least 12 characters"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.password
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p
                id="password-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.password}</span>
              </p>
            )}
          </div>

          {/* 7. Confirm Password Field */}
          <div>
            <label htmlFor="register-confirm-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="register-confirm-password"
                ref={confirmPasswordInputRef}
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder="Repeat password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.confirmPassword
                    ? 'border-rose-500/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white'
                    : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white'
                } text-sm placeholder-slate-500 outline-none transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p
                id="confirm-password-error"
                role="alert"
                aria-live="polite"
                className="mt-1.5 text-xs text-rose-400 flex items-start space-x-1.5 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{fieldErrors.confirmPassword}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.02] mt-2"
          >
            <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        )}

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>100% Client-Side Privacy Architecture Guaranteed</span>
      </div>
    </div>
  );
}
