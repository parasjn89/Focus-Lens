import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Calendar as CalendarIcon, CheckCircle2, RefreshCw, AlertCircle, ArrowRight, Award, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { BackButton } from '../components/BackButton.jsx';

export function ConsistencyPage({ onNewSession, onNavigate }) {
  const [consistencyData, setConsistencyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConsistency = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass client timezone offset in header to prevent midnight boundary bugs
      const offsetMinutes = new Date().getTimezoneOffset();
      const res = await apiFetch('/api/analytics/consistency', {
        headers: { 'x-timezone-offset': String(offsetMinutes) },
      });
      setConsistencyData(res);
    } catch (err) {
      console.error('Failed to fetch consistency data:', err);
      if (err.status === 401 || err.isAuthError) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Could not load consistency analytics. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsistency();
  }, []);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
        <p className="text-sm font-medium">Calculating your focus consistency & streaks...</p>
      </div>
    );
  }

  const {
    currentStreak = 0,
    bestStreak = 0,
    previousStreak = 0,
    todayFocused = false,
    thisWeek = {},
    thisMonth = {},
    milestones = {},
    calendar = [],
  } = consistencyData || {};

  const isEmptyHistory = bestStreak === 0 && calendar.every(c => !c.focused);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Top Contextual Navigation */}
      <div className="flex items-center justify-between">
        <BackButton
          label="Back to Dashboard"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/20">
              <Flame className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Focus Consistency</h1>
          </div>
          <p className="text-sm text-slate-400">
            Build a sustainable focus habit one day at a time.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchConsistency}
            className="flex items-center space-x-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>

          <button
            onClick={onNewSession}
            className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
          >
            Start Focus Session
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State for New Users */}
      {isEmptyHistory ? (
        <div className="mt-10 p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Flame className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Start Your Focus Streak</h2>
          <p className="text-sm text-slate-400 mt-2 mb-6 leading-relaxed">
            Complete your first focus session to start building your streak and track daily consistency.
          </p>
          <button
            onClick={onNewSession}
            className="inline-flex items-center space-x-2 text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-brand-600/25 transition-all hover:scale-105"
          >
            <span>Start Your First Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Milestone Badge Banner */}
          {milestones?.label && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 flex items-center space-x-3">
              <Award className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-300">{milestones.label}</span>
            </div>
          )}

          {/* Ended Streak Neutral Notice */}
          {currentStreak === 0 && previousStreak > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-white">Your previous streak was {previousStreak} {previousStreak === 1 ? 'day' : 'days'}.</span>
              {' '}Start a new focus streak today.
            </div>
          )}

          {/* Primary Hero Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Current Streak */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-amber-500/30 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Current Streak</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                🔥 {currentStreak} <span className="text-sm font-normal text-slate-400">{currentStreak === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Consecutive focus days</div>
            </div>

            {/* Best Streak */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Best Streak</span>
                <Trophy className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="text-3xl font-black text-white font-mono">
                🏆 {bestStreak} <span className="text-sm font-normal text-slate-400">{bestStreak === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">All-time longest streak</div>
            </div>

            {/* This Week */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">This Week</span>
                <CalendarIcon className="w-4 h-4 text-brand-400" />
              </div>
              <div className="text-3xl font-black text-brand-300 font-mono">
                {thisWeek.focusDays || 0} / {thisWeek.eligibleDays || 7}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {thisWeek.percentage || 0}% consistency (Mon–Sun)
              </div>
            </div>

            {/* This Month */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">This Month</span>
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-black text-indigo-300 font-mono">
                {thisMonth.focusDays || 0} / {thisMonth.eligibleDays || 30}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {thisMonth.percentage || 0}% consistency so far
              </div>
            </div>

            {/* Today State */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Today</span>
                <CheckCircle2 className={`w-4 h-4 ${todayFocused ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>
              <div className="text-sm font-bold mt-1">
                {todayFocused ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <span>✓ Focus Day Complete</span>
                  </span>
                ) : (
                  <span className="text-slate-400">No focus session yet</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {todayFocused ? 'Streak is active for today' : 'Complete 1 session to extend streak'}
              </div>
            </div>
          </div>

          {/* Focus Calendar Heatmap */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Focus Calendar</h3>
                <p className="text-xs text-slate-400">Daily focus status across the current calendar month</p>
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 border border-emerald-400"></span>
                  <span className="text-slate-400">Focus Day</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-md bg-slate-800 border border-slate-700"></span>
                  <span className="text-slate-400">No Focus</span>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 pt-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs font-semibold text-slate-500 py-1">
                  {day}
                </div>
              ))}

              {calendar.map((c) => {
                const focusMins = Math.round(c.qualifyingFocusSeconds / 60);
                const isFocused = c.focused;
                const isFuture = c.isFuture;

                let cellBg = 'bg-slate-800/60 border-slate-700/60 text-slate-400';
                if (isFuture) {
                  cellBg = 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40';
                } else if (isFocused) {
                  cellBg = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold';
                }

                const ariaLabel = `${c.date}, ${isFocused ? `focus day, ${c.sessionCount} sessions, ${focusMins} minutes focused` : 'no focus session'}`;

                return (
                  <div
                    key={c.date}
                    tabIndex={0}
                    aria-label={ariaLabel}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-between min-h-[64px] transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-500 ${cellBg}`}
                  >
                    <span className="text-xs font-mono">{c.dayNumber}</span>
                    {isFocused && (
                      <div className="flex items-center space-x-0.5 text-[10px] text-emerald-400 mt-1">
                        <span>✓</span>
                        <span>{focusMins}m</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Neutral Principle Notice */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-start space-x-3 text-xs text-slate-400">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Consistency Philosophy:</span>
              {' '}Streaks measure habit building across calendar days, not high-pressure gaming. Completing a single qualifying focus session on any date preserves your streak.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
