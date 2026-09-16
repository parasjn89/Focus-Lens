import React, { useState } from 'react';
import {
  Play,
  Clock,
  Award,
  Zap,
  Flame,
  AlertCircle,
  ArrowLeft,
  Smartphone,
  Users,
  EyeOff,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  Info,
  Sliders,
} from 'lucide-react';
import { calculateFocusReplayMetrics } from '../utils/focusReplay.js';
import { formatSecondsToTime } from '../utils/formatters.js';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { CATEGORY_COLORS } from './ActivityBreakdownChart.jsx';
import { isQualifyingActivity } from '../utils/focusPoints.js';
import { BackButton } from './BackButton.jsx';

export function FocusReplayView({ reportData = {}, onBackToReport }) {
  const {
    activity = 'Focus Session',
    targetMinutes = 25,
    actualSecondsSpent = 0,
    activitySegments = [],
    completedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  } = reportData || {};

  const replay = calculateFocusReplayMetrics(activitySegments, reportData);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedRelativeTiming, setSelectedRelativeTiming] = useState(null);

  const firstStartMs = activitySegments[0]?.startTime || Date.now();
  const totalDurationSec = Math.max(1, replay.totalActiveSec);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">FOCUS REPLAY</h1>
          </div>
          <p className="text-xs text-slate-400">
            Chronological observability replay for <strong>{activity}</strong> ({completedAt})
          </p>
        </div>

        <BackButton
          label="Back to Session Report"
          onClick={onBackToReport}
        />
      </div>

      {/* 1. Summary Metrics Header Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Session Duration */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium block mb-1">Session Duration</span>
          <span className="text-2xl font-black text-white font-mono">{replay.sessionDurationMin} min</span>
          <span className="text-[10px] text-slate-500 block font-mono">({formatSecondsToTime(replay.totalActiveSec)})</span>
        </div>

        {/* Focused Time */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium block mb-1">Focused Time</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{replay.focusedTimeMin} min</span>
          <span className="text-[10px] text-slate-500 block font-mono">({formatSecondsToTime(replay.totalQualifyingSec)})</span>
        </div>

        {/* Focus Points */}
        <div className="p-4 rounded-2xl bg-brand-950/40 border border-brand-500/30 shadow-md">
          <span className="text-[11px] text-brand-300 font-medium block mb-1">Focus Points</span>
          <span className="text-2xl font-black text-white font-mono">+{replay.focusPoints}</span>
          <span className="text-[10px] text-brand-400 block font-medium">1 pt / min focused</span>
        </div>

        {/* Longest Deep Work Block */}
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 shadow-md">
          <span className="text-[11px] text-emerald-300 font-medium block mb-1">Longest Deep Work Block</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{replay.deepWork?.longestBlockText || replay.longestFocusBlockText}</span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {replay.deepWork?.longestBlockRange || 'Continuous focus'}
          </span>
        </div>

        {/* Total Interruptions */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 font-medium block mb-1">Total Interruptions</span>
          <span className={`text-2xl font-black font-mono ${replay.totalInterruptions > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {replay.totalInterruptions}
          </span>
          <span className="text-[10px] text-slate-500 block">Non-focus intervals</span>
        </div>
      </div>

      {!replay.hasData ? (
        <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center space-y-3">
          <Clock className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No Activity Segments</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            No activity segments were recorded for this session. Make sure camera or screen monitoring permissions are enabled during focus sessions.
          </p>
        </div>
      ) : (
        <>
          {/* 2. Scaled Chronological Horizontal Bar Timeline */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Chronological Replay Timeline</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Click any segment block to inspect observational details
              </span>
            </div>

            {/* Time Indicators */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span>00:00</span>
              <span>{formatSecondsToTime(Math.round(totalDurationSec / 2))}</span>
              <span>{formatSecondsToTime(totalDurationSec)}</span>
            </div>

            {/* Interactive Timeline Bar */}
            <div className="w-full bg-slate-950 p-1.5 rounded-2xl border border-slate-800/90 flex gap-1 overflow-x-auto min-h-[56px] shadow-inner">
              {replay.mergedSegments.map((seg, idx) => {
                const durSec = Math.max(1, Math.round((seg.durationMs || (seg.endTime - seg.startTime)) / 1000));
                const widthPercent = Math.max(1.5, (durSec / totalDurationSec) * 100);
                const isSelected = selectedSegment?.id === (seg.id || `seg_${idx}`);
                const isQualifying = isQualifyingActivity(seg.type);
                const style = CATEGORY_COLORS[seg.type] || CATEGORY_COLORS.UNKNOWN;
                const label = seg.label || ACTIVITY_LABELS[seg.type] || seg.type;

                const relativeStartSec = Math.max(0, Math.round(((seg.startTime || firstStartMs) - firstStartMs) / 1000));
                const relativeEndSec = Math.max(0, Math.round(((seg.endTime || firstStartMs) - firstStartMs) / 1000));

                return (
                  <button
                    key={seg.id || `bar_${idx}`}
                    type="button"
                    tabIndex={0}
                    aria-label={`Segment ${idx + 1}: ${label}, duration ${formatSecondsToTime(durSec)} from ${formatSecondsToTime(relativeStartSec)} to ${formatSecondsToTime(relativeEndSec)}`}
                    onClick={() => {
                      setSelectedSegment(seg);
                      setSelectedRelativeTiming({ relativeStartSec, relativeEndSec, durSec });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSegment(seg);
                        setSelectedRelativeTiming({ relativeStartSec, relativeEndSec, durSec });
                      }
                    }}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-12 rounded-xl transition-all flex items-center justify-center px-1 relative group focus:outline-none focus:ring-2 focus:ring-brand-400 ${style.bg} ${
                      isSelected ? 'ring-2 ring-white scale-[1.03] z-20 shadow-lg' : 'hover:opacity-90 hover:scale-[1.01]'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-900 truncate px-1 select-none pointer-events-none">
                      {widthPercent > 6 ? label : ''}
                    </span>

                    {/* Tooltip on Hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                      <div className="bg-slate-900 text-white text-[10px] font-mono py-1.5 px-2.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
                        <span className="font-bold text-brand-300">{label}</span>
                        <div className="text-slate-400">
                          {formatSecondsToTime(relativeStartSec)} – {formatSecondsToTime(relativeEndSec)} ({formatSecondsToTime(durSec)})
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timeline Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-800/60">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-slate-300">Study-like</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-cyan-500" />
                <span className="text-slate-300">Coding</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-slate-300">Phone Activity</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-slate-300">Away / Not Visible</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-slate-300">Multiple People</span>
              </div>
            </div>
          </div>

          {/* 3. Selected Segment Details Inspector Panel */}
          {selectedSegment && selectedRelativeTiming && (
            <div className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-slate-950/90 space-y-4 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${CATEGORY_COLORS[selectedSegment.type]?.bg || 'bg-brand-500'}`} />
                  <h4 className="text-base font-extrabold text-white">
                    {selectedSegment.label || ACTIVITY_LABELS[selectedSegment.type] || selectedSegment.type}
                  </h4>
                  {isQualifyingActivity(selectedSegment.type) ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ✓ Qualifying Focus Activity
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Non-Qualifying Interruption
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSegment(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-800"
                >
                  Close Details
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Start Time</span>
                  <span className="text-sm font-bold text-brand-300 font-mono">
                    {formatSecondsToTime(selectedRelativeTiming.relativeStartSec)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 font-medium block">End Time</span>
                  <span className="text-sm font-bold text-brand-300 font-mono">
                    {formatSecondsToTime(selectedRelativeTiming.relativeEndSec)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Duration</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {formatSecondsToTime(selectedRelativeTiming.durSec)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Confidence</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {selectedSegment.evidenceScore !== null && selectedSegment.evidenceScore !== undefined
                      ? `${Math.round(selectedSegment.evidenceScore * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Observational Evidence & Reasons */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-slate-300 block">Observational Signals & Reasons:</span>
                {selectedSegment.explanation && selectedSegment.explanation.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-300 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                    {selectedSegment.explanation.map((reason, rIdx) => (
                      <li key={rIdx} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No specific observational evidence notes stored for this segment.</p>
                )}
              </div>
            </div>
          )}

          {/* 4. Interruptions Summary Section */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Interruption Summary</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {replay.totalInterruptions} non-qualifying interval{replay.totalInterruptions === 1 ? '' : 's'}
              </span>
            </div>

            {replay.interruptions.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero interruptions recorded! Uninterrupted focus maintained throughout the entire session.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {replay.interruptions.map((inter) => (
                  <div
                    key={inter.id}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-brand-300 font-bold">
                          {inter.relativeStartTimeText} – {inter.relativeEndTimeText}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="font-bold text-white">{inter.label}</span>
                        <span className="text-slate-400 font-mono">({inter.durationText})</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {inter.observationalReason}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSegment(inter);
                        setSelectedRelativeTiming({
                          relativeStartSec: inter.relativeStartSec,
                          relativeEndSec: inter.relativeEndSec,
                          durSec: inter.durationSec,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors shrink-0"
                    >
                      View Segment
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
