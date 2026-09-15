import React, { useState, useEffect } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Award, Clock, Target, Flame, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Compass, HelpCircle, HardDrive } from 'lucide-react';
import { apiFetch } from '../api/client';

export function WeeklyReviewPage({ onNewSession, onNavigate }) {
  const [reviewData, setReviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Week navigation state
  const [selectedWeekDate, setSelectedWeekDate] = useState(null); // null means current week

  // Reflection notes form state
  const [workedWell, setWorkedWell] = useState('');
  const [madeItHard, setMadeItHard] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  const fetchWeeklyReview = async (weekDate = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = weekDate ? `/api/weekly-review?week=${weekDate}` : '/api/weekly-review';
      const res = await apiFetch(url, {
        headers: {
          'X-Timezone-Offset': new Date().getTimezoneOffset().toString(),
        },
      });
      setReviewData(res);
      setWorkedWell(res.notes?.workedWell || '');
      setMadeItHard(res.notes?.madeItHard || '');
    } catch (err) {
      console.error('Failed to fetch Weekly Review:', err);
      setError('Could not load weekly review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyReview(selectedWeekDate);
  }, [selectedWeekDate]);

  const handleSaveNotes = async (e) => {
    e.preventDefault();
    if (!reviewData?.weekStartDate) return;

    setIsSavingNotes(true);
    setSaveSuccessMsg(null);
    try {
      const res = await apiFetch('/api/weekly-review/notes', {
        method: 'PUT',
        body: JSON.stringify({
          weekStartDate: reviewData.weekStartDate,
          workedWell,
          madeItHard,
        }),
      });

      if (res.success) {
        setSaveSuccessMsg('Reflection notes saved successfully!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Failed to save reflection notes:', err);
      setError('Could not save reflection notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Navigate to previous week (subtract 7 days)
  const handlePrevWeek = () => {
    if (!reviewData?.weekStartDate) return;
    const currentMon = new Date(reviewData.weekStartDate + 'T00:00:00Z');
    const prevMon = new Date(currentMon.getTime() - 7 * 86400000);
    const prevMonStr = prevMon.toISOString().split('T')[0];
    setSelectedWeekDate(prevMonStr);
  };

  // Navigate to next week (add 7 days)
  const handleNextWeek = () => {
    if (!reviewData?.weekStartDate) return;
    const currentMon = new Date(reviewData.weekStartDate + 'T00:00:00Z');
    const nextMon = new Date(currentMon.getTime() + 7 * 86400000);
    const nextMonStr = nextMon.toISOString().split('T')[0];
    setSelectedWeekDate(nextMonStr);
  };

  // Reset to current week
  const handleCurrentWeek = () => {
    setSelectedWeekDate(null);
  };

  // Check if viewing current week or future week
  const isCurrentWeek = !selectedWeekDate || (reviewData && reviewData.weekStartDate === reviewData.todayDate);
  const isFutureWeek = reviewData && selectedWeekDate && selectedWeekDate > reviewData.todayDate;

  const formatDateRange = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const startDate = new Date(startStr + 'T00:00:00');
    const endDate = new Date(endStr + 'T00:00:00');
    const startMonth = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endMonth = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startMonth} – ${endMonth}`;
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
        <p className="text-sm font-medium">Generating your weekly focus review...</p>
      </div>
    );
  }

  const { overview = {}, comparison = {}, daily = [], deepWork = {}, goals = {}, distractions = {}, consistency = {}, highlight, recommendation } = reviewData || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header & Week Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Weekly Review</h1>
              <span className="text-xs font-mono text-brand-400 font-semibold">
                {formatDateRange(reviewData?.weekStartDate, reviewData?.weekEndDate)}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            "See how your focus went this week."
          </p>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevWeek}
            className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Week</span>
          </button>

          {selectedWeekDate && (
            <button
              onClick={handleCurrentWeek}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-brand-600/20 text-brand-300 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
            >
              Current Week
            </button>
          )}

          <button
            onClick={handleNextWeek}
            disabled={isCurrentWeek || isFutureWeek}
            className="flex items-center space-x-1 text-xs font-medium px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Week"
          >
            <span className="hidden sm:inline">Next Week</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty Week State */}
      {overview.completedSessions === 0 ? (
        <div className="mt-10 p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No Focus Sessions This Week Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Start a focus session to begin building your weekly review data.
          </p>
          <button
            onClick={onNewSession}
            className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
          >
            Start a Focus Session
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Section A: Weekly Overview Cards */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Weekly Overview</h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Focus Points */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Focus Points</span>
                  <Award className="w-4 h-4 text-brand-400" />
                </div>
                <div className="text-3xl font-black text-white">{overview.focusPoints || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {comparison.hasPreviousData ? (
                    <span className={comparison.focusPointsChangePercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {comparison.focusPointsChangePercent >= 0 ? `↑ ${comparison.focusPointsChangePercent}%` : `↓ ${Math.abs(comparison.focusPointsChangePercent)}%`} from last week
                    </span>
                  ) : (
                    <span className="text-slate-500">Not enough previous data</span>
                  )}
                </div>
              </div>

              {/* Focused Time */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Focused Time</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-emerald-400">{overview.focusedText || '0m'}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {comparison.hasPreviousData ? (
                    <span className={comparison.focusedChangePercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {comparison.focusedChangePercent >= 0 ? `↑ ${comparison.focusedChangePercent}%` : `↓ ${Math.abs(comparison.focusedChangePercent)}%`} from last week
                    </span>
                  ) : (
                    <span className="text-slate-500">Not enough previous data</span>
                  )}
                </div>
              </div>

              {/* Sessions Completed */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Sessions</span>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-3xl font-black text-white">{overview.completedSessions || 0}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {comparison.hasPreviousData ? (
                    <span className="text-slate-300 font-semibold">
                      {comparison.sessionCountChange >= 0 ? `+${comparison.sessionCountChange}` : comparison.sessionCountChange} vs last week
                    </span>
                  ) : (
                    <span className="text-slate-500">Completed sessions</span>
                  )}
                </div>
              </div>

              {/* Focus Days */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Focus Days</span>
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-black text-amber-400">
                  {overview.focusDays || 0} <span className="text-sm font-normal text-slate-400">/ 7</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Days with qualifying focus
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Daily Focus Activity Breakdown */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Daily Focus Breakdown (Mon – Sun)</h3>

            <div className="grid grid-cols-7 gap-2 sm:gap-4 text-center">
              {daily.map((day) => {
                const maxMins = Math.max(1, ...daily.map(d => d.focusedMinutes || 0));
                const barHeight = day.focusedMinutes > 0 ? Math.max(15, Math.round((day.focusedMinutes / maxMins) * 100)) : 4;

                return (
                  <div key={day.date} className="flex flex-col items-center justify-end h-44 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-mono mb-1">{day.focusedMinutes}m</div>
                    <div className="w-full max-w-[28px] bg-slate-800 rounded-t-md overflow-hidden flex items-end h-28">
                      <div
                        className={`w-full transition-all duration-500 rounded-t-md ${
                          day.focusedMinutes > 0
                            ? 'bg-gradient-to-t from-brand-600 to-emerald-400'
                            : 'bg-slate-800'
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <div className="text-xs font-bold text-slate-200 mt-2">{day.dayName}</div>
                    <div className="text-[9px] text-brand-400 font-mono">+{day.focusPoints}pts</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid: Deep Work & Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deep Work Section */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Deep Work Performance</h3>
                    <p className="text-xs text-slate-400">Continuous uninterrupted study-like focus</p>
                  </div>
                </div>

                {deepWork.isPersonalBest && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    🏆 New Personal Best
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Longest Block</span>
                  <span className="text-xl font-black text-emerald-400 font-mono block mt-1">
                    {deepWork.longestBlockText || '0m'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Total Deep Work</span>
                  <span className="text-xl font-black text-brand-300 font-mono block mt-1">
                    {deepWork.totalDeepWorkText || '0m'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Deep Blocks</span>
                  <span className="text-xl font-black text-white font-mono block mt-1">
                    {deepWork.blockCount || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Goals Section */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Goal-Based Sessions</h3>
                    <p className="text-xs text-slate-400">Target goal completions this week</p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-brand-300">
                  {goals.completionRate || 0}% Completion
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Goal Sessions</span>
                  <span className="text-xl font-black text-white font-mono block mt-1">
                    {goals.goalSessions || 0}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Completed</span>
                  <span className="text-xl font-black text-emerald-400 font-mono block mt-1">
                    {goals.completedGoals || 0}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Completion Rate</span>
                  <span className="text-xl font-black text-brand-300 font-mono block mt-1">
                    {goals.completionRate || 0}%
                  </span>
                </div>
              </div>

              {goals.goalsList && goals.goalsList.length > 0 && (
                <div className="pt-2 space-y-1.5 text-xs text-slate-300">
                  {goals.goalsList.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                      <span className="truncate max-w-[240px] font-medium">{g.goalText}</span>
                      <span className={g.goalCompleted ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'}>
                        {g.goalCompleted ? '✓ Completed' : 'Partially completed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grid: Distractions & Consistency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distractions Section */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Distraction Summary</h3>
                  <p className="text-xs text-slate-400">Aggregated interruptions detected during sessions</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Total Distraction Time</span>
                  <span className="text-xl font-black text-rose-400 font-mono block mt-1">
                    {distractions.totalText || '0m'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Distraction Events</span>
                  <span className="text-xl font-black text-slate-200 font-mono block mt-1">
                    {distractions.totalEvents || 0}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium block">Most Common Interruption</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-bold text-white">{distractions.topCategory}</span>
                  {distractions.topCategorySessions > 0 && (
                    <span className="text-xs text-slate-400">
                      Detected in {distractions.topCategorySessions} of {distractions.completedSessionsCount} sessions
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Consistency Section */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Consistency & Streaks</h3>
                  <p className="text-xs text-slate-400">Habit building across calendar days</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Current Streak</span>
                  <span className="text-xl font-black text-amber-400 font-mono block mt-1">
                    🔥 {consistency.currentStreak || 0}d
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Focus Days</span>
                  <span className="text-xl font-black text-white font-mono block mt-1">
                    {consistency.focusDays || 0} / 7
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 font-medium block">Best Streak</span>
                  <span className="text-xl font-black text-amber-300 font-mono block mt-1">
                    🏆 {consistency.bestStreak || 0}d
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-medium pt-1">
                "You focused on {consistency.focusDays} of 7 days this week."
              </p>
            </div>
          </div>

          {/* Highlight & Focus Coach Recommendation */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-950 border border-indigo-500/40 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Weekly Highlight</span>
                <h3 className="text-base font-extrabold text-white mt-0.5">{highlight}</h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-3">
              <Compass className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-brand-300 block">Next Week Focus Recommendation</span>
                <p className="text-xs text-slate-300 mt-1">{recommendation}</p>
              </div>
            </div>
          </div>

          {/* Section: NEXT WEEK Adaptive Recommendation */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">NEXT WEEK</span>
                <h4 className="text-sm font-bold text-white mt-0.5">Personalized Adaptive Recommendation</h4>
                <p className="text-xs text-slate-300 mt-0.5">Based on your recent focus utilization and deep work blocks</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate('recommendations')}
              className="flex items-center space-x-2 text-xs font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md shadow-emerald-900/30 transition-all shrink-0 self-end sm:self-center"
            >
              <span>Use Recommendation</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Section F: Weekly Reflection Form */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">REFLECT</h3>
                <p className="text-xs text-slate-400">Personal notes for your weekly review (private to you)</p>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <label htmlFor="workedWellInput">What worked well this week?</label>
                  <span className="text-[11px] font-mono text-slate-500">{workedWell.length} / 500</span>
                </div>
                <textarea
                  id="workedWellInput"
                  value={workedWell}
                  onChange={(e) => setWorkedWell(e.target.value.slice(0, 500))}
                  placeholder="e.g. Shorter 25-minute study blocks helped me maintain deep work..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <label htmlFor="madeItHardInput">What made focusing harder?</label>
                  <span className="text-[11px] font-mono text-slate-500">{madeItHard.length} / 500</span>
                </div>
                <textarea
                  id="madeItHardInput"
                  value={madeItHard}
                  onChange={(e) => setMadeItHard(e.target.value.slice(0, 500))}
                  placeholder="e.g. Phone notifications during afternoon study sessions..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingNotes}
                  className="flex items-center space-x-2 text-xs font-semibold px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/20 transition-all hover:scale-105 disabled:opacity-50"
                >
                  <span>{isSavingNotes ? 'Saving...' : 'Save Reflection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
