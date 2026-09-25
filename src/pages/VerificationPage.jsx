import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, AlertCircle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton.jsx';

export function VerificationPage({ onNavigate, registrationState }) {
  const { user, sendEmailVerification, verifyEmail, refreshUser, logout } = useAuth();

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const effectiveEmail = user?.email || registrationState?.email || '';
  const isVerified = user?.verificationStatus === 'VERIFIED';

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmail(cleanCode);
      setSuccessMsg(res.message || 'Email verified successfully!');
      if (refreshUser) await refreshUser();
      setTimeout(() => {
        onNavigate('dashboard');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check your code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_) {}
    onNavigate('login');
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    setError(null);
    setSuccessMsg(null);
    setIsResending(true);

    try {
      await sendEmailVerification(effectiveEmail || undefined);
      setSuccessMsg('A new 6-digit verification code has been sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-6">
        {isVerified ? (
          <BackButton onClick={() => onNavigate('dashboard')} label="Back to Dashboard" />
        ) : (
          <BackButton onClick={handleLogout} label="Sign Out" />
        )}
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Verify Your Email</h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            We sent verification instructions to{' '}
            <strong className="text-white font-mono">{effectiveEmail || 'your email'}</strong>
          </p>
        </div>

        {isVerified && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-200">Account Verified</p>
              <p className="text-emerald-300/80 mt-0.5">Your email address is already verified.</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="font-medium text-emerald-200">{successMsg}</div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="font-medium text-rose-200">{error}</div>
          </div>
        )}

        {!isVerified ? (
          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Verification Code</span>
                <span className="text-[10px] text-slate-500 font-normal">6-digit OTP</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] font-mono text-lg py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white placeholder-slate-700 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCode.trim().length !== 6}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify Email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all flex items-center justify-center space-x-2"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col items-center space-y-3">
          <button
            type="button"
            disabled={resendCooldown > 0 || isResending}
            onClick={handleResendCode}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            <span>
              {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend verification email'}
            </span>
          </button>

          {!isVerified && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Sign out or switch account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
