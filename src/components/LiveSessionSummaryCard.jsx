import React, { useMemo } from 'react';
import { Clock, Activity } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { calculateActivityDurations } from '../utils/sessionAnalytics.js';
import { formatSecondsToTime } from '../utils/formatters.js';

export function LiveSessionSummaryCard({
  activitySegments = [],
  currentActivityLabel = 'Unknown',
  isCameraActive = false,
}) {
  // Compute accumulated activity durations in seconds
  const durations = useMemo(() => {
    return calculateActivityDurations(activitySegments);
  }, [activitySegments]);

  const activeCategories = Object.keys(durations).filter(
    (key) => (durations[key] || 0) > 0
  );

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">SESSION SO FAR</h3>
            <p className="text-[10px] text-slate-500">Live Activity Summary</p>
          </div>
        </div>

        <span className="flex items-center space-x-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-brand-300 border border-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
          <span>LIVE</span>
        </span>
      </div>

      {/* Active Category Durations List */}
      <div className="space-y-1.5 flex-1 my-1">
        {activeCategories.length > 0 ? (
          activeCategories.slice(0, 4).map((type) => {
            const sec = durations[type] || 0;
            const label = ACTIVITY_LABELS[type] || type;

            return (
              <div key={type} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                <span className="text-slate-400 font-medium truncate mr-2">{label}</span>
                <span className="font-mono font-bold text-white text-xs">{formatSecondsToTime(sec)}</span>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-slate-500 italic p-3 text-center">
            {isCameraActive ? 'Gathering initial activity signals...' : 'Camera inactive.'}
          </div>
        )}
      </div>

      {/* Current Activity Banner */}
      <div className="pt-2 border-t border-slate-800/80 mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">Current activity:</span>
        <span className="font-extrabold text-brand-300 bg-brand-950/60 px-2.5 py-0.5 rounded-md border border-brand-900/60">
          {currentActivityLabel}
        </span>
      </div>
    </div>
  );
}
