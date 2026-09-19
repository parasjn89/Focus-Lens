import React, { useState, useEffect } from 'react';
import {
  History, Calendar, Clock, CheckCircle2, AlertCircle, RefreshCw,
  ChevronRight, HardDrive, Database, Target, Flame, Play, Activity
} from 'lucide-react';
import { fetchSessionsHistory } from '../api/sessionApi';
import { syncPendingSessions } from '../api/syncManager';

export function SessionHistoryPage({ onSelectSession, onNewSession }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetchSessionsHistory();
      setSessions(res.sessions || []);
      setIsBackendAvailable(res.isBackendAvailable);
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingSessions();
      await loadHistory();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0 min';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
    return `${secs}s`;
  };

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group sessions visually by date
  const groupSessionsByDate = (sessionList) => {
    const groups = {};
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    sessionList.forEach(session => {
      const date = new Date(session.startedAt || session.createdAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dateStr = date.toDateString();

      let relativeLabel = null;
      if (dateStr === todayStr) {
        relativeLabel = 'TODAY';
      } else if (dateStr === yesterdayStr) {
        relativeLabel = 'YESTERDAY';
      } else {
        relativeLabel = date.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
      }

      const formattedDate = date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          relativeLabel,
          formattedDate,
          sessions: [],
        };
      }
      groups[dateKey].sessions.push(session);
    });

    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  };

  // Calculate compact summary strip values from real session data
  const now = new Date();
  const todayDateStr = now.toDateString();
  const todaySessions = sessions.filter(s => {
    const d = new Date(s.startedAt || s.createdAt);
    return d.toDateString() === todayDateStr;
  });

  const todayFocusSec = todaySessions.reduce((acc, s) => {
    const secs = s.actualDurationMs ? Math.round(s.actualDurationMs / 1000) : 0;
    return acc + secs;
  }, 0);

  const todayPoints = todaySessions.reduce((acc, s) => acc + (s.focusPoints || 0), 0);
  const dateGroups = groupSessionsByDate(sessions);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Home</span>
            <span>/</span>
            <span className="text-cyan-400 font-medium">Activity</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Session History
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Structured timeline of your completed focus sessions and milestone achievements.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition cursor-pointer disabled:opacity-50 shadow-sm"
            title="Sync pending offline sessions to PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Pending'}</span>
          </button>

          <button
            type="button"
            onClick={onNewSession}
            className="text-xs font-semibold bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white px-4 py-2 rounded-xl shadow-md shadow-cyan-950/30 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
          >
            Start New Session
          </button>
        </div>
      </div>

      {/* 2. COMPACT SUMMARY STRIP */}
      {!isLoading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-sm">
          <div className="flex items-center space-x-3 px-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Today's Focus
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-white">
                {formatDuration(todayFocusSec)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 px-3 py-1 border-x border-slate-800/80">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Sessions Today
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-white">
                {todaySessions.length}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 px-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Focus Points
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                +{todayPoints} pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Backend Status Notice */}
      {!isBackendAvailable && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start space-x-3 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Backend API Offline (Local Cache Active):</span>
            {' '}Showing locally persisted focus sessions stored safely in your browser. When the backend server restarts, pending sessions will automatically sync to PostgreSQL.
          </div>
        </div>
      )}

      {/* 3 & 4. DATE GROUPING & STREAMLINED ACTIVITY FEED */}
      <div className="space-y-8 pt-2">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-cyan-400 mb-2.5" />
            <p className="text-xs font-medium">Loading session history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200">No Focus Sessions Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Complete your first focus session to start building your persistent activity history.
            </p>
            <button
              type="button"
              onClick={onNewSession}
              className="mt-2 text-xs font-semibold bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Start Your First Session
            </button>
          </div>
        ) : (
          dateGroups.map((group) => (
            <div key={group.dateKey} className="space-y-3">
              {/* DATE GROUP HEADER */}
              <div className="flex items-center space-x-2.5 px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                  {group.relativeLabel}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-medium text-slate-400">
                  {group.formattedDate}
                </span>
                <div className="flex-1 h-px bg-slate-800/60 ml-2" />
              </div>

              {/* SESSION ROWS */}
              <div className="space-y-2">
                {group.sessions.map((session) => {
                  const actualSecs = session.actualDurationMs ? Math.round(session.actualDurationMs / 1000) : 0;
                  const isLocal = session.isLocal || (session.id && String(session.id).startsWith('local_'));
                  const hasGoal = session.goalType && session.goalType !== 'NONE' && session.goalText;
                  const isActive = session.status === 'ACTIVE';
                  const title = hasGoal ? session.goalText : (session.selectedActivity || 'Focus Session');

                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session)}
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/50 hover:bg-slate-800/60 backdrop-blur-md border transition-all duration-150 cursor-pointer shadow-sm hover:shadow-cyan-950/20 ${
                        isActive
                          ? 'border-cyan-500/40 shadow-cyan-950/30 ring-1 ring-cyan-500/20'
                          : 'border-slate-800/80 hover:border-cyan-500/30'
                      }`}
                    >
                      {/* LEFT: STATUS ICON + ACTIVITY/NAME + DATA SOURCE */}
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                            isActive
                              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                              : hasGoal
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {isActive ? (
                            <Activity className="w-4 h-4 animate-pulse" />
                          ) : hasGoal ? (
                            <Target className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                              {title}
                            </h4>

                            {hasGoal && session.selectedActivity && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                {session.selectedActivity}
                              </span>
                            )}

                            {isLocal ? (
                              <span
                                className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0"
                                title="Saved locally in browser"
                              >
                                <HardDrive className="w-2.5 h-2.5" />
                                <span>Local Cache</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0"
                                title="Persisted in PostgreSQL database"
                              >
                                <Database className="w-2.5 h-2.5" />
                                <span>PostgreSQL</span>
                              </span>
                            )}
                          </div>

                          {/* SUB-METADATA ON MOBILE / SMALL SCREENS */}
                          <div className="sm:hidden flex items-center space-x-3 text-xs text-slate-400 mt-1">
                            <span>{formatTimeOnly(session.startedAt || session.createdAt)}</span>
                            <span>•</span>
                            <span>{formatDuration(actualSecs)}</span>
                            {session.focusPoints !== undefined && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-emerald-400 font-semibold">
                                  +{session.focusPoints} pts
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* MIDDLE: TIMING & DURATION (DESKTOP / TABLET) */}
                      <div className="hidden sm:flex items-center space-x-5 text-xs text-slate-400 shrink-0">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatTimeOnly(session.startedAt || session.createdAt)}</span>
                        </div>

                        <div className="font-mono text-slate-300">
                          {formatDuration(actualSecs)}
                        </div>

                        <div className="font-mono font-semibold text-emerald-400 w-16 text-right">
                          {session.focusPoints !== undefined ? `+${session.focusPoints} pts` : ''}
                        </div>
                      </div>

                      {/* RIGHT: STATUS BADGE + CHEVRON */}
                      <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 ring-1 ring-cyan-500/20'
                              : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                          }`}
                        >
                          {session.status || 'COMPLETED'}
                        </span>

                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

