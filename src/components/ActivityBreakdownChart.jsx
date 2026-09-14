import React, { useState } from 'react';
import { BarChart2, List, PieChart } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';

export const CATEGORY_COLORS = {
  CODING: { bg: 'bg-brand-500', text: 'text-brand-400', border: 'border-brand-500/30', fill: '#6366f1' },
  STUDY_LIKE: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', fill: '#10b981' },
  PHONE_ACTIVITY: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', fill: '#f59e0b' },
  MULTIPLE_PEOPLE: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', fill: '#6366f1' },
  AWAY_OR_NOT_VISIBLE: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30', fill: '#f43f5e' },
  VIDEO_ACTIVITY: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30', fill: '#a855f7' },
  BROWSER_ACTIVITY: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30', fill: '#06b6d4' },
  DOCUMENT_ACTIVITY: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30', fill: '#3b82f6' },
  UNKNOWN: { bg: 'bg-slate-600', text: 'text-slate-400', border: 'border-slate-600/30', fill: '#475569' },
};

export function ActivityBreakdownChart({
  durations = {},
  percentages = {},
  totalActiveSeconds = 1,
}) {
  const [chartMode, setChartMode] = useState('comparative'); // 'comparative' | 'stacked' | 'table'

  const activeCategories = Object.keys(durations).filter(
    (key) => (durations[key] || 0) > 0
  );

  const maxDurationSec = Math.max(...Object.values(durations), 1);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Activity Duration Breakdown</h3>
            <p className="text-xs text-slate-400">Distribution of session time across categories</p>
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
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Bar Chart</span>
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
            <PieChart className="w-3.5 h-3.5" />
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

      {/* Mode 1: Comparative Horizontal Bars View */}
      {chartMode === 'comparative' && (
        <div className="space-y-3 pt-2">
          {activeCategories.length > 0 ? (
            activeCategories.map((type) => {
              const durSec = durations[type] || 0;
              const pct = percentages[type] || 0;
              const barWidthPct = Math.max(4, Math.round((durSec / maxDurationSec) * 100));
              const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
              const label = ACTIVITY_LABELS[type] || type;

              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.bg}`} />
                      <span>{label}</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      <strong className="text-white font-bold">{formatMinutesText(Math.round(durSec / 60))}</strong> ({pct}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-lg h-4 overflow-hidden border border-slate-800/80 p-0.5 relative flex items-center">
                    <div
                      className={`h-full rounded transition-all duration-700 ease-out ${style.bg}`}
                      style={{ width: `${barWidthPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center">No activity durations recorded.</p>
          )}
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

          {/* Color Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs pt-2">
            {activeCategories.map((type) => {
              const durSec = durations[type] || 0;
              const pct = percentages[type] || 0;
              const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;
              const label = ACTIVITY_LABELS[type] || type;

              return (
                <div key={type} className="flex items-center space-x-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className={`w-3 h-3 rounded ${style.bg} flex-shrink-0`} />
                  <div className="truncate">
                    <div className="text-slate-400 text-[10px] truncate">{label}</div>
                    <div className="font-bold text-white font-mono">{formatMinutesText(Math.round(durSec / 60))} ({pct}%)</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 3: Accessible Table Summary */}
      {chartMode === 'table' && (
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs border-collapse">
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
      <div className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-800/80">
        Total session active monitoring duration: <strong>{formatSecondsToTime(totalActiveSeconds)}</strong> ({Math.round(totalActiveSeconds / 60)} minutes).
      </div>
    </div>
  );
}
