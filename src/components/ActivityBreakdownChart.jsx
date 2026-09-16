import React, { useState } from 'react';
import { BarChart2, List, PieChart, Info, Clock } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';

export const CATEGORY_COLORS = {
  CODING: { bg: 'bg-brand-500', text: 'text-brand-400', border: 'border-brand-500/30', fill: '#6366f1' },
  STUDY_LIKE: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', fill: '#10b981' },
  PHONE_ACTIVITY: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', fill: '#f59e0b' },
  MULTIPLE_PEOPLE: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', fill: '#818cf8' },
  AWAY_OR_NOT_VISIBLE: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30', fill: '#f43f5e' },
  VIDEO_ACTIVITY: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', fill: '#a855f7' },
  BROWSER_ACTIVITY: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30', fill: '#06b6d4' },
  DOCUMENT_ACTIVITY: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', fill: '#3b82f6' },
  SPEECH_LIKE: { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500/30', fill: '#14b8a6' },
  UNKNOWN: { bg: 'bg-slate-600', text: 'text-slate-400', border: 'border-slate-600/30', fill: '#64748b' },
};

/**
 * Responsive SVG Donut Chart component
 */
function DonutChart({ activeCategories, durations, totalDisplayedDuration }) {
  const radius = 38;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * radius;
  let accumulatedFraction = 0;

  return (
    <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto shrink-0 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background track circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />

        {/* Category segment arcs */}
        {activeCategories.map((type) => {
          const durSec = durations[type] || 0;
          if (durSec <= 0 || totalDisplayedDuration <= 0) return null;
          const fraction = durSec / totalDisplayedDuration;
          const strokeDasharray = `${fraction * circumference} ${circumference}`;
          const strokeDashoffset = -accumulatedFraction * circumference;
          accumulatedFraction += fraction;
          const color = CATEGORY_COLORS[type]?.fill || '#64748b';

          return (
            <circle
              key={type}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          );
        })}
      </svg>

      {/* Donut Center Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
        <span className="text-base sm:text-lg font-black text-white font-mono">
          {formatSecondsToTime(totalDisplayedDuration)}
        </span>
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
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <PieChart className="w-5 h-5" />
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
          {/* Mode 1: Polished Donut Chart + Beside Legend */}
          {chartMode === 'comparative' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              {/* Left Column: Responsive SVG Donut Chart */}
              <div className="md:col-span-5 flex justify-center">
                <DonutChart
                  activeCategories={activeCategories}
                  durations={durations}
                  totalDisplayedDuration={effectiveTotalDuration}
                />
              </div>

              {/* Right Column: Category Legend & Durations */}
              <div className="md:col-span-7 space-y-2.5">
                {activeCategories.map((type) => {
                  const durSec = durations[type] || 0;
                  const pct = percentages[type] || 0;
                  const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
                  const label = ACTIVITY_LABELS[type] || type;

                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
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

          {/* Mode 2: Stacked Distribution Bar View */}
          {chartMode === 'stacked' && (
            <div className="space-y-4 pt-2">
              <div className="w-full bg-slate-900 rounded-xl h-8 overflow-hidden flex border border-slate-800 p-0.5">
                {activeCategories.map((type) => {
                  const pct = percentages[type] || 0;
                  if (pct <= 0) return null;
                  const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
                  const label = ACTIVITY_LABELS[type] || type;

                  return (
                    <div
                      key={type}
                      className={`h-full ${style.bg} transition-all relative group cursor-pointer`}
                      style={{ width: `${pct}%` }}
                      title={`${label}: ${pct}% (${formatSecondsToTime(durations[type] || 0)})`}
                    />
                  );
                })}
              </div>

              {/* Color Legend Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs pt-2">
                {activeCategories.map((type) => {
                  const durSec = durations[type] || 0;
                  const pct = percentages[type] || 0;
                  const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
                  const label = ACTIVITY_LABELS[type] || type;

                  return (
                    <div key={type} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center space-x-2 truncate">
                        <span className={`w-3 h-3 rounded-full ${style.bg} shrink-0`} />
                        <span className="text-slate-300 text-xs font-medium truncate">{label}</span>
                      </div>
                      <span className="font-bold text-white font-mono text-xs shrink-0 ml-2">
                        {formatSecondsToTime(durSec)} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
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
