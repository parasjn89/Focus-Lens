import React, { useState, useMemo } from 'react';
import {
  Clapperboard,
  Clock,
  Code,
  BookOpen,
  Smartphone,
  EyeOff,
  Users,
  Film,
  Activity,
  CheckCircle2,
  X,
  Sparkles,
  Info,
} from 'lucide-react';
import { calculateFocusReplayMetrics } from '../utils/focusReplay.js';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { isQualifyingActivity } from '../utils/focusPoints.js';
import {
  calculateActivityDurations,
  calculateActivityPercentages,
} from '../utils/sessionAnalytics.js';
import { BackButton } from './BackButton.jsx';

/**
 * Category Visual Configurations
 * Mappings for color gradients, icons, indicator dots, and subtle glows.
 */
export const CATEGORY_CONFIG = {
  CODING: {
    label: 'Coding',
    icon: Code,
    gradient: 'from-blue-600 to-indigo-600',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/25',
    dot: 'bg-blue-500',
    text: 'text-blue-400',
    ring: 'ring-blue-400',
    accentColor: '#3b82f6',
  },
  STUDY_LIKE: {
    label: 'Study-like',
    icon: BookOpen,
    gradient: 'from-emerald-600 to-teal-600',
    border: 'border-emerald-500/40',
    glow: 'shadow-emerald-500/25',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
    ring: 'ring-emerald-400',
    accentColor: '#10b981',
  },
  PHONE_ACTIVITY: {
    label: 'Phone Activity',
    icon: Smartphone,
    gradient: 'from-amber-500 to-orange-600',
    border: 'border-amber-500/40',
    glow: 'shadow-amber-500/25',
    dot: 'bg-amber-500',
    text: 'text-amber-400',
    ring: 'ring-amber-400',
    accentColor: '#f59e0b',
  },
  AWAY_OR_NOT_VISIBLE: {
    label: 'Away / Not Visible',
    icon: EyeOff,
    gradient: 'from-rose-600 to-red-600',
    border: 'border-rose-500/40',
    glow: 'shadow-rose-500/25',
    dot: 'bg-rose-500',
    text: 'text-rose-400',
    ring: 'ring-rose-400',
    accentColor: '#f43f5e',
  },
  MULTIPLE_PEOPLE: {
    label: 'Multiple People',
    icon: Users,
    gradient: 'from-purple-600 to-violet-600',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/25',
    dot: 'bg-purple-500',
    text: 'text-purple-400',
    ring: 'ring-purple-400',
    accentColor: '#a855f7',
  },
  VIDEO_ACTIVITY: {
    label: 'Video Activity',
    icon: Film,
    gradient: 'from-purple-500 to-fuchsia-600',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/25',
    dot: 'bg-purple-400',
    text: 'text-purple-300',
    ring: 'ring-purple-400',
    accentColor: '#c084fc',
  },
  BROWSER_ACTIVITY: {
    label: 'Browser Activity',
    icon: Code,
    gradient: 'from-cyan-600 to-blue-600',
    border: 'border-cyan-500/40',
    glow: 'shadow-cyan-500/25',
    dot: 'bg-cyan-500',
    text: 'text-cyan-400',
    ring: 'ring-cyan-400',
    accentColor: '#06b6d4',
  },
  DOCUMENT_ACTIVITY: {
    label: 'Document Activity',
    icon: BookOpen,
    gradient: 'from-sky-600 to-blue-700',
    border: 'border-sky-500/40',
    glow: 'shadow-sky-500/25',
    dot: 'bg-sky-500',
    text: 'text-sky-400',
    ring: 'ring-sky-400',
    accentColor: '#0284c7',
  },
  SPEECH_LIKE: {
    label: 'Speech-like',
    icon: Users,
    gradient: 'from-teal-600 to-cyan-600',
    border: 'border-teal-500/40',
    glow: 'shadow-teal-500/25',
    dot: 'bg-teal-500',
    text: 'text-teal-400',
    ring: 'ring-teal-400',
    accentColor: '#14b8a6',
  },
  UNKNOWN: {
    label: 'Other Activity',
    icon: Activity,
    gradient: 'from-slate-700 to-slate-800',
    border: 'border-slate-700',
    glow: 'shadow-slate-700/20',
    dot: 'bg-slate-500',
    text: 'text-slate-400',
    ring: 'ring-slate-400',
    accentColor: '#64748b',
  },
};

/**
 * Dynamically computes 4 to 6 clean, evenly spaced time scale tick markers
 * based on total session duration in seconds.
 */
export function generateTimeScaleTicks(totalSec) {
  if (totalSec <= 0) return [{ sec: 0, label: '00:00', percent: 0 }];

  const targetTickCount = 5;
  const rawStep = totalSec / targetTickCount;
  const niceSteps = [10, 15, 30, 45, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600];
  const step = niceSteps.find((s) => s >= rawStep) || Math.max(30, Math.ceil(rawStep / 60) * 60);

  const ticks = [];
  for (let s = 0; s < totalSec; s += step) {
    ticks.push({
      sec: s,
      label: formatSecondsToTime(s),
      percent: Math.min(100, (s / totalSec) * 100),
    });
  }

  // Ensure end-point tick marker is present
  const lastTick = ticks[ticks.length - 1];
  if (!lastTick || totalSec - lastTick.sec > step * 0.4) {
    ticks.push({
      sec: totalSec,
      label: formatSecondsToTime(totalSec),
      percent: 100,
    });
  } else {
    ticks[ticks.length - 1] = {
      sec: totalSec,
      label: formatSecondsToTime(totalSec),
      percent: 100,
    };
  }

  return ticks;
}

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
  const [highlightedCategory, setHighlightedCategory] = useState(null);

  const firstStartMs = activitySegments[0]?.startTime || Date.now();
  const totalDurationSec = Math.max(1, replay.totalActiveSec);

  // Time scale tick markers
  const timeTicks = useMemo(() => generateTimeScaleTicks(totalDurationSec), [totalDurationSec]);

  // Derive finalized activity totals using the single denominator system
  const categoryDurations = useMemo(() => {
    if (reportData?.activityDurations && Object.keys(reportData.activityDurations).length > 0) {
      return reportData.activityDurations;
    }
    return calculateActivityDurations(replay.mergedSegments);
  }, [reportData?.activityDurations, replay.mergedSegments]);

  const categoryPercentages = useMemo(() => {
    return calculateActivityPercentages(categoryDurations, totalDurationSec);
  }, [categoryDurations, totalDurationSec]);

  // Build the clean horizontal legend list matching the reference
  const displayLegendCategories = useMemo(() => {
    const primaryOrder = [
      'CODING',
      'STUDY_LIKE',
      'PHONE_ACTIVITY',
      'AWAY_OR_NOT_VISIBLE',
      'MULTIPLE_PEOPLE',
    ];

    const activeSet = new Set(
      Object.keys(categoryDurations).filter((type) => (categoryDurations[type] || 0) > 0)
    );

    // Combine primary order with any other observed types
    const allTypes = Array.from(new Set([...primaryOrder, ...activeSet]));

    return allTypes.map((type) => {
      const cfg = CATEGORY_CONFIG[type] || CATEGORY_CONFIG.UNKNOWN;
      const durSec = categoryDurations[type] || 0;
      const percentage = categoryPercentages[type] || 0;
      return {
        type,
        label: cfg.label,
        config: cfg,
        durationSec: durSec,
        formattedDuration: durSec > 0 ? formatSecondsToTime(durSec) : null,
        percentage,
        isActiveInSession: durSec > 0,
      };
    });
  }, [categoryDurations, categoryPercentages]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <BackButton label="Back to Session Report" onClick={onBackToReport} />
        
        {/* Compact Session Duration Badge */}
        <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span className="font-bold text-white">{formatSecondsToTime(totalDurationSec)}</span>
          <span className="text-slate-500">Duration</span>
        </div>
      </div>

      {/* Main Focus Replay Card (Dark Glassmorphism) */}
      <div className="rounded-3xl bg-[#090e1a]/95 border border-slate-800/80 shadow-2xl backdrop-blur-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        
        {/* Subtle Decorative Waveform & Radial Glow Background */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-3/4 h-36 bg-gradient-to-b from-cyan-500/20 via-brand-500/10 to-transparent blur-3xl" />
          <svg
            className="w-full h-32 absolute top-12 left-0"
            preserveAspectRatio="none"
            viewBox="0 0 1200 120"
          >
            <path
              d="M0,60 C150,90 300,30 450,60 C600,90 750,25 900,55 C1050,85 1200,45 1200,60"
              fill="none"
              stroke="url(#focusWaveGrad)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M0,45 C180,20 360,75 540,50 C720,25 900,70 1080,45 C1140,37 1200,40 1200,45"
              fill="none"
              stroke="url(#focusWaveGrad2)"
              strokeWidth="1"
              opacity="0.6"
            />
            <defs>
              <linearGradient id="focusWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="focusWaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 1. Header with Segmented Navigation Control */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-brand-500/25">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Focus Replay
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Replay your session like a story.
              </p>
            </div>
          </div>

          {/* Segmented Navigation Control: Timeline | Focus Map | Insights */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80 shadow-inner self-start sm:self-auto">
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition-all cursor-default"
            >
              Timeline
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-xl text-slate-500 font-medium text-xs flex items-center space-x-1 cursor-not-allowed opacity-60 hover:text-slate-400 transition-colors"
              title="Focus Map is coming in a future update"
            >
              <span>Focus Map</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">Soon</span>
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-xl text-slate-500 font-medium text-xs flex items-center space-x-1 cursor-not-allowed opacity-60 hover:text-slate-400 transition-colors"
              title="Deep Insights is coming in a future update"
            >
              <span>Insights</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">Soon</span>
            </button>
          </div>
        </div>

        {/* 2. Main Chronological Timeline */}
        {!replay.hasData || replay.mergedSegments.length === 0 ? (
          <div className="p-12 text-center space-y-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 relative z-10">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No activity data available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Activity observations will appear here after a completed focus session.
            </p>
          </div>
        ) : (
          <div className="relative z-10 space-y-3">
            {/* Timeline Track with Horizontal Scroll Safety for Mobile */}
            <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[620px] space-y-2">
                {/* Horizontal Activity Timeline Container */}
                <div
                  className="w-full bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800/80 flex gap-1 min-h-[68px] shadow-inner items-stretch relative"
                  role="region"
                  aria-label="Chronological Focus Session Timeline"
                >
                  {replay.mergedSegments.map((seg, idx) => {
                    const durSec = Math.max(
                      1,
                      Math.round((seg.durationMs || seg.endTime - seg.startTime) / 1000)
                    );
                    const widthPercent = Math.max(1.5, (durSec / totalDurationSec) * 100);
                    const isSelected = selectedSegment?.id === (seg.id || `seg_${idx}`);
                    const isCategoryHighlighted =
                      highlightedCategory === null || highlightedCategory === seg.type;
                    const config = CATEGORY_CONFIG[seg.type] || CATEGORY_CONFIG.UNKNOWN;
                    const IconComponent = config.icon;
                    const label = seg.label || config.label || seg.type;

                    const relativeStartSec = Math.max(
                      0,
                      Math.round(((seg.startTime || firstStartMs) - firstStartMs) / 1000)
                    );
                    const relativeEndSec = Math.max(
                      0,
                      Math.round(((seg.endTime || firstStartMs) - firstStartMs) / 1000)
                    );

                    return (
                      <button
                        key={seg.id || `bar_${idx}`}
                        type="button"
                        tabIndex={0}
                        aria-selected={isSelected}
                        aria-label={`${label} activity from ${formatSecondsToTime(
                          relativeStartSec
                        )} to ${formatSecondsToTime(relativeEndSec)}, duration ${formatSecondsToTime(durSec)}`}
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
                        className={`group relative rounded-xl transition-all duration-200 flex items-center justify-center px-1 select-none focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950 bg-gradient-to-r ${
                          config.gradient
                        } border ${config.border} ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 scale-[1.02] z-20 shadow-xl shadow-cyan-500/30'
                            : selectedSegment
                            ? 'opacity-65 hover:opacity-100 hover:scale-[1.01]'
                            : isCategoryHighlighted
                            ? 'opacity-100 hover:opacity-95 hover:scale-[1.01] shadow-sm'
                            : 'opacity-35 hover:opacity-85'
                        }`}
                      >
                        {/* Playhead Marker when selected */}
                        {isSelected && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%+24px)] bg-cyan-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.9)]">
                            <div className="w-2 h-2 bg-cyan-300 rounded-full absolute -top-1 left-1/2 -translate-x-1/2 shadow-sm" />
                          </div>
                        )}

                        {/* Inside Segment: Icon & Label */}
                        <div className="flex items-center justify-center space-x-1.5 pointer-events-none drop-shadow select-none px-1 overflow-hidden">
                          {IconComponent && (
                            <IconComponent className="w-3.5 h-3.5 shrink-0 text-white" />
                          )}
                          {widthPercent >= 8 && (
                            <span className="text-[11px] font-bold text-white truncate">
                              {label}
                            </span>
                          )}
                        </div>

                        {/* Floating Segment Tooltip on Hover */}
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-40 transition-all">
                          <div className="bg-slate-900/95 backdrop-blur-xl text-white py-2.5 px-3.5 rounded-2xl border border-slate-700/80 shadow-2xl space-y-1 min-w-[160px] text-left">
                            <div className="flex items-center space-x-1.5 pb-1 border-b border-slate-800">
                              {IconComponent && (
                                <IconComponent className={`w-3.5 h-3.5 ${config.text}`} />
                              )}
                              <span className="font-bold text-white text-xs">{label}</span>
                            </div>
                            <div className="text-slate-300 text-[11px] font-mono pt-0.5">
                              {formatSecondsToTime(relativeStartSec)} – {formatSecondsToTime(relativeEndSec)}
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              Duration: <span className="text-white font-bold">{formatSecondsToTime(durSec)}</span>
                            </div>
                            {seg.evidenceScore !== null && seg.evidenceScore !== undefined && (
                              <div className="text-emerald-400 text-[10px]">
                                Confidence:{' '}
                                <span className="font-bold">{Math.round(seg.evidenceScore * 100)}%</span>
                              </div>
                            )}
                          </div>
                          <div className="w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 -mt-1.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Time Scale Ruler */}
                <div className="relative w-full h-6 text-[10px] sm:text-[11px] font-mono text-slate-400 select-none px-1">
                  {timeTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute transform -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${tick.percent}%` }}
                    >
                      <div className="w-px h-1.5 bg-slate-700 mb-0.5" />
                      <span>{tick.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Selected Segment Details Inspector Panel */}
            {selectedSegment && selectedRelativeTiming && (
              <div className="p-5 rounded-2xl border border-brand-500/40 bg-slate-950/95 space-y-3.5 shadow-2xl animate-fadeIn relative z-20">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        CATEGORY_CONFIG[selectedSegment.type]?.dot || 'bg-brand-500'
                      }`}
                    />
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      {selectedSegment.label ||
                        CATEGORY_CONFIG[selectedSegment.type]?.label ||
                        ACTIVITY_LABELS[selectedSegment.type] ||
                        selectedSegment.type}
                    </h4>
                    {isQualifyingActivity(selectedSegment.type) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ✓ Qualifying Focus
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Non-Qualifying
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSegment(null);
                      setSelectedRelativeTiming(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
                    aria-label="Close segment inspector"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[11px] block mb-0.5">Start Time</span>
                    <span className="text-sm font-bold text-brand-300 font-mono">
                      {formatSecondsToTime(selectedRelativeTiming.relativeStartSec)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[11px] block mb-0.5">End Time</span>
                    <span className="text-sm font-bold text-brand-300 font-mono">
                      {formatSecondsToTime(selectedRelativeTiming.relativeEndSec)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[11px] block mb-0.5">Duration</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatSecondsToTime(selectedRelativeTiming.durSec)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[11px] block mb-0.5">Confidence</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {selectedSegment.evidenceScore !== null &&
                      selectedSegment.evidenceScore !== undefined
                        ? `${Math.round(selectedSegment.evidenceScore * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Observational Evidence & Reasons */}
                {selectedSegment.explanation && selectedSegment.explanation.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-semibold text-slate-300 block">
                      Observational Evidence:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      {selectedSegment.explanation.map((reason, rIdx) => (
                        <li key={rIdx} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 4. Horizontal Activity Legend */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {displayLegendCategories.map((cat) => {
                  const isCatActive =
                    highlightedCategory === null || highlightedCategory === cat.type;
                  return (
                    <button
                      key={cat.type}
                      type="button"
                      onClick={() =>
                        setHighlightedCategory((prev) => (prev === cat.type ? null : cat.type))
                      }
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                        isCatActive
                          ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-50'
                      } hover:border-slate-600 cursor-pointer`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.config.dot}`} />
                      <span className="font-semibold text-slate-200">{cat.label}</span>
                      {cat.formattedDuration && (
                        <span className="font-mono text-[11px] text-slate-400">
                          {cat.formattedDuration}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {highlightedCategory && (
                <button
                  type="button"
                  onClick={() => setHighlightedCategory(null)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FocusReplayView;
