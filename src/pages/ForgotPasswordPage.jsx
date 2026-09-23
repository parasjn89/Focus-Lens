import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton.jsx';
export function ForgotPasswordPage({ onNavigate }) {
  const { requestForgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await requestForgotPassword('EMAIL', cleanEmail);
      setIsSubmitted(true);
    } catch (err) {
      // Account enumeration defense: show success regardless
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-6">
        <BackButton onClick={() => onNavigate('login')} label="Back to Login" />
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Enter your registered email address and we'll send you instructions to reset your password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="font-medium text-rose-200">{error}</div>
          </div>
        )}

        {isSubmitted ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-200">Reset Instructions Sent</p>
                <p className="text-emerald-300/80 mt-1 leading-relaxed">
                  If an account exists with <strong className="text-white font-mono">{email}</strong>, we have sent password reset instructions to your inbox.
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-emerald-500/20 text-[11px] text-slate-300">
                  <p className="font-medium text-emerald-300">Important:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                    <li>Please use the link in the <strong>most recent email</strong> received.</li>
                    <li>If you don't see it within a minute, check your spam/junk folder.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2"
              >
                <span>Return to Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setError(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium transition-all"
              >
                Send to a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Sending instructions...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
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
