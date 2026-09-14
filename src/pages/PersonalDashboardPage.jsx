import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, BookOpen, Smartphone, HelpCircle, ChevronRight, Award, Flame, RefreshCw, Calendar } from 'lucide-react';
import { apiFetch } from '../api/client';
import { WeeklyActivityChart } from '../components/WeeklyActivityChart';
import { useAuth } from '../context/AuthContext';

export function PersonalDashboardPage({ onSelectSession, onNewSession }) {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/dashboard');
      setDashboardData(res.dashboard);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Could not load dashboard data. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatSeconds = (seconds) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
        <p className="text-sm font-medium">Calculating personal focus analytics...</p>
      </div>
    );
  }

  const today = dashboardData?.today || {};
  const weekly = dashboardData?.weekly || {};
  const monthly = dashboardData?.monthly || {};
  const recentSessions = dashboardData?.recentSessions || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Personal Focus Dashboard</h1>
          </div>
          <p className="text-sm text-slate-400">
            Welcome back, <span className="font-semibold text-slate-200">{user?.name || user?.email}</span>. Here is your deep work activity summary.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboard}
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
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Section A: Today Summary */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Today Overview</h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Sessions Today</span>
              <Clock className="w-4 h-4 text-brand-400" />
            </div>
            <div className="text-2xl font-black text-white">{today.sessionCount || 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Completed focus sessions</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Active Time</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">{formatSeconds(today.totalActiveSec)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Total active session duration</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Study & Coding</span>
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {formatSeconds((today.totalStudyLikeSec || 0) + (today.totalCodingSec || 0))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Study-like & coding signals</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Phone Activity</span>
              <Smartphone className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400">{formatSeconds(today.totalPhoneSec)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Phone presence detected</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Unknown / Away</span>
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-300">
              {formatSeconds((today.totalAwaySec || 0) + (today.totalUnknownSec || 0))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Away or unclassified time</div>
          </div>
        </div>
      </div>

      {/* Grid: Weekly Chart + Monthly Overview */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section C: Weekly Overview Chart */}
        <div className="lg:col-span-2">
          <WeeklyActivityChart weeklyData={weekly.days || []} />
        </div>

        {/* Section D: Monthly Overview */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Monthly Summary</h3>
                <p className="text-xs text-slate-400">{monthly.monthName || 'Current Month'}</p>
              </div>
            </div>

            <div className="space-y-4 my-6">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Monthly Total Active</span>
                <span className="text-sm font-bold text-white">{formatSeconds(monthly.metrics?.totalActiveSec)}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Study-Like Ratio</span>
                <span className="text-sm font-bold text-emerald-400">{monthly.metrics?.studyPercentage || 0}%</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Longest Study Streak</span>
                <span className="text-sm font-bold text-brand-400">{formatSeconds(monthly.metrics?.longestStreakSec)}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Total Sessions</span>
                <span className="text-sm font-bold text-white">{monthly.metrics?.sessionCount || 0}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Metrics reflect local observational signal classifications.
          </div>
        </div>
      </div>

      {/* Section B: Recent Sessions */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Sessions</h2>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <p className="text-xs text-slate-500">No recent session data available.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map((session) => {
              const actualSec = Math.round((session.actualDurationMs || session.plannedDurationMs || 0) / 1000);
              const studyPct = session.percentages?.STUDY_LIKE || 0;
              const codingPct = session.percentages?.CODING || 0;
              const phonePct = session.percentages?.PHONE_ACTIVITY || 0;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300 shrink-0 group-hover:bg-brand-600/20 group-hover:text-brand-400 transition-colors">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                        {session.selectedActivity || 'Focus Session'}
                      </h4>
                      <div className="text-xs text-slate-500 flex items-center space-x-3 mt-0.5">
                        <span>{formatDate(session.startedAt || session.createdAt)}</span>
                        <span>•</span>
                        <span>Duration: {formatSeconds(actualSec)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Focus: {(studyPct + codingPct)}%</span>
                    </div>

                    {phonePct > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        <span>Phone: {phonePct}%</span>
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
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
