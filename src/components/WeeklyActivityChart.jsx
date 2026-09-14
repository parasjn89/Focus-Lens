import React from 'react';
import { Calendar, Clock } from 'lucide-react';

export function WeeklyActivityChart({ weeklyData = [] }) {
  const maxSeconds = Math.max(...weeklyData.map(d => d.activeSeconds || 0), 3600);

  const formatHours = (seconds) => {
    if (!seconds) return '0h';
    const hrs = (seconds / 3600).toFixed(1);
    return `${hrs}h`;
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">7-Day Focus Activity</h3>
            <p className="text-xs text-slate-400">Daily active focus time over the last week</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-500"></span>
            <span className="text-slate-300">Study/Coding</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-950 border border-indigo-700"></span>
            <span className="text-slate-400">Other Active</span>
          </div>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-800">
        {weeklyData.map((day, idx) => {
          const totalSec = day.activeSeconds || 0;
          const studySec = day.studyLikeSeconds || 0;
          const otherSec = Math.max(0, totalSec - studySec);

          const totalHeightPct = Math.min(100, Math.round((totalSec / maxSeconds) * 100));
          const studyHeightPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0;
          const otherHeightPct = 100 - studyHeightPct;

          return (
            <div key={day.dateStr || idx} className="flex-1 flex flex-col items-center group h-full justify-end">
              {/* Tooltip on Hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-2 px-2 py-1 rounded bg-slate-800 text-[10px] text-white border border-slate-700 whitespace-nowrap pointer-events-none z-10 shadow-lg">
                {day.dayName}: {formatHours(totalSec)} ({day.sessionCount} sessions)
              </div>

              {/* Bar Column */}
              <div
                style={{ height: `${Math.max(6, totalHeightPct)}%` }}
                className="w-full max-w-[36px] rounded-t-lg bg-slate-800 overflow-hidden flex flex-col justify-end transition-all group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-brand-500/20"
              >
                {otherSec > 0 && (
                  <div
                    style={{ height: `${otherHeightPct}%` }}
                    className="w-full bg-slate-700/80"
                  />
                )}
                {studySec > 0 && (
                  <div
                    style={{ height: `${studyHeightPct}%` }}
                    className="w-full bg-gradient-to-t from-brand-600 to-indigo-500"
                  />
                )}
              </div>

              {/* Day Label */}
              <span className="text-xs font-semibold text-slate-400 group-hover:text-white mt-3 transition-colors">
                {day.dayName}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
        <span>0 hours</span>
        <span>Peak: {formatHours(maxSeconds)}</span>
      </div>
    </div>
  );
}
