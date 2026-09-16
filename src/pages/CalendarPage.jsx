import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Award,
  Target,
  CheckCircle2,
  RefreshCw,
  Play,
  BookOpen,
  Code2,
  BookMarked,
  Video,
  Sparkles,
  Flame,
  ArrowRight,
  Plus
} from 'lucide-react';
import { fetchCalendarMonth } from '../api/sessionApi.js';
import { BackButton } from '../components/BackButton.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getActivityIcon(activity) {
  switch (activity?.toLowerCase()) {
    case 'coding':
      return Code2;
    case 'reading':
      return BookMarked;
    case 'watching lecture':
    case 'lecture':
      return Video;
    case 'studying':
    default:
      return BookOpen;
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getTodayLocalDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export function CalendarPage({ onSelectSession, onNewSession, onNavigate }) {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const initialYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const [currentYearMonth, setCurrentYearMonth] = useState(initialYearMonth);
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [calendarData, setCalendarData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCalendar = async (yearMonth) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarMonth(yearMonth);
      setCalendarData(data);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Could not load calendar data. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar(currentYearMonth);
  }, [currentYearMonth]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    const [y, m] = currentYearMonth.split('-').map(Number);
    let newYear = y;
    let newMonth = m - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const newYm = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setCurrentYearMonth(newYm);
  };

  const handleNextMonth = () => {
    const [y, m] = currentYearMonth.split('-').map(Number);
    let newYear = y;
    let newMonth = m + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const newYm = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setCurrentYearMonth(newYm);
  };

  const handleJumpToToday = () => {
    setCurrentYearMonth(initialYearMonth);
    setSelectedDateStr(todayStr);
  };

  // Find day object for the currently selected date
  const selectedDay = useMemo(() => {
    if (!calendarData?.days) return null;
    return calendarData.days.find(d => d.date === selectedDateStr) || null;
  }, [calendarData, selectedDateStr]);

  // Calculate calendar grid cells (including leading and trailing days)
  const gridCells = useMemo(() => {
    if (!calendarData?.days || calendarData.days.length === 0) return [];

    const firstDay = calendarData.days[0];
    const firstDayOfWeek = firstDay.dayOfWeek; // 0 = Sun
    const totalDays = calendarData.days.length;

    const cells = [];

    // Preceding empty/padding days
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ isPadding: true, key: `pad-pre-${i}` });
    }

    // Days in month
    calendarData.days.forEach(day => {
      cells.push({
        isPadding: false,
        key: day.date,
        day,
      });
    });

    // Trailing padding days to fill 7 columns
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const needed = 7 - remainder;
      for (let i = 0; i < needed; i++) {
        cells.push({ isPadding: true, key: `pad-post-${i}` });
      }
    }

    return cells;
  }, [calendarData]);

  const monthSummary = calendarData?.monthSummary || {
    totalSessions: 0,
    totalDurationSec: 0,
    totalFocusPoints: 0,
    activeDaysCount: 0,
    totalGoalsCompleted: 0,
  };

  const formattedSelectedDateHeader = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDateStr]);

  const isCurrentMonthActive = currentYearMonth === initialYearMonth;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Navigation & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BackButton
          label="Back to Dashboard"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleJumpToToday}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              selectedDateStr === todayStr && isCurrentMonthActive
                ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => loadCalendar(currentYearMonth)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Calendar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onNewSession}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Month Navigation Banner & Monthly Metrics */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {calendarData?.monthName || 'Calendar'}
                </h1>
                {isCurrentMonthActive && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/40 uppercase tracking-wider">
                    Current Month
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Focus sessions and target tasks mapped across calendar days.
              </p>
            </div>
          </div>
        </div>

        {/* Month Switcher Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono font-bold text-slate-200 px-3 min-w-[90px] text-center">
              {currentYearMonth}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month Summary Metrics Quick Stats */}
          <div className="hidden lg:flex items-center space-x-6 text-xs pl-4 border-l border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Time</span>
              <span className="text-white font-bold font-mono">{formatDuration(monthSummary.totalDurationSec)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Points</span>
              <span className="text-brand-300 font-bold font-mono">+{monthSummary.totalFocusPoints}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Sessions</span>
              <span className="text-white font-bold font-mono">{monthSummary.totalSessions}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Tasks</span>
              <span className="text-emerald-400 font-bold font-mono">{monthSummary.totalGoalsCompleted}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => loadCalendar(currentYearMonth)}
            className="underline font-semibold hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Grid + Selected Day Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Calendar Grid (8 cols on lg) */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {gridCells.map(cell => {
              if (cell.isPadding) {
                return (
                  <div
                    key={cell.key}
                    className="min-h-[72px] sm:min-h-[88px] rounded-2xl p-2 bg-slate-950/30 border border-slate-900/40 opacity-20 pointer-events-none"
                  />
                );
              }

              const { day } = cell;
              const isToday = day.date === todayStr;
              const isSelected = day.date === selectedDateStr;
              const hasSessions = day.sessionCount > 0;
              const hasTasks = day.hasGoals;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDateStr(day.date)}
                  className={`min-h-[72px] sm:min-h-[88px] rounded-2xl p-2 text-left flex flex-col justify-between transition-all relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'bg-slate-800 border-2 border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/20'
                      : hasSessions
                        ? 'bg-slate-950/90 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/50 hover:bg-slate-800/50 border border-slate-900 hover:border-slate-800'
                  }`}
                  aria-label={`${day.date}: ${day.sessionCount} sessions`}
                >
                  {/* Day Number + Today Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold font-mono rounded-lg w-6 h-6 flex items-center justify-center ${
                        isToday
                          ? 'bg-brand-500 text-white shadow-sm'
                          : isSelected
                            ? 'text-brand-300 font-extrabold'
                            : hasSessions
                              ? 'text-slate-200'
                              : 'text-slate-500'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Task Indicator Dot */}
                    {hasTasks && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20"
                        title={`${day.goalsCompletedCount} tasks completed`}
                      />
                    )}
                  </div>

                  {/* Day Content Badges */}
                  <div className="space-y-1 mt-1 w-full">
                    {hasSessions ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-mono font-bold text-slate-300 truncate">
                          {formatDuration(day.totalDurationSec)}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                          <span className="text-[9px] text-slate-400 font-medium">
                            {day.sessionCount} {day.sessionCount === 1 ? 'sess' : 'sess'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-700 block select-none">—</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Grid Legend */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                <span>Today</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Target Task Completed</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-400" />
                <span>Focus Session</span>
              </div>
            </div>

            <span className="text-slate-500">Click any day to view details & reports</span>
          </div>
        </div>

        {/* Right: Selected Day Details & Event List (4 cols on lg) */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Day Header */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-brand-400">
                  DAY SUMMARY
                </span>
                {selectedDateStr === todayStr && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/40">
                    Today
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {formattedSelectedDateHeader}
              </h2>
            </div>

            {/* Selected Day Stats Bar */}
            {selectedDay && selectedDay.sessionCount > 0 ? (
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Time</span>
                  <span className="text-xs font-bold text-white font-mono">
                    {formatDuration(selectedDay.totalDurationSec)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Points</span>
                  <span className="text-xs font-bold text-brand-300 font-mono">
                    +{selectedDay.totalFocusPoints}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Tasks</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {selectedDay.goalsCompletedCount}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Event List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Activity & Sessions ({selectedDay?.sessionCount || 0})
              </span>

              {!selectedDay || selectedDay.sessionCount === 0 ? (
                /* Empty Day State */
                <div className="py-12 px-4 text-center rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">
                    No sessions or tasks scheduled
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    No focus sessions or target tasks recorded for this date.
                  </p>
                  <button
                    type="button"
                    onClick={onNewSession}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/20 transition-all mt-2 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start Focus Session</span>
                  </button>
                </div>
              ) : (
                /* Session List */
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {selectedDay.sessions.map((session, idx) => {
                    const Icon = getActivityIcon(session.activity);
                    const isTask = session.isTask;
                    const isGoalCompleted = session.goalCompleted;

                    return (
                      <div
                        key={session.id || idx}
                        onClick={() => onSelectSession && onSelectSession(session)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
                          isTask
                            ? 'bg-gradient-to-br from-slate-900 to-indigo-950/30 border-indigo-500/30 hover:border-indigo-400/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Session Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-2 rounded-xl bg-slate-900 text-brand-400 border border-slate-800 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white group-hover:text-brand-300 transition-colors">
                                {session.activity}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {session.startTimeFormatted || 'Session'}
                                {session.endTimeFormatted ? ` – ${session.endTimeFormatted}` : ''}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono font-bold text-brand-300 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20">
                            +{session.focusPoints} pts
                          </span>
                        </div>

                        {/* Task / Goal Section */}
                        {isTask && (
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-2 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-300 font-medium truncate max-w-[180px]">
                                {session.goalText || 'Target Task'}
                              </span>
                              {isGoalCompleted ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Completed</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-amber-400">
                                  In progress
                                </span>
                              )}
                            </div>

                            {session.targetValue && (
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Target: {session.targetValue} {session.targetUnit || 'tasks'}</span>
                                {session.goalProgress != null && (
                                  <span>{session.goalProgress} / {session.targetValue}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Session Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Duration: {formatDuration(session.durationSec)}</span>
                          </span>

                          <span className="text-brand-400 group-hover:text-brand-300 font-semibold flex items-center space-x-1">
                            <span>View Report</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onNewSession}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Focus Session for Today</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
