import React from 'react';
import { Clock, Info, ChevronRight } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime } from '../utils/formatters.js';
import { CATEGORY_COLORS } from './ActivityBreakdownChart.jsx';

export function ActivityTimeline({
  segments = [],
  sessionStartMs = Date.now(),
  onSelectSegment = null,
}) {
  if (!segments || segments.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-2">
        <Clock className="w-8 h-8 text-slate-600 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-300">No Activity Segments</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Not enough monitoring data to generate an activity timeline.
        </p>
      </div>
    );
  }

  // Base session start timestamp for relative calculation
  const initialTimeMs = segments[0]?.startTime || sessionStartMs;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-brand-400" />
          <h3 className="text-base font-bold text-white">Activity Timeline</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {segments.length} segment{segments.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* Timeline List */}
      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800 text-xs">
        {segments.map((seg, idx) => {
          const relativeStartSec = Math.max(0, Math.round(((seg.startTime || initialTimeMs) - initialTimeMs) / 1000));
          const relativeEndSec = Math.max(0, Math.round(((seg.endTime || seg.startTime || initialTimeMs) - initialTimeMs) / 1000));
          const durationSec = Math.max(0, Math.round((seg.durationMs || (seg.endTime - seg.startTime)) / 1000));
          
          const label = seg.label || ACTIVITY_LABELS[seg.type] || seg.type;
          const style = CATEGORY_COLORS[seg.type] || CATEGORY_COLORS.UNKNOWN;

          return (
            <div
              key={seg.id || `seg_${idx}`}
              onClick={() => onSelectSegment && onSelectSegment(seg, { relativeStartSec, relativeEndSec })}
              className="relative pl-7 group cursor-pointer transition-all"
            >
              {/* Node Bullet */}
              <div className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 border-slate-950 ${style.bg} group-hover:scale-125 transition-transform`} />

              {/* Segment Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div>
                    {/* Relative Time Range */}
                    <div className="font-mono text-[11px] text-slate-400 font-semibold mb-0.5 flex items-center space-x-2">
                      <span className="text-brand-300">
                        {formatSecondsToTime(relativeStartSec)} → {formatSecondsToTime(relativeEndSec)}
                      </span>
                    </div>

                    {/* Activity Title & Badge */}
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">{label}</span>
                      {seg.evidenceScore !== null && seg.evidenceScore !== undefined && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Score: {Math.round(seg.evidenceScore * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Explanation bullet points if available */}
                    {seg.explanation && seg.explanation.length > 0 && (
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        • {seg.explanation[0]} {seg.explanation.length > 1 ? `(+${seg.explanation.length - 1} more)` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration & Details Trigger Button */}
                <div className="flex items-center justify-between sm:justify-end space-x-3 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                  <span className="font-mono font-bold text-slate-200 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                    {formatSecondsToTime(durationSec)}
                  </span>
                  <span className="text-slate-400 group-hover:text-brand-400 transition-colors flex items-center text-[11px] font-medium">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
