import React from 'react';
import { Play, Sparkles, X } from 'lucide-react';
import { AUTO_RESUME_NOTIFICATION_MESSAGE } from '../utils/sessionTimer';

export function AutoResumeNoticeModal({ isOpen, message, onDismiss }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-md rounded-3xl p-6 border border-brand-500/40 bg-slate-950/95 space-y-5 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autoresume-modal-title"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          aria-label="Close notice"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className="p-3 rounded-2xl bg-brand-500/20 border border-brand-500/30 text-brand-400">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">Timer Resumed</span>
            <h3 id="autoresume-modal-title" className="text-lg font-bold text-white">Focus Session Active</h3>
          </div>
        </div>

        {/* Notice Message */}
        <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-brand-950/30 border border-brand-500/20 text-brand-100 text-xs leading-relaxed">
          <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="font-semibold">
            {message || AUTO_RESUME_NOTIFICATION_MESSAGE}
          </p>
        </div>

        {/* Action */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
