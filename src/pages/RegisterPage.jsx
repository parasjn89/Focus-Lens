import React, { useState } from 'react';
import { Eye, EyeOff, User, Mail, Lock, Phone, AlertCircle, ArrowRight, ShieldCheck, AtSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function RegisterPage({ onNavigate, onRegisterSuccess }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('EMAIL');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername || !name || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setError('Username must be between 3 and 30 characters long.');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      setError('Username can only contain letters, numbers, underscores, and periods.');
      return;
    }

    if (verificationMethod === 'EMAIL' && !email.trim()) {
      setError('Email address is required when Email Verification is selected.');
      return;
    }

    if (verificationMethod === 'PHONE' && !phoneNumber.trim()) {
      setError('Phone number is required when Phone Verification is selected.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(cleanUsername, name, email.trim() || null, password, verificationMethod, phoneNumber.trim() || null);
      if (onRegisterSuccess) onRegisterSuccess('verify');
      else onNavigate('verify');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
          <Eye className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create FocusLens Account</h1>
        <p className="text-sm text-slate-400 mt-1">Start tracking your deep work with privacy guarantees</p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Username (Unique Handle) *</span>
              <span className="text-[10px] text-slate-400 font-normal">Must be unique</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400 font-bold text-sm">
                @
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="parasjain"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
              />
            </div>
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
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Paras Jain"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Verification Method Choice */}
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
                  onChange={() => setVerificationMethod('EMAIL')}
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
                  onChange={() => setVerificationMethod('PHONE')}
                  className="sr-only"
                />
                <Phone className={`w-5 h-5 mb-1 ${verificationMethod === 'PHONE' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-xs font-medium">Phone SMS</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Verify via SMS code</span>
              </label>
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Email Address {verificationMethod === 'EMAIL' ? '*' : '(Optional)'}</span>
              {verificationMethod === 'PHONE' && <span className="text-[10px] text-slate-500 font-normal">Can add later</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required={verificationMethod === 'EMAIL'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Phone Number {verificationMethod === 'PHONE' ? '*' : '(Optional)'}</span>
              {verificationMethod === 'EMAIL' && <span className="text-[10px] text-slate-500 font-normal">Can add later</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                required={verificationMethod === 'PHONE'}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15551234567 or +919876543210"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password (12+ characters)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
