import React, { useState } from 'react';
import { Activity, Clock, Layers } from 'lucide-react';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer';
import { formatSecondsToTime } from '../utils/formatters';

export function EventTimelinePlaceholder({ activity, events = [], activitySegments = [], sessionStartTime = null }) {
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' | 'logs'

  const baseStartTime = sessionStartTime || (activitySegments.length > 0 ? activitySegments[0].startTime : Date.now());

  const formatRelTime = (ts) => {
    if (!ts) return '--:--';
    const elapsedSec = Math.max(0, Math.floor((ts - baseStartTime) / 1000));
    return formatSecondsToTime(elapsedSec);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Live Timeline</h3>
            <p className="text-xs text-slate-400">High-level inferred activities</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'activities' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activities
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'logs' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Signal Logs
          </button>
        </div>
      </div>

      {activeTab === 'activities' ? (
        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-64 pr-1 text-xs">
          {activitySegments && activitySegments.length > 0 ? (
            activitySegments.map((seg, idx) => {
              const startStr = formatRelTime(seg.startTime);
              const isCurrent = idx === activitySegments.length - 1;
              const endStr = isCurrent ? '─────' : formatRelTime(seg.endTime);
              const label = ACTIVITY_LABELS[seg.type] || seg.type;

              return (
                <div key={seg.id || idx} className="bg-slate-900/70 p-3 rounded-xl border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20' : 'bg-brand-400'}`} />
                      <span className="font-bold text-white text-sm">{label}</span>
                    </div>
                    {seg.evidenceScore !== null && seg.evidenceScore !== undefined && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {(seg.evidenceScore * 100).toFixed(0)}% evidence
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                    <span>{startStr}</span>
                    <span className="text-slate-600">─────────</span>
                    <span>{endStr}</span>
                  </div>

                  {seg.explanation && seg.explanation.length > 0 && (
                    <div className="text-[10px] text-slate-400 pt-1 space-y-0.5 border-t border-slate-800/50">
                      {seg.explanation.slice(0, 2).map((exp, eIdx) => (
                        <div key={eIdx} className="truncate text-slate-400">• {exp}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500 italic text-xs">
              Waiting for activity signals...
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto max-h-64 pr-1 text-xs">
          {events.length > 0 ? (
            events.slice(-50).map((evt, idx) => (
              <div key={idx} className="flex items-start space-x-3 group">
                <div className="flex flex-col items-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/10 group-hover:scale-125 transition-transform" />
                  {idx !== events.length - 1 && (
                    <div className="w-0.5 h-8 bg-slate-800 my-1" />
                  )}
                </div>
                <div className="flex-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200">{evt.label}</span>
                    <span className="font-mono text-[10px] text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-slate-500" />
                      {evt.time}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{evt.description}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500 italic text-xs">
              No observational logs recorded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

