import React from 'react';
import { X, CheckCircle2, ShieldCheck, Clock, Eye, AlertCircle } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime } from '../utils/formatters.js';
import { CATEGORY_COLORS } from './ActivityBreakdownChart.jsx';

export function SegmentDetailModal({
  segment = null,
  relativeTiming = null,
  onClose = () => {},
}) {
  if (!segment) return null;

  const durationSec = Math.max(0, Math.round((segment.durationMs || (segment.endTime - segment.startTime)) / 1000));
  const label = segment.label || ACTIVITY_LABELS[segment.type] || segment.type;
  const style = CATEGORY_COLORS[segment.type] || CATEGORY_COLORS.UNKNOWN;

  const startTimeStr = segment.startTime ? new Date(segment.startTime).toLocaleTimeString() : 'N/A';
  const endTimeStr = segment.endTime ? new Date(segment.endTime).toLocaleTimeString() : 'N/A';

  // Format contributing signals cleanly
  const signalMap = {
    FACE_PRESENT: 'Face present in camera view',
    FACE_ABSENT: 'Face absent in camera view',
    ONE_PERSON: 'One person detected in camera view',
    MULTIPLE_PEOPLE: 'Multiple people detected in camera view',
    NO_PERSON: 'No person detected in camera view',
    PHONE_PRESENT: 'Cell phone detected in camera view',
    PHONE_ABSENT: 'Cell phone not detected in camera view',
    HEAD_FORWARD: 'Head oriented forward toward camera/screen',
    HEAD_DOWN: 'Head oriented downward',
    HEAD_LEFT: 'Head turned to the left',
    HEAD_RIGHT: 'Head turned to the right',
    SCREEN_CODING: 'Coding IDE environment active on screen',
    SCREEN_DOCUMENT: 'Document / PDF text active on screen',
    SCREEN_VIDEO: 'Video playback active on screen',
    SCREEN_BROWSER: 'Web browser active on screen',
  };

  const contributingSignalsList = (segment.contributingSignals || []).map(
    (sig) => signalMap[sig] || sig
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-800 space-y-6 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="segment-modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-4">
          <div className={`p-3 rounded-2xl ${style.bg}/20 border ${style.border}`}>
            <span className={`w-3.5 h-3.5 rounded-full ${style.bg} block`} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Segment Details</span>
            <h3 id="segment-modal-title" className="text-xl font-extrabold text-white">{label}</h3>
          </div>
        </div>

        {/* Time & Duration Info Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block font-sans">Duration</span>
            <span className="text-base font-bold text-emerald-400">{formatSecondsToTime(durationSec)}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase block font-sans">Clock Time</span>
            <span className="text-xs font-bold text-slate-200">{startTimeStr} → {endTimeStr}</span>
          </div>
        </div>

        {/* Heuristic Evidence Score */}
        {segment.evidenceScore !== null && segment.evidenceScore !== undefined && (
          <div className="p-3.5 rounded-2xl bg-brand-950/40 border border-brand-900/60 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-sans">Heuristic Evidence Score</span>
            <span className="text-sm font-bold text-brand-300">
              {Math.round(segment.evidenceScore * 100)}%
            </span>
          </div>
        )}

        {/* Inferred From Observational Signals */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Eye className="w-3.5 h-3.5 text-brand-400" />
            <span>Inferred From Observational Signals</span>
          </h4>

          {segment.explanation && segment.explanation.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              {segment.explanation.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-900/40 rounded-xl border border-slate-800">
              Inferred from observable camera/screen signals.
            </p>
          )}
        </div>

        {/* Privacy Note & Rules Compliance */}
        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Inferred from observable signals. Heuristic evidence score, not probability.</span>
          </div>
        </div>

        {/* Close Footer Action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors border border-slate-700"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
