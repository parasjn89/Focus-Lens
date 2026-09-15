import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, BookOpen, Smartphone, HelpCircle, ChevronRight, Award, Flame, RefreshCw, Calendar, MoreHorizontal, Paperclip, Bell, Folder } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      
      {/* Top Section: Header & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-semibold text-white tracking-tight mb-2">Focus Better Today !</h1>
          <p className="text-slate-400 max-w-md text-sm">
            Welcome back, <span className="font-semibold text-white">{user?.name || user?.email}</span>. Management and planning in a simple and attractive style will bring you success.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex space-x-2 bg-navy-800/80 p-1 rounded-xl border border-slate-700/50">
            <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>All Work</span>
            </button>
            <button className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition">
              Study
            </button>
            <button className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition">
              Coding
            </button>
          </div>
          <button
            onClick={fetchDashboard}
            className="w-10 h-10 rounded-xl bg-navy-800/80 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onNewSession}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-500/30 hover:scale-105 transition-transform"
          >
            New task
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Tasks/Sessions) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-2xl">
              <div className="text-slate-400 text-xs mb-1">Sessions Today</div>
              <div className="text-2xl font-bold text-white">{today.sessionCount || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <div className="text-slate-400 text-xs mb-1">Active Time</div>
              <div className="text-2xl font-bold text-amber-400">{formatSeconds(today.totalActiveSec)}</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <div className="text-slate-400 text-xs mb-1">Study/Code</div>
              <div className="text-2xl font-bold text-emerald-400">{formatSeconds((today.totalStudyLikeSec || 0) + (today.totalCodingSec || 0))}</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <div className="text-slate-400 text-xs mb-1">Distractions</div>
              <div className="text-2xl font-bold text-rose-400">{formatSeconds(today.totalPhoneSec)}</div>
            </div>
          </div>

          {/* Recent Sessions List styled as tasks */}
          <div className="space-y-4">
            {recentSessions.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-3xl">
                <p className="text-slate-400">No recent session data available.</p>
              </div>
            ) : (
              recentSessions.map((session, idx) => {
                const actualSec = Math.round((session.actualDurationMs || session.plannedDurationMs || 0) / 1000);
                const progress = session.plannedDurationMs ? Math.min(100, Math.round(((session.actualDurationMs || 0) / session.plannedDurationMs) * 100)) : 100;
                
                // Determine styling based on index to mix it up like the design
                const isHighlight = idx === 1;

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session)}
                    className={`glass-panel p-6 rounded-3xl cursor-pointer relative overflow-hidden group transition-all hover:-translate-y-1 ${
                      isHighlight ? 'bg-brand-900/40 border-brand-500/30 shadow-lg shadow-brand-500/10' : ''
                    }`}
                  >
                    {isHighlight && (
                      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-brand-600/30 to-transparent pointer-events-none" />
                    )}

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex items-center space-x-2 text-xs text-brand-400">
                        <span className={`w-2 h-2 rounded-full ${isHighlight ? 'bg-brand-400' : 'bg-brand-500'}`}></span>
                        <span>{formatDate(session.startedAt || session.createdAt)}</span>
                      </div>
                      <div className="flex space-x-2">
                        {isHighlight && (
                          <div className="flex items-center space-x-1 bg-navy-800/80 px-2 py-1 rounded-lg text-[10px] text-slate-300">
                            <Folder className="w-3 h-3" />
                            <span>6 Files</span>
                          </div>
                        )}
                        <button className="w-8 h-8 rounded-full bg-navy-800/80 flex items-center justify-center text-slate-400 hover:text-white transition">
                          {isHighlight ? <Bell className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                        </button>
                        <button className="w-8 h-8 rounded-full bg-navy-800/80 flex items-center justify-center text-slate-400 hover:text-white transition">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 mb-3 relative z-10">
                      {isHighlight && (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-indigo-600 flex items-center justify-center shadow-lg">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-brand-300 transition-colors">
                          {session.selectedActivity || 'Focus Session'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          Description : {session.description || 'completed deep work session for productivity...'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500 mb-6 relative z-10">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Duration: {formatSeconds(actualSec)}</span>
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 mr-2">Participants :</span>
                        <span className="px-2 py-1 bg-navy-800 rounded-md text-[10px] text-slate-300 border border-slate-700">Design team</span>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-slate-400">Progress :</span>
                          <div className="w-32 h-2.5 bg-navy-950 rounded-full overflow-hidden border border-slate-800">
                            <div className="h-full bg-gradient-to-r from-brand-500 to-brand-300 rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-navy-800 rounded-md text-[10px] text-white border border-slate-700 font-medium">%{progress}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Widgets) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Note Widget */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden bg-brand-900/30 border-brand-500/20">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-brand-400/10 to-transparent pointer-events-none" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <h3 className="text-white font-semibold">Monthly summary</h3>
              <button className="w-8 h-8 rounded-full bg-navy-900/80 flex items-center justify-center text-slate-300 hover:text-white transition border border-slate-700">
                <Calendar className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-6 relative z-10">
              Going to the company and <strong className="text-white">planning meetings</strong> for the month ahead 🎯
            </p>
            
            <div className="flex flex-col space-y-3 relative z-10">
              <div className="flex justify-between items-center bg-navy-950/50 p-2.5 rounded-xl border border-slate-700/30">
                <span className="text-xs text-slate-400">Total Active</span>
                <span className="text-sm font-bold text-white">{formatSeconds(monthly.metrics?.totalActiveSec)}</span>
              </div>
              <div className="flex justify-between items-center bg-navy-950/50 p-2.5 rounded-xl border border-slate-700/30">
                <span className="text-xs text-slate-400">Study Ratio</span>
                <span className="text-sm font-bold text-brand-400">{monthly.metrics?.studyPercentage || 0}%</span>
              </div>
            </div>
          </div>

          {/* Activity Chart Widget */}
          <div className="glass-panel p-6 rounded-3xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-white font-semibold mb-1">Activity</h3>
                <p className="text-xs text-amber-400">{weekly.days?.reduce((acc, curr) => acc + (curr.sessionCount || 0), 0) || 0} Tasks Completed 👏</p>
              </div>
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-900/40 border border-brand-500/30 text-xs text-white">
                <span>Get the report</span>
                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 flex items-center justify-center">
                  <ChevronRight className="w-3 h-3 text-white" />
                </span>
              </button>
            </div>
            
            {/* The existing chart component, customized if needed or just wrapped */}
            <div className="h-40 w-full mt-4 bg-navy-950/30 rounded-xl p-2 border border-slate-800 overflow-hidden">
               <WeeklyActivityChart weeklyData={weekly.days || []} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
