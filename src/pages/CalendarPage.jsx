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
  Plus,
  ExternalLink,
  Unlink,
  CalendarDays,
  MapPin,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
  CalendarRange
} from 'lucide-react';
import { fetchCalendarMonth } from '../api/sessionApi.js';
import {
  fetchGoogleCalendarStatus,
  getGoogleCalendarConnectUrl,
  connectGoogleCalendar,
  fetchGoogleCalendars,
  selectGoogleCalendar,
  fetchGoogleCalendarEvents,
  disconnectGoogleCalendar,
} from '../api/googleCalendarApi.js';
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

function getEventDateStr(event) {
  if (!event || !event.start) return null;
  if (event.allDay || (typeof event.start === 'string' && event.start.length === 10)) {
    return event.start.slice(0, 10);
  }
  const d = new Date(event.start);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function formatEventTime(event) {
  if (event.allDay) return 'All day';
  if (!event.start) return '';
  const dStart = new Date(event.start);
  if (isNaN(dStart.getTime())) return '';
  const startFormatted = dStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (event.end) {
    const dEnd = new Date(event.end);
    if (!isNaN(dEnd.getTime())) {
      const endFormatted = dEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `${startFormatted} – ${endFormatted}`;
    }
  }
  return startFormatted;
}

export function CalendarPage({ onSelectSession, onNewSession, onNavigate }) {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const initialYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const [currentYearMonth, setCurrentYearMonth] = useState(initialYearMonth);
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'list'
  const [calendarData, setCalendarData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Google Calendar Integration State
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: null, selectedCalendarId: 'primary' });
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [googleNotice, setGoogleNotice] = useState(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadCalendar = async (yearMonth) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarMonth(yearMonth);
      setCalendarData(data);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      if (err.status === 401 || err.isAuthError) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Could not load calendar data. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadGoogleEvents = async (yearMonth, calId) => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      const [y, m] = yearMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const startStr = `${yearMonth}-01`;
      const endStr = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
      const res = await fetchGoogleCalendarEvents(startStr, endStr, calId);
      setGoogleEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load Google Calendar events:', err);
      if (err.data?.code === 'GOOGLE_TOKEN_EXPIRED' || err.status === 401) {
        setGoogleError('Google Calendar connection expired. Please reconnect.');
        setGoogleStatus(prev => ({ ...prev, connected: false }));
      } else {
        setGoogleError(err.message || 'Could not load Google Calendar events.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const loadGoogleCalendars = async () => {
    try {
      const res = await fetchGoogleCalendars();
      if (res.calendars) {
        setGoogleCalendars(res.calendars);
      }
      if (res.selectedCalendarId) {
        setGoogleStatus(prev => ({ ...prev, selectedCalendarId: res.selectedCalendarId }));
      }
    } catch (err) {
      // Silent catch
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const status = await fetchGoogleCalendarStatus();
      setGoogleStatus(status);
      if (status.connected) {
        loadGoogleCalendars();
        loadGoogleEvents(currentYearMonth, status.selectedCalendarId);
      }
    } catch (err) {
      // Not authenticated or error
    }
  };

  // URL query parameter feedback handler (?google=connected, ?google=denied, ?google=error)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const googleParam = urlParams.get('google');
    if (googleParam === 'connected') {
      setGoogleNotice({ type: 'success', text: 'Google Calendar successfully connected!' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleParam === 'denied') {
      setGoogleNotice({ type: 'warning', text: 'Google Calendar connection was cancelled or denied.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleParam === 'error') {
      const msg = urlParams.get('message') || 'Failed to connect Google Calendar.';
      setGoogleNotice({ type: 'error', text: decodeURIComponent(msg) });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkGoogleStatus();
  }, []);

  useEffect(() => {
    loadCalendar(currentYearMonth);
    if (googleStatus.connected) {
      loadGoogleEvents(currentYearMonth, googleStatus.selectedCalendarId);
    }
  }, [currentYearMonth]);

  const handleConnectGoogle = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      await connectGoogleCalendar();
    } catch (err) {
      console.error('Failed to initiate Google authorization:', err);
      setGoogleError(err.message || 'Failed to initiate Google authorization.');
      setIsGoogleLoading(false);
    }
  };

  const handleCalendarSelect = async (e) => {
    const newCalId = e.target.value;
    try {
      await selectGoogleCalendar(newCalId);
      setGoogleStatus(prev => ({ ...prev, selectedCalendarId: newCalId }));
      loadGoogleEvents(currentYearMonth, newCalId);
    } catch (err) {
      console.error('Failed to update calendar selection:', err);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? FocusLens sessions will remain untouched.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleStatus({ connected: false, email: null, selectedCalendarId: 'primary' });
      setGoogleCalendars([]);
      setGoogleEvents([]);
      setGoogleNotice({ type: 'info', text: 'Google Calendar disconnected.' });
    } catch (err) {
      console.error('Failed to disconnect Google Calendar:', err);
      setGoogleError('Failed to disconnect Google Calendar.');
    } finally {
      setIsDisconnecting(false);
    }
  };

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

  // Dynamic month title: e.g. "September 2026"
  const displayMonthYearTitle = useMemo(() => {
    const [y, m] = currentYearMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentYearMonth]);

  // Find day object for the currently selected date
  const selectedDay = useMemo(() => {
    if (!calendarData?.days) return null;
    return calendarData.days.find(d => d.date === selectedDateStr) || null;
  }, [calendarData, selectedDateStr]);

  // Google Calendar events for the selected day
  const selectedDayGoogleEvents = useMemo(() => {
    if (!googleEvents || googleEvents.length === 0 || !selectedDateStr) return [];
    return googleEvents.filter(evt => getEventDateStr(evt) === selectedDateStr);
  }, [googleEvents, selectedDateStr]);

  // Active Google Calendar name
  const activeCalendarName = useMemo(() => {
    const cal = googleCalendars.find(c => c.id === googleStatus.selectedCalendarId);
    return cal?.summary || (googleStatus.selectedCalendarId === 'primary' ? 'Primary Calendar' : 'Google Calendar');
  }, [googleCalendars, googleStatus.selectedCalendarId]);

  // Map of dateStr -> count of Google Calendar events for calendar indicators
  const googleEventsCountByDate = useMemo(() => {
    const map = {};
    if (!googleEvents || googleEvents.length === 0) return map;
    googleEvents.forEach(evt => {
      const dateStr = getEventDateStr(evt);
      if (dateStr) {
        map[dateStr] = (map[dateStr] || 0) + 1;
      }
    });
    return map;
  }, [googleEvents]);

  // Map of dateStr -> list of Google Calendar events for week/list views
  const googleEventsByDate = useMemo(() => {
    const map = {};
    if (!googleEvents || googleEvents.length === 0) return map;
    googleEvents.forEach(evt => {
      const dateStr = getEventDateStr(evt);
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(evt);
      }
    });
    return map;
  }, [googleEvents]);

  // Calculate calendar grid cells for Month View (including leading and trailing days)
  const gridCells = useMemo(() => {
    if (!calendarData?.days || calendarData.days.length === 0) return [];

    const firstDay = calendarData.days[0];
    const firstDayOfWeek = firstDay.dayOfWeek; // 0 = Sun
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

    // Trailing padding days to fill complete 7 columns
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const needed = 7 - remainder;
      for (let i = 0; i < needed; i++) {
        cells.push({ isPadding: true, key: `pad-post-${i}` });
      }
    }

    return cells;
  }, [calendarData]);

  // Calculate days for Week View (Sun-Sat of selectedDateStr)
  const weekDays = useMemo(() => {
    if (!selectedDateStr) return [];
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const selDate = new Date(y, m - 1, d);
    const dayOfWeek = selDate.getDay(); // 0 = Sun
    const days = [];

    for (let i = 0; i < 7; i++) {
      const diff = i - dayOfWeek;
      const targetDate = new Date(y, m - 1, d + diff);
      const ty = targetDate.getFullYear();
      const tm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const td = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${ty}-${tm}-${td}`;

      const matchedDay = calendarData?.days?.find(item => item.date === dateStr);
      days.push({
        date: dateStr,
        dayNumber: targetDate.getDate(),
        dayOfWeek: i,
        sessionCount: matchedDay?.sessionCount || 0,
        totalDurationSec: matchedDay?.totalDurationSec || 0,
        totalFocusPoints: matchedDay?.totalFocusPoints || 0,
        sessions: matchedDay?.sessions || [],
      });
    }
    return days;
  }, [selectedDateStr, calendarData]);

  // List view days (days in month with activity, or selected day / today)
  const listViewDays = useMemo(() => {
    if (!calendarData?.days) return [];
    return calendarData.days.filter(d => {
      const hasSessions = d.sessionCount > 0;
      const hasGoogle = (googleEventsCountByDate[d.date] || 0) > 0;
      const isSelected = d.date === selectedDateStr;
      const isToday = d.date === todayStr;
      return hasSessions || hasGoogle || isSelected || isToday;
    });
  }, [calendarData, googleEventsCountByDate, selectedDateStr, todayStr]);

  const monthSummary = calendarData?.monthSummary || {
    totalSessions: 0,
    totalDurationSec: 0,
    totalFocusPoints: 0,
    activeDaysCount: 0,
    totalGoalsCompleted: 0,
  };

  // Formatted date string for the right sidebar header (e.g. "Thu, 18 Sep 2026")
  const formattedSelectedDateHeader = useMemo(() => {
    if (!selectedDateStr) return '';
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDateStr]);

  const isCurrentMonthActive = currentYearMonth === initialYearMonth;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar: Back Button & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BackButton
          label="Back to Dashboard"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleJumpToToday}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              selectedDateStr === todayStr && isCurrentMonthActive
                ? 'bg-brand-600/20 text-brand-300 border-brand-500/40 shadow-sm shadow-brand-500/10'
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
            onClick={() => {
              setSelectedDateStr(todayStr);
              if (onNewSession) onNewSession();
            }}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Calendar Header with Controls & View Switcher */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center space-x-4">
          <div className="p-2.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <CalendarIcon className="w-6 h-6" />
          </div>

          <div className="flex items-center space-x-3">
            {/* Previous Month */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dynamic Month & Year Title */}
            <div className="text-left min-w-[170px]">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {displayMonthYearTitle}
              </h1>
              <span className="text-[11px] font-medium text-slate-400">
                {monthSummary.totalSessions} focus sessions · {formatDuration(monthSummary.totalDurationSec)}
              </span>
            </div>

            {/* Next Month */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Section: View Switcher (Month, Week, List) & Monthly Metrics */}
        <div className="flex items-center justify-between sm:justify-end space-x-4">
          {/* View Mode Segmented Switcher */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-2xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'month'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'week'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'list'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Quick Month Metrics Pill */}
          <div className="hidden xl:flex items-center space-x-5 text-xs pl-4 border-l border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Focus Points</span>
              <span className="text-brand-300 font-bold font-mono">+{monthSummary.totalFocusPoints}</span>
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

      {googleNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between transition-all ${
            googleNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : googleNotice.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : googleNotice.type === 'info'
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {googleNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : googleNotice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{googleNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setGoogleNotice(null)}
            className="text-slate-400 hover:text-white text-base px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Layout: Calendar Content (8 cols on lg) + Right Contextual Sidebar (4 cols on lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Calendar Views */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="space-y-4">
              {/* Weekday Labels (Sun - Sat) */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {WEEKDAYS.map(day => (
                  <div key={day} className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cards Grid */}
              <div className="grid grid-cols-7 gap-2">
                {gridCells.map(cell => {
                  if (cell.isPadding) {
                    return (
                      <div
                        key={cell.key}
                        className="min-h-[82px] sm:min-h-[96px] rounded-2xl p-2 bg-slate-950/20 border border-slate-900/30 opacity-20 pointer-events-none"
                      />
                    );
                  }

                  const { day } = cell;
                  const isToday = day.date === todayStr;
                  const isSelected = day.date === selectedDateStr;
                  const hasSessions = day.sessionCount > 0;
                  const googleCount = googleEventsCountByDate[day.date] || 0;
                  const hasGoogle = googleCount > 0;
                  const hasBoth = hasSessions && hasGoogle;

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDateStr(day.date)}
                      className={`min-h-[82px] sm:min-h-[96px] rounded-2xl p-2.5 text-left flex flex-col justify-between transition-all relative group cursor-pointer focus:outline-none ${
                        isSelected
                          ? 'bg-slate-800/90 border-2 border-brand-500 shadow-lg shadow-brand-500/15 ring-2 ring-brand-500/40'
                          : hasSessions || hasGoogle
                            ? 'bg-slate-950/80 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/40 hover:bg-slate-800/40 border border-slate-900 hover:border-slate-800/80'
                      }`}
                      aria-label={`${day.date}: ${day.sessionCount} focus sessions, ${googleCount} Google events`}
                    >
                      {/* Card Top: Date Number & Activity Indicator */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono font-bold rounded-lg px-1.5 py-0.5 inline-flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-brand-500 text-white font-extrabold shadow-sm'
                              : isToday
                                ? 'ring-1 ring-brand-400/60 text-brand-300 bg-brand-500/20 font-bold'
                                : hasSessions || hasGoogle
                                  ? 'text-slate-200'
                                  : 'text-slate-500'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {/* Activity Indicator Dot (Subtle, Not Full Fill) */}
                        <div className="flex items-center space-x-1">
                          {hasBoth ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30"
                              title="Focus session & Google Calendar event"
                            />
                          ) : hasSessions ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30"
                              title={`${day.sessionCount} Focus session(s)`}
                            />
                          ) : hasGoogle ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30"
                              title={`${googleCount} Google Calendar event(s)`}
                            />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 opacity-60" />
                          )}
                        </div>
                      </div>

                      {/* Card Bottom: Session Count / Duration */}
                      <div className="space-y-0.5 mt-1.5 w-full">
                        {hasSessions ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold text-slate-200 truncate">
                              {formatDuration(day.totalDurationSec)}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium truncate">
                              {day.sessionCount} {day.sessionCount === 1 ? 'session' : 'sessions'}
                            </span>
                          </div>
                        ) : hasGoogle ? (
                          <span className="text-[9px] text-emerald-400 font-medium truncate block">
                            {googleCount} {googleCount === 1 ? 'event' : 'events'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-700 block select-none">—</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span>Week of {formattedSelectedDateHeader}</span>
                <span className="text-slate-500">7-day timeline view</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {weekDays.map(wDay => {
                  const isToday = wDay.date === todayStr;
                  const isSelected = wDay.date === selectedDateStr;
                  const hasSessions = wDay.sessionCount > 0;
                  const dayGoogleEvents = googleEventsByDate[wDay.date] || [];
                  const hasGoogle = dayGoogleEvents.length > 0;
                  const hasBoth = hasSessions && hasGoogle;

                  return (
                    <button
                      key={wDay.date}
                      type="button"
                      onClick={() => setSelectedDateStr(wDay.date)}
                      className={`min-h-[160px] rounded-2xl p-3 text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-2 border-brand-500 shadow-lg shadow-brand-500/15 ring-2 ring-brand-500/40'
                          : 'bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800'
                      }`}
                    >
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {WEEKDAYS[wDay.dayOfWeek]}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-lg ${
                              isSelected
                                ? 'bg-brand-500 text-white'
                                : isToday
                                  ? 'ring-1 ring-brand-400/60 text-brand-300 bg-brand-500/20'
                                  : 'text-slate-300'
                            }`}
                          >
                            {wDay.dayNumber}
                          </span>
                        </div>

                        {/* Activity Dot */}
                        <div className="flex items-center space-x-1.5">
                          {hasBoth ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30" />
                          ) : hasSessions ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                          ) : hasGoogle ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                          )}
                          <span className="text-[10px] text-slate-400">
                            {hasSessions ? `${formatDuration(wDay.totalDurationSec)}` : 'No focus'}
                          </span>
                        </div>
                      </div>

                      {/* Weekday Micro Details */}
                      <div className="space-y-1 mt-3 w-full">
                        {wDay.sessions.slice(0, 2).map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="px-1.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-300 truncate"
                          >
                            {s.activity}
                          </div>
                        ))}
                        {dayGoogleEvents.slice(0, 2).map(evt => (
                          <div
                            key={evt.id}
                            className="px-1.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300 truncate"
                          >
                            {evt.title}
                          </div>
                        ))}
                        {!hasSessions && !hasGoogle && (
                          <span className="text-[10px] text-slate-700 block select-none">—</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span>Month Agenda Overview</span>
                <span className="text-slate-500">{listViewDays.length} active date(s)</span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {listViewDays.map(lDay => {
                  const isSelected = lDay.date === selectedDateStr;
                  const isToday = lDay.date === todayStr;
                  const hasSessions = lDay.sessionCount > 0;
                  const dayGoogleEvents = googleEventsByDate[lDay.date] || [];
                  const hasGoogle = dayGoogleEvents.length > 0;
                  const hasBoth = hasSessions && hasGoogle;

                  const [y, m, d] = lDay.date.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const dayLabel = dateObj.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={lDay.date}
                      onClick={() => setSelectedDateStr(lDay.date)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-brand-500 shadow-md ring-1 ring-brand-500/40'
                          : 'bg-slate-950/70 hover:bg-slate-800/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {/* Dot indicator */}
                          {hasBoth ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30 shrink-0" />
                          ) : hasSessions ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30 shrink-0" />
                          ) : hasGoogle ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-800 shrink-0" />
                          )}

                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white">{dayLabel}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                Today
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 text-xs font-mono">
                          {hasSessions && (
                            <span className="text-blue-400 font-bold">
                              {formatDuration(lDay.totalDurationSec)} ({lDay.sessionCount})
                            </span>
                          )}
                          {hasGoogle && (
                            <span className="text-emerald-400 font-semibold">
                              {dayGoogleEvents.length} {dayGoogleEvents.length === 1 ? 'event' : 'events'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Legend */}
          <div className="pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                <span className="text-slate-300 font-medium">Focus Session</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                <span className="text-slate-300 font-medium">Google Event</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30" />
                <span className="text-slate-300 font-medium">Both</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
                <span className="text-slate-500">No Activity</span>
              </div>
            </div>

            <span className="text-[11px] text-slate-500">
              Select any day to inspect sessions and events
            </span>
          </div>
        </div>

        {/* Right: Contextual Day Sidebar (4 cols on lg) */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          {/* Sidebar Header */}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-brand-400">
                SELECTED DAY
              </span>
              {selectedDateStr === todayStr && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/40">
                  Today
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {formattedSelectedDateHeader}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDay?.sessionCount || 0} focus {selectedDay?.sessionCount === 1 ? 'session' : 'sessions'} · {formatDuration(selectedDay?.totalDurationSec || 0)}
            </p>
          </div>

          {/* Section A — Focus Sessions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Focus Sessions ({selectedDay?.sessionCount || 0})</span>
              </span>
            </div>

            {(!selectedDay || selectedDay.sessionCount === 0) ? (
              <div className="p-4 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-400 font-medium">No focus sessions</p>
                <p className="text-[11px] text-slate-500">
                  No focus sessions recorded on this day.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {selectedDay.sessions.map((session, idx) => {
                  const Icon = getActivityIcon(session.activity);
                  return (
                    <div
                      key={session.id || idx}
                      onClick={() => onSelectSession && onSelectSession(session)}
                      className="p-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <div className="p-1.5 rounded-lg bg-slate-900 text-brand-400 border border-slate-800 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white group-hover:text-brand-300 transition-colors leading-tight">
                              {session.activity}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {session.startTimeFormatted || 'Session'}
                              {session.endTimeFormatted ? ` – ${session.endTimeFormatted}` : ''}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-bold text-brand-300 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20 shrink-0">
                          {formatDuration(session.durationSec)}
                        </span>
                      </div>

                      {/* Goal text preview if available */}
                      {session.isTask && session.goalText && (
                        <div className="text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 truncate">
                          Task: {session.goalText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B — Google Calendar Events */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Google Calendar Events ({selectedDayGoogleEvents.length})</span>
              </span>
              {googleStatus.connected && (
                <span className="text-[10px] text-emerald-400 font-medium">Sync Active</span>
              )}
            </div>

            {/* Error message if error occurred while connected */}
            {googleStatus.connected && googleError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-start flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-rose-300 leading-tight">
                    {googleError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleError(null)}
                  className="text-rose-400 hover:text-rose-200 text-xs shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            {!googleStatus.connected ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3 text-center">
                <CalendarDays className="w-6 h-6 text-slate-500 mx-auto" />
                <div>
                  <p className="text-xs text-slate-300 font-medium">Google Calendar not connected</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Connect to view your scheduled Google Calendar events.
                  </p>
                </div>

                {googleError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-start">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-rose-300 leading-tight">
                          {googleError}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGoogleError(null)}
                        className="text-rose-400 hover:text-rose-200 text-xs shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isGoogleLoading}
                  className="mt-1 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isGoogleLoading && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  )}
                  <span>{isGoogleLoading ? 'Connecting...' : 'Connect Google Calendar'}</span>
                </button>
              </div>
            ) : selectedDayGoogleEvents.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <p className="text-xs text-slate-400 font-medium">No Google Calendar events</p>
                <p className="text-[11px] text-slate-500">
                  No events scheduled for this day on Google Calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {selectedDayGoogleEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-2 hover:border-emerald-500/35 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <h4 className="text-xs font-bold text-white leading-tight truncate" title={event.title}>
                            {event.title}
                          </h4>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-emerald-300 font-mono pl-3.5 flex-wrap gap-y-1">
                          <span>{formatEventTime(event)}</span>
                          {event.allDay && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-sans font-medium">
                              All day
                            </span>
                          )}
                        </div>
                      </div>

                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-emerald-300 border border-slate-800 transition-colors shrink-0"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-900/60 pl-3.5 text-[10px] text-slate-400">
                      <span className="truncate text-slate-500 font-medium" title={activeCalendarName}>
                        {activeCalendarName}
                      </span>
                      {event.location && (
                        <div className="flex items-center space-x-1 truncate max-w-[140px]" title={event.location}>
                          <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                          <span className="truncate text-slate-400">{event.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Google Calendar Account Management Widget */}
          {googleStatus.connected && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 truncate max-w-[170px]" title={googleStatus.email}>
                  {googleStatus.email || 'Connected Account'}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => loadGoogleEvents(currentYearMonth, googleStatus.selectedCalendarId)}
                    disabled={isGoogleLoading}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    title="Sync Google Events"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGoogleLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={isDisconnecting}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900 transition-colors cursor-pointer"
                    title="Disconnect Google Calendar"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {googleCalendars.length > 1 && (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Calendar:</span>
                  <select
                    value={googleStatus.selectedCalendarId || 'primary'}
                    onChange={handleCalendarSelect}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {googleCalendars.map(cal => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary} {cal.primary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Quick Action Footer Button */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSelectedDateStr(todayStr);
                if (onNewSession) onNewSession();
              }}
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
