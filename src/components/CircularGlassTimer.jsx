import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { formatSecondsToTime } from '../utils/formatters';
import { formatPauseTime } from '../utils/sessionTimer';

/**
 * Premium Glassmorphic Circular Productivity Timer
 *
 * Distinctive features:
 * - Translucent dark glass surface with backdrop blur
 * - Semi-transparent white/10 border with soft inner highlight reflection
 * - Elegant cyan-to-teal SVG progress ring with subtle glow
 * - Ultra-clear readable monospace timer typography
 * - Dynamic timer reading with "Focus Session" title and status pill
 * - Responsive sizing and motion reduction support
 */
export function CircularGlassTimer({
  remainingSeconds,
  totalSeconds = 25 * 60,
  progressPercent = 0,
  isPaused = false,
  pauseRemainingSecs = null,
  activity = 'Focus Session',
  onPause,
  onResume,
  onEndSession,
}) {
  const isCompleted = remainingSeconds <= 0;

  // SVG circular geometry
  const size = 320;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth * 2 - 32) / 2; // ~135px radius with comfortable padding
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progressPercent)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* =========================================
          CIRCULAR GLASS TIMER DISC
      ========================================= */}
      <div className="relative group select-none">
        {/* Ambient background glow behind glass */}
        <div 
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/10 via-teal-500/5 to-transparent blur-2xl pointer-events-none transform scale-95 transition-opacity duration-700"
          style={{ opacity: isPaused ? 0.3 : 0.8 }}
        />

        {/* Circular Glass Body */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-88 md:h-88 lg:w-96 lg:h-96 rounded-full bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/85 backdrop-blur-2xl border border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),inset_0_-3px_8px_rgba(0,0,0,0.7),0_25px_60px_rgba(0,0,0,0.6)] flex items-center justify-center p-3 sm:p-4 transition-all duration-500">
          
          {/* Subtle Top Specular Glass Reflection Arc */}
          <div className="absolute top-3 sm:top-4 left-[20%] right-[20%] h-8 sm:h-12 bg-gradient-to-b from-white/15 via-white/5 to-transparent rounded-[100%] blur-[1.5px] pointer-events-none" />

          {/* SVG Progress Ring */}
          <svg 
            className="absolute inset-0 w-full h-full -rotate-90 transform p-4 sm:p-5"
            viewBox={`0 0 ${size} ${size}`}
          >
            <defs>
              <linearGradient id="glassTimerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" />   {/* cyan-400 */}
                <stop offset="100%" stopColor="#14b8a6" />  {/* teal-500 */}
              </linearGradient>
              <filter id="glassTimerGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Background Track Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className="stroke-slate-800/40"
              strokeWidth={strokeWidth}
              fill="none"
            />

            {/* Active Progress Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#glassTimerGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              fill="none"
              filter="url(#glassTimerGlow)"
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>

          {/* Center Display: Digits + Focus Session Label + Status */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
            {/* Target Activity Tag */}
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400/90 mb-1 flex items-center space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-cyan-400 animate-pulse'}`} />
              <span>{activity || 'Deep Work'}</span>
            </span>

            {/* Primary Dynamic Countdown Timer Digits */}
            <div className="font-mono text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] my-0.5 sm:my-1">
              {formatSecondsToTime(remainingSeconds)}
            </div>

            {/* "Focus Session" Underneath */}
            <span className="text-xs sm:text-sm font-medium tracking-wide text-slate-300/90 mt-0.5">
              Focus Session
            </span>

            {/* Dynamic Status Pill */}
            <div className="mt-2.5">
              {isPaused ? (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>
                    {pauseRemainingSecs !== null
                      ? `Paused • ${formatPauseTime(pauseRemainingSecs)} left`
                      : 'Paused'}
                  </span>
                </span>
              ) : isCompleted ? (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Complete</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>In Progress</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          TIMER CONTROLS
      ========================================= */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 w-full max-w-xs sm:max-w-sm">
        {/* Pause / Resume Button */}
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          className={`flex-1 py-2.5 sm:py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 text-xs sm:text-sm font-semibold transition-all shadow-lg backdrop-blur-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
            isPaused
              ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-200 shadow-cyan-900/30'
              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-cyan-500/40 text-slate-200 hover:text-white shadow-black/40'
          }`}
          title={isPaused ? 'Resume focus countdown' : 'Pause focus countdown (5-minute maximum limit)'}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 fill-current text-cyan-400" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-current text-slate-300" />
              <span>Pause</span>
            </>
          )}
        </button>

        {/* Stop / End Session Button */}
        <button
          type="button"
          onClick={onEndSession}
          className="flex-1 py-2.5 sm:py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-rose-950/20 backdrop-blur-md flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          title="End session now and view summary report"
        >
          <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
          <span>End Session</span>
        </button>
      </div>
    </div>
  );
}
