import React, { useState, useEffect } from 'react';
import { History, Calendar, Clock, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, HardDrive, Database, Target } from 'lucide-react';
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
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sec`;
    return `${mins} min ${secs > 0 ? `${secs}s` : ''}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <History className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Session History</h1>
          </div>
          <p className="text-sm text-slate-400">
            Persistent log of focus sessions stored in PostgreSQL database with local fallback security.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center space-x-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-400' : 'text-slate-400'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Pending'}</span>
          </button>

          <button
            onClick={onNewSession}
            className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
          >
            Start New Session
          </button>
        </div>
      </div>

      {/* Backend Status Notice */}
      {!isBackendAvailable && (
        <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-semibold text-amber-300">Backend API Offline (Local Cache Active):</span>
            {' '}Showing locally persisted focus sessions stored safely in your browser. When the backend server restarts, pending sessions will automatically sync to PostgreSQL.
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="mt-8">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
            <p className="text-sm">Loading session history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300">No Focus Sessions Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Complete your first focus session to start building your persistent history record.
            </p>
            <button
              onClick={onNewSession}
              className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg shadow-md shadow-brand-600/20 transition-all"
            >
              Start Your First Session
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const actualSecs = session.actualDurationMs ? Math.round(session.actualDurationMs / 1000) : 0;
              const plannedMins = session.plannedDurationMs ? Math.round(session.plannedDurationMs / 60000) : 25;
              const isLocal = session.isLocal || session.id.startsWith('local_');
              const hasGoal = session.goalType && session.goalType !== 'NONE' && session.goalText;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className="group relative p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer shadow-lg hover:shadow-brand-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 group-hover:scale-105 group-hover:bg-brand-600/20 group-hover:text-brand-400 transition-all">
                      {hasGoal ? (
                        <Target className="w-6 h-6 text-brand-400" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                          {hasGoal ? session.goalText : (session.selectedActivity || 'Focus Session')}
                        </h3>
                        {hasGoal && session.selectedActivity && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {session.selectedActivity}
                          </span>
                        )}
                        {isLocal ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Saved locally in browser">
                            <HardDrive className="w-3 h-3" />
                            <span>Local Cache</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Persisted in PostgreSQL database">
                            <Database className="w-3 h-3" />
                            <span>PostgreSQL</span>
                          </span>
                        )}
                        {session.status === 'COMPLETED' && (session.qualifyingFocusSeconds > 0 || session.focusPoints > 0) && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Qualifying focus session towards focus streaks">
                            <span>Focus Day ✓</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDate(session.startedAt || session.createdAt)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Duration: {formatDuration(actualSecs)}</span>
                        </div>
                        {session.focusPoints !== undefined && (
                          <div className="flex items-center space-x-1 font-mono text-emerald-400 font-medium">
                            <span>+{session.focusPoints} pts</span>
                          </div>
                        )}
                        {hasGoal && (
                          <div className="flex items-center space-x-1 font-mono text-brand-300 font-semibold">
                            <span>
                              {session.goalType === 'COUNT' ? (
                                `${session.goalProgress || 0} / ${session.targetValue} ${session.targetUnit || ''} progress`
                              ) : (
                                `${session.goalProgress || 0}% goal progress`
                              )}
                            </span>
                            {session.goalCompleted && <span className="text-emerald-400 ml-1">✓</span>}
                          </div>
                        )}
                        {session.deepWork?.longestBlockText && !hasGoal && (
                          <div className="flex items-center space-x-1 font-mono text-slate-300">
                            <span>Longest Block: <strong className="text-white">{session.deepWork.longestBlockText}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {session.status || 'COMPLETED'}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
