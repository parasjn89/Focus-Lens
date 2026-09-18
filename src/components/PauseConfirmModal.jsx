import React from 'react';
import { Pause, AlertCircle, X } from 'lucide-react';
import { PAUSE_CONFIRMATION_MESSAGE } from '../utils/sessionTimer';

export function PauseConfirmModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-md rounded-3xl p-6 border border-amber-500/30 bg-slate-950/95 space-y-5 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
      >
        {/* Close / Cancel icon button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          aria-label="Cancel pause"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
            <Pause className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Pause Session</span>
            <h3 id="pause-modal-title" className="text-lg font-bold text-white">Pause Focus Timer?</h3>
          </div>
        </div>

        {/* Warning Message */}
        <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-amber-200 text-xs leading-relaxed">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="font-medium">
            {PAUSE_CONFIRMATION_MESSAGE}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
          >
            Pause Timer
          </button>
        </div>
      </div>
    </div>
  );
}
