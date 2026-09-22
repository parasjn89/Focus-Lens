import React, { useState, useRef } from 'react';
import { Eye, EyeOff, User, Mail, Lock, AlertCircle, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mapErrorToField } from '../utils/registrationValidation.js';
import { FocusLensLogo } from '../components/FocusLensLogo.jsx';
import { GoogleIcon } from '../components/GoogleIcon.jsx';
import { signInWithGoogle } from '../lib/firebase.js';

export { mapErrorToField };

export function RegisterPage({ onNavigate, onRegisterSuccess }) {
  const { register, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field-specific validation errors: { username?, name?, email?, password?, confirmPassword? }
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Input refs for automatic focus & smooth scrolling
  const usernameInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const globalErrorRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const focusAndScrollField = (fieldName) => {
    const refMap = {
      username: usernameInputRef,
      name: nameInputRef,
      email: emailInputRef,
      password: passwordInputRef,
      confirmPassword: confirmPasswordInputRef,
    };
    const targetRef = refMap[fieldName];
    if (targetRef && targetRef.current) {
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
    if (error && error.toLowerCase().includes(fieldName.toLowerCase())) {
      setError(null);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().replace(/^@/, '');
    const newFieldErrors = {};

    // Client-side validation checks
    if (!cleanUsername) {
      newFieldErrors.username = 'Username is required.';
    } else if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      newFieldErrors.username = 'Username must be between 3 and 30 characters.';
    } else if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      newFieldErrors.username = 'Username can only contain letters, numbers, underscores, and periods.';
    }

    if (!name.trim()) {
      newFieldErrors.name = 'Full name is required.';
    } else if (name.trim().length < 2) {
      newFieldErrors.name = 'Full name must be at least 2 characters.';
    }

    if (!email.trim()) {
      newFieldErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newFieldErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newFieldErrors.password = 'Password is required.';
    } else if (password.length < 12) {
      newFieldErrors.password = 'Password must be at least 12 characters long.';
    }

    if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      const firstField = Object.keys(newFieldErrors)[0];
      const firstErrorMessage = newFieldErrors[firstField];
      setError(firstErrorMessage);
      showToast(firstErrorMessage, 'error');
      focusAndScrollField(firstField);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await register(
        cleanUsername,
        name.trim(),
        email.trim(),
        password,
        'EMAIL',
        ''
      );

      showToast('Account created successfully! Please verify your email.', 'success');

      if (onRegisterSuccess) {
        onRegisterSuccess('verify', {
          method: 'EMAIL',
          email: email.trim(),
          user: res?.user,
        });
      } else {
        onNavigate('verify');
      }
    } catch (err) {
      const { field, message } = mapErrorToField(err);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
        setError(message);
        showToast(message, 'error');
        focusAndScrollField(field);
      } else {
        setError(message);
        showToast(message, 'error');
        globalErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 relative">
      {/* Floating Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-rose-500/40 text-slate-200 px-4 py-3.5 rounded-xl shadow-2xl backdrop-blur-md flex items-start space-x-3 transition-all duration-300"
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
        {error && (
          <div
            ref={globalErrorRef}
            tabIndex={-1}
            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 outline-none"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium text-rose-200">{error}</div>
            </div>
          </div>
        )}

        {/* Quick Google Sign-Up */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting || isGoogleSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white font-medium text-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-50 hover:scale-[1.01] shadow-lg shadow-black/20 mb-6"
        >
          {isGoogleSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin shrink-0" />
              <span>Signing up with Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-slate-900 px-3 text-slate-500 font-medium">Or register with credentials</span>
          </div>
        </div>

        {/* Clean 5-Field Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Username (Unique Handle) *</span>
              <span className="text-[10px] text-slate-500 font-normal">Must be unique</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <span className="text-sm font-semibold text-slate-500">@</span>
              </div>
              <input
                ref={usernameInputRef}
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError('username');
                }}
                placeholder="parasjain"
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.username ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                } text-sm text-white placeholder-slate-500 outline-none transition-all font-mono`}
              />
            </div>
            {fieldErrors.username && (
              <p className="mt-1 text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="Paras Jain"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.name ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                } text-sm text-white placeholder-slate-500 outline-none transition-all`}
              />
            </div>
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                ref={emailInputRef}
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="paras@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                } text-sm text-white placeholder-slate-500 outline-none transition-all`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Password *
              </label>
              <span className="text-[10px] text-slate-500">12+ characters</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                } text-sm text-white placeholder-slate-500 outline-none transition-all`}
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
              Confirm Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <input
                ref={confirmPasswordInputRef}
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border ${
                  fieldErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                } text-sm text-white placeholder-slate-500 outline-none transition-all`}
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
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
