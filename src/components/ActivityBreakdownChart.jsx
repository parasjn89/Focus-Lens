import React, { useState } from 'react';
import { BarChart2, List, PieChart, Info, Clock } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';

export const CATEGORY_COLORS = {
  CODING: { bg: 'bg-brand-500', text: 'text-brand-400', border: 'border-brand-500/30', fill: '#6366f1', gradient: 'from-blue-600 via-indigo-500 to-cyan-500' },
  STUDY_LIKE: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', fill: '#10b981', gradient: 'from-emerald-600 via-teal-500 to-emerald-400' },
  PHONE_ACTIVITY: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', fill: '#f59e0b', gradient: 'from-amber-600 via-orange-500 to-yellow-400' },
  MULTIPLE_PEOPLE: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', fill: '#818cf8', gradient: 'from-indigo-600 via-violet-500 to-purple-400' },
  AWAY_OR_NOT_VISIBLE: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30', fill: '#f43f5e', gradient: 'from-rose-600 via-rose-500 to-pink-500' },
  VIDEO_ACTIVITY: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', fill: '#a855f7', gradient: 'from-purple-600 via-purple-500 to-fuchsia-400' },
  BROWSER_ACTIVITY: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30', fill: '#06b6d4', gradient: 'from-cyan-600 via-cyan-500 to-sky-400' },
  DOCUMENT_ACTIVITY: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', fill: '#3b82f6', gradient: 'from-blue-600 via-blue-500 to-indigo-400' },
  SPEECH_LIKE: { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500/30', fill: '#14b8a6', gradient: 'from-teal-600 via-teal-500 to-emerald-400' },
  UNKNOWN: { bg: 'bg-slate-600', text: 'text-slate-400', border: 'border-slate-600/30', fill: '#64748b', gradient: 'from-slate-600 via-slate-500 to-slate-400' },
};

/**
 * Premium Glass / Neon Donut Chart Component
 * Concept #5 "Glass" style:
 * - Thick rounded circular ring with subtle depth and glass groove channel
 * - Inner/outer highlight rims and translucent dark background track
 * - Smooth neon category gradients matching FocusLens visual system
 * - Clean rounded segment caps with adaptive gap spacing
 * - Top specular glass sheen reflection arc
 * - Ambient radial bloom glow behind the donut
 * - Interactive hover inspection linking segments to center display & legend
 * - Preserved center: "TOTAL", formatted duration (e.g. 01:11)
 */
function GlassDonutChart({
  activeCategories,
  durations,
  percentages = {},
  totalDisplayedDuration,
  hoveredCategory,
  onHoverCategory,
}) {
  const radius = 70;
  const strokeWidth = 16;
  const gap = 6;
  const circumference = 2 * Math.PI * radius;
  let accumulatedFraction = 0;
  const activeCount = activeCategories.length;

  return (
    <div className="relative w-52 h-52 sm:w-60 sm:h-60 mx-auto shrink-0 flex items-center justify-center">
      {/* Ambient radial neon/glass glow behind the donut */}
      <div
        className="absolute inset-0 m-auto w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-blue-600/20 via-cyan-500/15 to-purple-600/20 blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <svg
        className="w-full h-full drop-shadow-md select-none"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Activity duration breakdown donut chart showing ${activeCount} categories with total duration ${formatSecondsToTime(totalDisplayedDuration)}`}
      >
        <defs>
          {/* Glass glow filter for hovered / active segment */}
          <filter id="glass-glow-active" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle depth shadow for segments */}
          <filter id="glass-segment-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          {/* Category Gradients matching glass/neon aesthetic */}
          <linearGradient id="grad-CODING" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="grad-STUDY_LIKE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="grad-PHONE_ACTIVITY" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="grad-MULTIPLE_PEOPLE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="grad-AWAY_OR_NOT_VISIBLE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="grad-VIDEO_ACTIVITY" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <linearGradient id="grad-BROWSER_ACTIVITY" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="grad-DOCUMENT_ACTIVITY" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="grad-SPEECH_LIKE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id="grad-UNKNOWN" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Specular glass reflection gradient */}
          <linearGradient id="glass-specular" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Glass Groove Track & Highlight Rims */}
        {/* Outer subtle rim */}
        <circle
          cx="100"
          cy="100"
          r={radius + strokeWidth / 2}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
        />
        {/* Inner subtle rim */}
        <circle
          cx="100"
          cy="100"
          r={radius - strokeWidth / 2}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
        />
        {/* Translucent glass track base */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#0f172a"
          strokeOpacity="0.75"
          strokeWidth={strokeWidth}
        />
        {/* Glass groove subtle inner glow */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeOpacity="0.06"
          strokeWidth={strokeWidth - 2}
        />

        {/* Category segment arcs (rotated so arc 0 begins at 12 o'clock) */}
        <g transform="rotate(-90 100 100)">
          {activeCategories.map((type) => {
            const durSec = durations[type] || 0;
            if (durSec <= 0 || totalDisplayedDuration <= 0) return null;
            const fraction = durSec / totalDisplayedDuration;
            const isHovered = hoveredCategory === type;
            const isDimmed = Boolean(hoveredCategory && hoveredCategory !== type);

            let dashLen;
            let strokeDashoffset;
            let strokeLinecap;

            if (activeCount === 1) {
              dashLen = circumference;
              strokeDashoffset = 0;
              strokeLinecap = 'butt';
            } else {
              const arcLen = fraction * circumference;
              const capAllowance = Math.min(strokeWidth + gap, Math.max(0, arcLen - 1));
              dashLen = Math.max(0.5, arcLen - capAllowance);
              strokeDashoffset = -(accumulatedFraction * circumference + capAllowance / 2);
              strokeLinecap = 'round';
            }
            accumulatedFraction += fraction;

            return (
              <circle
                key={type}
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={`url(#grad-${type})`}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={`${dashLen} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap={strokeLinecap}
                opacity={isDimmed ? 0.35 : 1}
                filter={isHovered ? 'url(#glass-glow-active)' : 'url(#glass-segment-shadow)'}
                onMouseEnter={() => onHoverCategory?.(type)}
                onMouseLeave={() => onHoverCategory?.(null)}
                className="transition-all duration-300 ease-out cursor-pointer"
              />
            );
          })}
        </g>

        {/* Top Specular Glass Reflection Sheen */}
        <path
          d="M 42.7 59.8 A 70 70 0 0 1 157.3 59.8"
          fill="none"
          stroke="url(#glass-specular)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.4"
          pointerEvents="none"
        />
      </svg>

      {/* Donut Center Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none transition-all duration-300">
        {hoveredCategory ? (
          <>
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider truncate max-w-[120px] drop-shadow-sm">
              {ACTIVITY_LABELS[hoveredCategory] || hoveredCategory}
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight my-0.5 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">
              {formatSecondsToTime(durations[hoveredCategory] || 0)}
            </span>
            <span className="text-[11px] font-bold text-cyan-300/90 font-mono">
              {percentages[hoveredCategory] || 0}%
            </span>
          </>
        ) : (
          <>
            <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-400 tracking-widest drop-shadow-sm">
              TOTAL
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight my-0.5 drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
              {formatSecondsToTime(totalDisplayedDuration)}
            </span>
            <span className="text-[10px] font-medium text-slate-500 font-mono">
              {activeCategories.length} {activeCategories.length === 1 ? 'activity' : 'activities'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Maintain DonutChart alias for compatibility
const DonutChart = GlassDonutChart;

/**
 * Premium Horizontal Timeline / Activity Rail Component
 * Concept #5 "Timeline" style:
 * - One large horizontal rounded timeline rail (capsule shape)
 * - Dark translucent glass background with subtle blue/cyan glow & thin luminous border
 * - Proportional segments based on real activity durations & percentages
 * - Small glowing circular transition markers at real category transition boundaries
 * - Dynamic time scale ruler calculated dynamically from monitored session duration
 * - "TOTAL MONITORED" display with large bold white duration & subtle cyan highlight
 * - Interactive hover tooltips & synchronized legend state
 */
function ActivityTimelineRail({
  activeCategories,
  durations,
  percentages,
  totalDisplayedDuration,
  hoveredCategory,
  onHoverCategory,
}) {
  // Precompute ranges for proportional segments & transition markers
  let currentAcc = 0;
  const categoryRanges = activeCategories.map((type) => {
    const durSec = durations[type] || 0;
    const pct = percentages[type] || 0;
    const start = currentAcc;
    const end = Math.min(100, currentAcc + pct);
    const mid = start + pct / 2;
    currentAcc = end;
    return { type, durSec, pct, start, end, mid };
  });

  // Calculate dynamic time ruler intervals (0%, 25%, 50%, 75%, 100%)
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    fraction,
    pct: fraction * 100,
    timeSec: Math.round(totalDisplayedDuration * fraction),
    formatted: formatSecondsToTime(Math.round(totalDisplayedDuration * fraction)),
  }));

  const hoveredRange = categoryRanges.find((r) => r.type === hoveredCategory);
  const tooltipLeft = hoveredRange ? Math.max(10, Math.min(90, hoveredRange.mid)) : 50;

  return (
    <div className="space-y-6 pt-1">
      {/* 1. Summary Information Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-widest text-slate-400">
              TOTAL MONITORED
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]">
            {formatSecondsToTime(totalDisplayedDuration)}
          </div>
        </div>

        {/* Dynamic Detail / Quick Inspector */}
        <div className="flex items-center space-x-3">
          {hoveredCategory ? (
            <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 transition-all">
              <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[hoveredCategory]?.bg || 'bg-brand-500'} shadow-[0_0_6px_currentColor]`} />
              <div className="text-xs">
                <span className="font-bold text-white mr-2">{ACTIVITY_LABELS[hoveredCategory] || hoveredCategory}</span>
                <span className="font-mono text-cyan-300 font-bold mr-1">{formatSecondsToTime(durations[hoveredCategory] || 0)}</span>
                <span className="text-slate-400 font-mono text-[11px]">({percentages[hoveredCategory] || 0}%)</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{activeCategories.length} {activeCategories.length === 1 ? 'Activity' : 'Activities'} Monitored</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Horizontal Timeline Rail Card */}
      <div className="relative p-5 sm:p-7 rounded-2xl bg-slate-950/70 border border-slate-800/90 backdrop-blur-md shadow-2xl overflow-visible">
        {/* Ambient cyan/blue/purple glow behind the rail */}
        <div
          className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-12 bg-gradient-to-r from-blue-600/15 via-cyan-500/15 to-purple-600/15 rounded-full blur-xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Hover Compact Tooltip */}
        {hoveredCategory && hoveredRange && (
          <div
            className="absolute -top-3 z-30 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/50 shadow-2xl backdrop-blur-md flex items-center space-x-2 text-xs pointer-events-none transition-all duration-200"
            style={{
              left: `${tooltipLeft}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[hoveredCategory]?.bg || 'bg-brand-500'} shadow-[0_0_8px_currentColor]`} />
            <span className="font-semibold text-white">{ACTIVITY_LABELS[hoveredCategory] || hoveredCategory}</span>
            <span className="font-mono text-cyan-300 font-bold">{formatSecondsToTime(durations[hoveredCategory] || 0)}</span>
            <span className="text-slate-400 font-mono text-[11px]">({percentages[hoveredCategory] || 0}%)</span>
          </div>
        )}

        {/* The Capsule Rail */}
        <div className="relative w-full">
          {/* Rail capsule outer frame */}
          <div
            className="relative w-full h-8 sm:h-10 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-inner flex overflow-hidden backdrop-blur-md"
            role="region"
            aria-label="Activity timeline proportional distribution rail"
          >
            {/* Top specular highlight reflection sheen */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-white/0 via-white/25 to-white/0 z-20 pointer-events-none" />

            {/* Subtle center guide line */}
            <div className="absolute top-1/2 inset-x-0 h-px bg-slate-700/50 -translate-y-1/2 z-10 pointer-events-none" />

            {/* Proportional Segments */}
            {categoryRanges.map(({ type, pct, durSec }) => {
              if (pct <= 0) return null;
              const isHovered = hoveredCategory === type;
              const isDimmed = Boolean(hoveredCategory && hoveredCategory !== type);
              const colorInfo = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
              const gradient = colorInfo.gradient || 'from-brand-600 to-cyan-500';

              return (
                <div
                  key={type}
                  onMouseEnter={() => onHoverCategory?.(type)}
                  onMouseLeave={() => onHoverCategory?.(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${ACTIVITY_LABELS[type] || type}: ${formatSecondsToTime(durSec)} (${pct}%)`}
                  className={`relative h-full bg-gradient-to-r ${gradient} transition-all duration-300 cursor-pointer border-r border-slate-950/40 last:border-r-0 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${
                    isHovered
                      ? 'brightness-125 saturate-125 z-10 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                      : isDimmed
                      ? 'opacity-35'
                      : 'opacity-90 hover:opacity-100'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Activity Transition Markers (Real Boundaries) */}
          {categoryRanges.map(({ type, start }) => {
            const isHovered = hoveredCategory === type;
            const colorInfo = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
            const markerColor = colorInfo.fill || '#38bdf8';

            return (
              <div
                key={`marker-${type}`}
                onMouseEnter={() => onHoverCategory?.(type)}
                onMouseLeave={() => onHoverCategory?.(null)}
                style={{ left: `${Math.max(1.5, Math.min(98.5, start))}%` }}
                title={`${ACTIVITY_LABELS[type] || type} transition`}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 cursor-pointer transition-all duration-200 ${
                  isHovered ? 'scale-125' : 'scale-100 hover:scale-125'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-950 flex items-center justify-center transition-all shadow-md"
                  style={{
                    backgroundColor: markerColor,
                    boxShadow: isHovered
                      ? `0 0 12px ${markerColor}, 0 0 4px #ffffff`
                      : `0 0 6px ${markerColor}`,
                  }}
                >
                  <div className="w-1 h-1 rounded-full bg-white opacity-80" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Time Scale Ruler */}
        <div className="relative w-full mt-3 sm:mt-4 pt-1">
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-mono text-slate-500 select-none">
            {timeTicks.map((tick, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  idx === 0
                    ? 'items-start'
                    : idx === timeTicks.length - 1
                    ? 'items-end'
                    : 'items-center'
                }`}
              >
                <div className="w-px h-1.5 bg-slate-700/80 mb-1" />
                <span className="text-slate-400 font-medium">{tick.formatted}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Activity Legend Below the Timeline */}
      <div className="space-y-2.5">
        <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
          Category Distribution Legend
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {activeCategories.map((type) => {
            const durSec = durations[type] || 0;
            const pct = percentages[type] || 0;
            const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
            const label = ACTIVITY_LABELS[type] || type;
            const isHovered = hoveredCategory === type;

            return (
              <div
                key={type}
                onMouseEnter={() => onHoverCategory?.(type)}
                onMouseLeave={() => onHoverCategory?.(null)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'bg-slate-800/90 border-cyan-500/50 shadow-md shadow-cyan-500/10 scale-[1.01]'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span
                    className={`w-3 h-3 rounded-full ${style.bg} shrink-0`}
                    style={{
                      boxShadow: isHovered ? `0 0 8px ${style.fill || '#38bdf8'}` : 'none',
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-200 truncate">{label}</span>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0 font-mono text-xs">
                  <span className="text-slate-300 font-bold">{formatSecondsToTime(durSec)}</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-brand-400 font-bold text-[11px]">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ActivityBreakdownChart({
  durations = {},
  percentages = {},
  totalActiveSeconds = 0,
}) {
  const [chartMode, setChartMode] = useState('comparative'); // 'comparative' (Donut) | 'stacked' (Distribution Bar) | 'table' (Accessible Summary)
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Source of truth total displayed activity duration (sum of active category durations)
  const totalDisplayedDuration = Object.values(durations).reduce((acc, d) => acc + (d || 0), 0);
  const effectiveTotalDuration = totalDisplayedDuration > 0 ? totalDisplayedDuration : Math.max(0, totalActiveSeconds);

  // Active non-zero categories
  const activeCategories = Object.keys(durations).filter(
    (key) => (durations[key] || 0) > 0
  );

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/20 transition-all duration-300 hover:shadow-cyan-400/40 shrink-0">
            <svg
              className="w-5 h-5 sm:w-5.5 sm:h-5.5 drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Segment 1: Primary active (crisp white) */}
              <path
                d="M 13.94 4.76 A 7.5 7.5 0 0 1 19.24 10.06"
                stroke="white"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              {/* Segment 2: Glowing cyan-white */}
              <path
                d="M 19.24 13.94 A 7.5 7.5 0 0 1 13.94 19.24"
                stroke="#A5F3FC"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              {/* Segment 3: Soft teal-white */}
              <path
                d="M 10.06 19.24 A 7.5 7.5 0 0 1 4.76 13.94"
                stroke="white"
                strokeOpacity="0.75"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              {/* Segment 4: Subtle lavender/purple tint */}
              <path
                d="M 4.76 10.06 A 7.5 7.5 0 0 1 10.06 4.76"
                stroke="#DDD6FE"
                strokeOpacity="0.85"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Activity Duration Breakdown</h3>
            <p className="text-xs text-slate-400">Distribution of session monitored time across activity categories</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto justify-center">
          <button
            type="button"
            onClick={() => setChartMode('comparative')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              chartMode === 'comparative'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Donut Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode('stacked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              chartMode === 'stacked'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Distribution</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              chartMode === 'table'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Accessible Summary</span>
          </button>
        </div>
      </div>

      {/* Safe Empty State */}
      {effectiveTotalDuration <= 0 || activeCategories.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">No Monitored Activity Recorded</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Not enough non-overlapping activity segments recorded to display duration breakdown.
          </p>
        </div>
      ) : (
        <>
          {/* Mode 1: Glass Donut Chart (Concept #5) + Legend */}
          {chartMode === 'comparative' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              {/* Left Column: Responsive SVG Glass Donut Chart */}
              <div className="md:col-span-5 flex justify-center min-w-0">
                <GlassDonutChart
                  activeCategories={activeCategories}
                  durations={durations}
                  percentages={percentages}
                  totalDisplayedDuration={effectiveTotalDuration}
                  hoveredCategory={hoveredCategory}
                  onHoverCategory={setHoveredCategory}
                />
              </div>

              {/* Right Column: Category Legend & Durations */}
              <div className="md:col-span-7 space-y-2.5 min-w-0">
                {activeCategories.map((type) => {
                  const durSec = durations[type] || 0;
                  const pct = percentages[type] || 0;
                  const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
                  const label = ACTIVITY_LABELS[type] || type;
                  const isHovered = hoveredCategory === type;

                  return (
                    <div
                      key={type}
                      onMouseEnter={() => setHoveredCategory(type)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isHovered
                          ? 'bg-slate-800/90 border-cyan-500/50 shadow-md shadow-cyan-500/10 scale-[1.01]'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <span className={`w-3.5 h-3.5 rounded-full ${style.bg} shrink-0`} />
                        <span className="text-xs font-semibold text-slate-200 truncate">{label}</span>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 font-mono text-xs">
                        <span className="text-slate-300 font-bold">{formatSecondsToTime(durSec)}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-brand-400 font-bold text-[11px]">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 2: Premium Horizontal Timeline Rail (Concept #5) */}
          {chartMode === 'stacked' && (
            <ActivityTimelineRail
              activeCategories={activeCategories}
              durations={durations}
              percentages={percentages}
              totalDisplayedDuration={effectiveTotalDuration}
              hoveredCategory={hoveredCategory}
              onHoverCategory={setHoveredCategory}
            />
          )}

          {/* Mode 3: Accessible Summary Table */}
          {chartMode === 'table' && (
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-left text-xs border-collapse" aria-label="Activity duration breakdown summary table">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Activity Category</th>
                    <th className="py-2.5 px-3 text-right">Duration (Sec)</th>
                    <th className="py-2.5 px-3 text-right">Duration (Formatted)</th>
                    <th className="py-2.5 px-3 text-right">Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {activeCategories.map((type) => {
                    const durSec = durations[type] || 0;
                    const pct = percentages[type] || 0;
                    const label = ACTIVITY_LABELS[type] || type;
                    const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;

                    return (
                      <tr key={type} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-white flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${style.bg}`} />
                          <span>{label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">{durSec} s</td>
                        <td className="py-2.5 px-3 text-right font-mono text-white font-bold">{formatSecondsToTime(durSec)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-brand-400 font-bold">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Footer Text */}
          <div className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span>
              Total monitored duration across activities: <strong className="text-slate-200 font-mono">{formatSecondsToTime(effectiveTotalDuration)}</strong> ({Math.round(effectiveTotalDuration / 60)} min).
            </span>
            <span className="text-[10px] font-mono text-brand-400 font-semibold">
              Sum: {activeCategories.reduce((acc, c) => acc + (percentages[c] || 0), 0)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
