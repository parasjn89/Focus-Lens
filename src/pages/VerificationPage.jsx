import React, { useState, useEffect } from 'react';
import { Mail, Phone, ShieldCheck, AlertCircle, ArrowRight, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton.jsx';

export function VerificationPage({ onNavigate, registrationState }) {
  const {
    user,
    sendEmailVerification,
    verifyEmail,
    sendPhoneVerification,
    verifyPhone,
    switchVerificationMethod,
  } = useAuth();

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  // Switch modal state
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [newMethod, setNewMethod] = useState('EMAIL');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [switchError, setSwitchError] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  // Cooldown countdown timer
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

  const currentMethod = user?.preferredVerificationMethod || registrationState?.method || 'EMAIL';
  const effectivePhoneNumber = user?.phoneNumber || registrationState?.phoneNumber || '';
  const effectiveEmail = user?.email || registrationState?.email || '';
  const isVerified = user?.verificationStatus === 'VERIFIED';

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentMethod === 'PHONE') {
        const res = await verifyPhone(otpCode.trim());
        setSuccessMsg(res.message || 'Phone number verified successfully!');
      } else {
        const res = await verifyEmail(otpCode.trim());
        setSuccessMsg(res.message || 'Email verified successfully!');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check your code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    setIsResending(true);

    try {
      if (currentMethod === 'PHONE') {
        const targetPhone = effectivePhoneNumber;
        if (!targetPhone) {
          setError('No phone number on file. Please switch verification method or update your phone number.');
          return;
        }
        await sendPhoneVerification(targetPhone);
      } else {
        await sendEmailVerification(effectiveEmail || undefined);
      }
      setSuccessMsg(`New verification code sent via ${currentMethod}.`);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSwitchSubmit = async (e) => {
    e.preventDefault();
    setSwitchError(null);
    setIsSwitching(true);

    try {
      const payload = {
        phoneNumber: newMethod === 'PHONE' ? newPhoneNumber : undefined,
        email: newMethod === 'EMAIL' ? (newEmail.trim() || effectiveEmail) : undefined,
      };
      const res = await switchVerificationMethod(newMethod, payload);
      setShowSwitchModal(false);
      setSuccessMsg(res.message || `Switched verification method to ${newMethod}. New code sent!`);
      setResendCooldown(60);
      setOtpCode('');
    } catch (err) {
      setSwitchError(err.message || 'Failed to switch verification method.');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="mb-6 flex items-center justify-start">
        <BackButton
          label={user ? 'Back to Settings' : 'Back to Login'}
          onClick={() => onNavigate && onNavigate(user ? 'profile' : 'login')}
        />
      </div>

      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account Verification</h1>
        <p className="text-sm text-slate-400 mt-1">
          Prove ownership of your account to activate all features
        </p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {isVerified ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white">Your Account is Verified!</h2>
            <p className="text-xs text-slate-400">
              {user?.emailVerifiedAt && `Verified via Email (${user.email})`}
              {user?.phoneVerifiedAt && `Verified via SMS (${user.phoneNumber})`}
            </p>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all flex items-center justify-center space-x-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Prominent Verification Dispatch Banner */}
            <div className="mb-6 p-4 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-start space-x-3">
              {currentMethod === 'PHONE' ? (
                <Phone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              ) : (
                <Mail className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  {currentMethod === 'PHONE'
                    ? "We've sent a verification code to your phone."
                    : "We've sent a verification code to your email."}
                </div>
                <p className="text-xs text-slate-300">
                  {currentMethod === 'PHONE'
                    ? `Please enter the 6-digit SMS code sent to ${effectivePhoneNumber || 'your phone number'} below to activate your account.`
                    : `Please enter the 6-digit verification code sent to ${effectiveEmail || 'your email inbox'} below to activate your account.`}
                </p>
              </div>
            </div>

            {/* Active Method Badge */}
            <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {currentMethod === 'PHONE' ? (
                  <Phone className="w-5 h-5 text-indigo-400 shrink-0" />
                ) : (
                  <Mail className="w-5 h-5 text-brand-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-semibold text-white">
                    Verifying via {currentMethod === 'PHONE' ? 'SMS Phone Number' : 'Email Inbox'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentMethod === 'PHONE' ? (effectivePhoneNumber || 'No phone set') : (effectiveEmail || 'No email set')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewMethod(currentMethod === 'PHONE' ? 'EMAIL' : 'PHONE');
                  setShowSwitchModal(true);
                }}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium flex items-center space-x-1 border border-slate-800 transition-colors"
                title="Switch verification method"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-white placeholder-slate-600 outline-none transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                  Check your {currentMethod === 'PHONE' ? 'SMS text messages' : 'email inbox (or dev logs)'} for your code.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.02]"
              >
                <span>{isSubmitting ? 'Verifying...' : 'Verify Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Didn't receive a code?</span>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isResending}
                className="text-brand-400 hover:text-brand-300 font-semibold disabled:opacity-50 flex items-center space-x-1 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Switch Method Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Switch Verification Method</h3>
            <p className="text-xs text-slate-400">
              Choose your preferred method. A new verification code will be dispatched immediately.
            </p>

            {switchError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {switchError}
              </div>
            )}

            <form onSubmit={handleSwitchSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewMethod('EMAIL')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs font-medium transition-all ${
                    newMethod === 'EMAIL'
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-5 h-5 mb-1 text-brand-400" />
                  <span>Email Verification</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewMethod('PHONE')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs font-medium transition-all ${
                    newMethod === 'PHONE'
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Phone className="w-5 h-5 mb-1 text-indigo-400" />
                  <span>Phone Verification</span>
                </button>
              </div>

              {newMethod === 'PHONE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone Number (E.164 format)
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    placeholder="+15551234567 or +919876543210"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {newMethod === 'EMAIL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address {!effectiveEmail && '*'}
                  </label>
                  <input
                    type="email"
                    required={!effectiveEmail}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={effectiveEmail || 'alex@example.com'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500"
                  />
                  {effectiveEmail && (
                    <p className="text-[10px] text-slate-500 mt-1">Leave blank to use current email ({effectiveEmail})</p>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSwitching}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition-colors disabled:opacity-50"
                >
                  {isSwitching ? 'Switching...' : 'Confirm Switch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
