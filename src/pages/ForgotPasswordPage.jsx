import React, { useState, useEffect, useRef } from 'react';
import { Mail, Phone, Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ForgotPasswordPage({ onNavigate }) {
  const { requestForgotPassword, verifyResetToken, resetPassword } = useAuth();

  // Step flow:
  // 1: Choose Method (EMAIL / PHONE)
  // 2: Enter Email or Phone
  // 3: Verification Code (6-Digit OTP)
  // 4: Set New Password (12+ characters)
  // 5: Success Confirmation
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('EMAIL'); // 'EMAIL' or 'PHONE'
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetAuthToken, setResetAuthToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Mask destination helper (e.g. na***@gmail.com or +155***67)
  const getMaskedIdentifier = () => {
    if (!identifier) return '';
    if (method === 'EMAIL') {
      const parts = identifier.split('@');
      if (parts.length < 2) return identifier;
      const name = parts[0];
      const maskedName = name.length <= 2 ? name[0] + '***' : name.slice(0, 2) + '***';
      return `${maskedName}@${parts[1]}`;
    } else {
      if (identifier.length <= 6) return identifier;
      return `${identifier.slice(0, 4)}***${identifier.slice(-2)}`;
    }
  };

  // Cooldown timer countdown
  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Password strength logic
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-700' };
    const len = pass.length;
    if (len < 8) return { score: 1, label: 'Very Weak', color: 'bg-rose-500' };
    if (len < 12) return { score: 2, label: 'Weak (Need 12+ chars)', color: 'bg-amber-500' };

    let bonus = 0;
    if (len >= 16) bonus += 1;
    if (len >= 20) bonus += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) bonus += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) bonus += 1;

    if (bonus >= 3) return { score: 5, label: 'Excellent Passphrase', color: 'bg-emerald-400' };
    if (bonus >= 1) return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 3, label: 'Fair (12+ Chars)', color: 'bg-blue-500' };
  };

  const strength = getPasswordStrength(newPassword);

  // OTP Box Change Handler
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasted)) return;
    const digits = pasted.split('');
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  // Step 2: Request 6-digit OTP code
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setError(`Please enter your ${method === 'EMAIL' ? 'email address' : 'phone number'}.`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestForgotPassword(method, identifier.trim());
      setSuccessMsg(res.message || 'If an account exists, a verification code has been sent.');
      setResendCooldown(60);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Failed to request verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const res = await requestForgotPassword(method, identifier.trim());
      setSuccessMsg(res.message || 'A new verification code has been sent.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify 6-digit OTP Code
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyResetToken(method, identifier.trim(), fullCode);
      if (res.valid && res.resetToken) {
        setResetAuthToken(res.resetToken);
        setSuccessMsg('Verification code confirmed! Now enter your new password.');
        setStep(4);
      } else {
        setError(res.message || 'Invalid verification code.');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Submit New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 12) {
      setError('New password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword({
        token: resetAuthToken,
        method,
        identifier: identifier.trim(),
        newPassword,
        confirmPassword,
      });
      setSuccessMsg(res.message || 'Password reset successfully!');
      setStep(5);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
          <KeyRound className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Reset Your Password</h1>
        <p className="text-sm text-slate-400 mt-1">
          {step === 1 && 'Choose how you want to receive your 6-digit reset code'}
          {step === 2 && `Enter your ${method === 'EMAIL' ? 'email' : 'phone number'} to receive your verification code`}
          {step === 3 && `Enter the 6-digit code sent to your ${method === 'EMAIL' ? 'email' : 'phone'}`}
          {step === 4 && 'Create a new 12+ character password'}
          {step === 5 && 'Password successfully updated'}
        </p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && step !== 5 && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: METHOD SELECTION */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-3">
                Choose how you want to reset your password:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('EMAIL')}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 text-xs font-medium transition-all ${
                    method === 'EMAIL'
                      ? 'bg-brand-600/20 border-brand-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Mail className={`w-6 h-6 ${method === 'EMAIL' ? 'text-brand-400' : 'text-slate-500'}`} />
                  <span>Email</span>
                  <span className="text-[10px] text-slate-500">6-digit OTP code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('PHONE')}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 text-xs font-medium transition-all ${
                    method === 'PHONE'
                      ? 'bg-brand-600/20 border-brand-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Phone className={`w-6 h-6 ${method === 'PHONE' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>Phone Number</span>
                  <span className="text-[10px] text-slate-500">6-digit SMS OTP</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: ENTER IDENTIFIER & REQUEST OTP */}
        {step === 2 && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {method === 'EMAIL' ? 'Email Address' : 'Phone Number (E.164 format)'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  {method === 'EMAIL' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </div>
                <input
                  type={method === 'EMAIL' ? 'email' : 'tel'}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={method === 'EMAIL' ? 'you@example.com' : '+15551234567'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Sending...' : 'Send Verification Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Change reset method
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: ENTER 6-DIGIT VERIFICATION CODE (OTP) */}
        {step === 3 && (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">We sent a 6-digit verification code to:</p>
              <p className="text-sm font-semibold text-brand-400 font-mono">{getMaskedIdentifier()}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-3 text-center">
                Verification Code
              </label>
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-12 text-center text-lg font-bold text-white bg-slate-950 border border-slate-800 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all font-mono"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.join('').length !== 6}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying Code...' : 'Verify Code'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Edit {method === 'EMAIL' ? 'Email' : 'Phone'}
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className="text-brand-400 hover:text-brand-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : "Didn't receive it? Resend Code"}</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SET NEW PASSWORD */}
        {step === 4 && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            {/* Password Policy Reminder */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-brand-400" />
                <span>Password requirements:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li>At least 12 characters long</li>
                <li>Avoid common weak passwords or personal details</li>
              </ul>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password (12+ characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword && (
                <div className="space-y-1 pt-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">Strength:</span>
                    <span className="font-semibold text-slate-200">{strength.label}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          level <= strength.score ? strength.color : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || newPassword.length < 12 || newPassword !== confirmPassword}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Resetting Password...' : 'Reset Password'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 5: SUCCESS CONFIRMATION */}
        {step === 5 && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Password Reset Successfully!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your password has been updated and active sessions have been invalidated for security. Please sign in with your new password.
            </p>
            <button
              onClick={() => onNavigate('login')}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 mt-2"
            >
              <span>Go to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step !== 5 && (
          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Remember your password? <span className="text-brand-400 font-semibold">Sign In</span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Zero Account Enumeration Exposure Enforced</span>
      </div>
    </div>
  );
}
