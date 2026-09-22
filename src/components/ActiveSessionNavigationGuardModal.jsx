import React, { useEffect, useRef } from 'react';
import { ShieldAlert, Sparkles, X } from 'lucide-react';

/**
 * ActiveSessionNavigationGuardModal
 *
 * Intercepts attempts to leave an active focus session.
 * In accordance with FocusLens requirements:
 * - Displays a single "Stay in Session" button (no exit / leave buttons here).
 * - Styled in FocusLens dark navy / deep teal palette with electric-blue accents.
 * - Backdrop click or Escape key dismisses the warning modal and keeps the user in session.
 */
export function ActiveSessionNavigationGuardModal({ isOpen, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the primary button when modal opens for keyboard accessibility
    if (buttonRef.current) {
      buttonRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081318]/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 border border-[#168CFF]/30 bg-[#10232A]/95 space-y-5 shadow-2xl shadow-[#168CFF]/10 relative backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nav-guard-modal-title"
        aria-describedby="nav-guard-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#18313A] hover:bg-[#203A43] text-[#9BAFBC] hover:text-[#F2F6F8] border border-[rgba(120,170,190,0.16)] transition-colors focus:outline-none focus:ring-2 focus:ring-[#168CFF]"
          aria-label="Close dialog and stay in session"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Lock/Shield Icon */}
        <div className="flex items-center space-x-3.5 border-b border-[rgba(120,170,190,0.14)] pb-4">
          <div className="p-3 rounded-2xl bg-[#168CFF]/15 border border-[#168CFF]/30 text-[#168CFF] flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] uppercase font-bold text-[#00B8E6] tracking-wider">
                Active Session Guard
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00B8E6] animate-pulse" />
            </div>
            <h3 id="nav-guard-modal-title" className="text-lg font-bold text-[#F2F6F8]">
              Focus Session in Progress
            </h3>
          </div>
        </div>

        {/* Primary Message Box */}
        <div className="p-4 rounded-2xl bg-[#18313A]/90 border border-[#168CFF]/25 space-y-2">
          <p id="nav-guard-modal-desc" className="text-sm font-semibold text-[#F2F6F8] leading-snug">
            You can't leave the active session until it is finished.
          </p>
          <p className="text-xs text-[#9BAFBC] leading-relaxed flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00B8E6] flex-shrink-0" />
            <span>Stay focused and complete your current session to continue.</span>
          </p>
        </div>

        {/* Actions - strictly single "Stay in Session" button */}
        <div className="flex items-center justify-end pt-1">
          <button
            ref={buttonRef}
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#168CFF] to-[#00B8E6] hover:from-[#1479dc] hover:to-[#00a3cc] text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(22,140,255,0.3)] transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#168CFF] focus:ring-offset-2 focus:ring-offset-[#10232A]"
          >
            Stay in Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActiveSessionNavigationGuardModal;
