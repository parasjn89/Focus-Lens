import React from 'react';
import { Calendar } from 'lucide-react';

export function WeeklyActivityChart({ weeklyData = [] }) {
  const maxSeconds = Math.max(...weeklyData.map(d => d.activeSeconds || 0), 3600);

  const formatHours = (seconds) => {
    if (!seconds || seconds <= 0) return '0h';
    const hrs = (seconds / 3600).toFixed(1);
    return `${hrs.endsWith('.0') ? hrs.slice(0, -2) : hrs}h`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl w-full min-w-0">
      {/* 1. Header: Icon + Title + Subtitle */}
      <div className="flex items-start sm:items-center space-x-3 mb-4 min-w-0">
        <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold text-white whitespace-normal break-normal leading-snug">
            7-Day Focus Activity
          </h3>
          <p className="text-xs text-slate-400 truncate">
            Daily active focus time
          </p>
        </div>
      </div>

      {/* 2. Bar Chart Container */}
      <div className="w-full min-w-0" role="region" aria-label="7-Day Focus Activity Chart">
        {weeklyData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-500">
            No focus activity recorded this week
          </div>
        ) : (
          <div className="h-44 sm:h-48 flex items-end justify-between gap-1.5 sm:gap-2.5 pt-4 pb-2 border-b border-slate-800/80 w-full min-w-0">
            {weeklyData.map((day, idx) => {
              const totalSec = day.activeSeconds || 0;
              const studySec = day.studyLikeSeconds || 0;
              const otherSec = Math.max(0, totalSec - studySec);

              const totalHeightPct = Math.min(100, Math.round((totalSec / maxSeconds) * 100));
              const studyHeightPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0;
              const otherHeightPct = 100 - studyHeightPct;

              const isFirst = idx === 0;
              const isLast = idx === weeklyData.length - 1;
              const tooltipAlign = isFirst ? 'left-0' : isLast ? 'right-0' : 'left-1/2 -translate-x-1/2';

              return (
                <div
                  key={day.dateStr || idx}
                  className="flex-1 flex flex-col items-center group h-full justify-end min-w-0 relative"
                >
                  {/* Tooltip on Hover */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity mb-2 px-2 py-1 rounded bg-slate-800 text-[10px] text-white border border-slate-700 whitespace-nowrap pointer-events-none z-20 shadow-lg absolute bottom-full ${tooltipAlign}`}
                  >
                    {day.dayName}: {formatHours(totalSec)} ({day.sessionCount || 0} sessions)
                  </div>

                  {/* Bar Column */}
                  <div
                    style={{ height: `${Math.max(6, totalHeightPct)}%` }}
                    className="w-full max-w-[28px] sm:max-w-[34px] rounded-t-md sm:rounded-t-lg bg-slate-800/80 overflow-hidden flex flex-col justify-end transition-all group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-brand-500/20"
                  >
                    {otherSec > 0 && (
                      <div
                        style={{ height: `${otherHeightPct}%` }}
                        className="w-full bg-slate-700/80"
                        title={`Other Activity: ${formatHours(otherSec)}`}
                      />
                    )}
                    {studySec > 0 && (
                      <div
                        style={{ height: `${studyHeightPct}%` }}
                        className="w-full bg-gradient-to-t from-brand-600 to-indigo-500"
                        title={`Study/Coding: ${formatHours(studySec)}`}
                      />
                    )}
                  </div>

                  {/* Day Label */}
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-400 group-hover:text-white mt-2 sm:mt-3 transition-colors text-center w-full truncate">
                    {day.dayName}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Range Labels */}
        <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-500 font-mono">
          <span>0h</span>
          <span>Peak: {formatHours(maxSeconds)}</span>
        </div>
      </div>

      {/* 3. Legend Section (Responsive wrap, no clipping) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
        <div className="flex items-center space-x-1.5 shrink-0">
          <span
            className="w-3 h-3 rounded-sm bg-gradient-to-t from-brand-600 to-indigo-500 shadow-sm shrink-0"
            aria-hidden="true"
          />
          <span className="text-slate-300 font-medium">Study/Coding</span>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <span
            className="w-3 h-3 rounded-sm bg-slate-700/80 border border-slate-600/60 shadow-sm shrink-0"
            aria-hidden="true"
          />
          <span className="text-slate-400 font-medium">Other Activity</span>
        </div>
      </div>
    </div>
  );
}
