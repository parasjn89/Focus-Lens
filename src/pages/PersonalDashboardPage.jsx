import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, BookOpen, Smartphone, HelpCircle, ChevronRight, Award, Flame, RefreshCw, Calendar, Target, Compass } from 'lucide-react';
import { apiFetch } from '../api/client';
import { WeeklyActivityChart } from '../components/WeeklyActivityChart';
import { useAuth } from '../context/AuthContext';

export function PersonalDashboardPage({ onSelectSession, onNewSession, onNavigate }) {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [coachPreview, setCoachPreview] = useState(null);
  const [consistencyData, setConsistencyData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/dashboard');
      setDashboardData(res.dashboard);
      const coachRes = await apiFetch('/api/analytics/focus-coach').catch(() => null);
      if (coachRes) setCoachPreview(coachRes);
      const consistencyRes = await apiFetch('/api/analytics/consistency', {
        headers: {
          'X-Timezone-Offset': new Date().getTimezoneOffset().toString(),
        }
      }).catch(() => null);
      if (consistencyRes) setConsistencyData(consistencyRes);
      const recRes = await apiFetch('/api/analytics/recommended-session').catch(() => null);
      if (recRes) setRecommendationData(recRes);
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

      {/* Focus Points & Level Card */}
      {dashboardData?.focusPoints && (
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-brand-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Award className="w-36 h-36 text-brand-400" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="px-2.5 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-brand-400" />
                  <span>Focus Points System</span>
                </div>
              </div>

              <div className="flex items-baseline space-x-3 pt-1">
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {dashboardData.focusPoints.total || 0}
                </span>
                <span className="text-sm font-semibold text-slate-400">Total Focus Points</span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
                <span>Today: <strong className="text-emerald-400 font-bold">+{dashboardData.focusPoints.today || 0} pts</strong></span>
                <span>•</span>
                <span>This Week: <strong className="text-brand-300 font-bold">+{dashboardData.focusPoints.weekly || 0} pts</strong></span>
              </div>
            </div>

            {/* Level Badge & Progress */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 min-w-[280px] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Current Level</span>
                <span className="text-xs px-3 py-1 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/40 font-extrabold tracking-wide uppercase">
                  {dashboardData.focusPoints.levelInfo?.level || 'Beginner'}
                </span>
              </div>

              {!dashboardData.focusPoints.levelInfo?.isMaxLevel ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1.5">
                    <span>Progress to {dashboardData.focusPoints.levelInfo?.nextLevel}</span>
                    <span className="font-mono text-slate-200">
                      {dashboardData.focusPoints.levelInfo?.pointsInLevel || 0} / {(dashboardData.focusPoints.levelInfo?.pointsInLevel || 0) + (dashboardData.focusPoints.levelInfo?.pointsToNextLevel || 0)} pts
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full transition-all duration-500"
                      style={{ width: `${dashboardData.focusPoints.levelInfo?.progressPercent || 0}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 text-right mt-1.5 font-medium">
                    <span className="text-emerald-400 font-bold">{dashboardData.focusPoints.levelInfo?.pointsToNextLevel} points</span> to {dashboardData.focusPoints.levelInfo?.nextLevel}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-emerald-400 font-bold pt-1 text-center">
                  Highest Rank Achieved — Focus Master
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Focus Streak Compact Dashboard Card */}
      {consistencyData && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-950 border border-amber-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">FOCUS STREAK</span>
                {consistencyData.todayFocused && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✓ Focus day complete
                  </span>
                )}
              </div>
              <div className="flex items-baseline space-x-3 mt-1">
                <span className="text-2xl font-black text-white flex items-center">
                  🔥 {consistencyData.currentStreak} {consistencyData.currentStreak === 1 ? 'day' : 'days'}
                </span>
                <span className="text-xs text-slate-400">
                  Best: <strong className="text-amber-300 font-bold">{consistencyData.bestStreak} days</strong>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                This week: <strong className="text-slate-200">{consistencyData.thisWeek?.focusDays || 0} / {consistencyData.thisWeek?.eligibleDays || 7} focus days</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('consistency')}
            className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 transition-all shrink-0 self-end sm:self-center"
          >
            <span>View Consistency</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Adaptive Session Recommendation Compact Card */}
      {recommendationData && (
        <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">NEXT SESSION RECOMMENDATION</span>
                {recommendationData.available && recommendationData.recommendation?.confidence && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {recommendationData.recommendation.confidence} confidence
                  </span>
                )}
              </div>

              {recommendationData.available ? (
                <>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-white">
                      {recommendationData.recommendation.durationMinutes} minutes
                    </span>
                    {recommendationData.recommendation.goalText && (
                      <span className="text-sm font-medium text-slate-300">
                        • {recommendationData.recommendation.goalText}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 italic">
                    "{recommendationData.recommendation.reason}"
                  </p>
                </>
              ) : (
                <>
                  <h4 className="text-base font-bold text-slate-200">Complete a few more sessions</h4>
                  <p className="text-xs text-slate-400">
                    FocusLens needs at least 5 completed sessions to personalize recommendations. ({recommendationData.sessionsCompleted || 0}/5 completed)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 self-end md:self-center">
            <button
              onClick={() => onNavigate && onNavigate('recommendations')}
              className="flex items-center space-x-1.5 text-xs font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md shadow-emerald-900/30 transition-all"
            >
              <span>View Recommendation</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Focus Coach Card */}
      {coachPreview && !coachPreview.insufficientData && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Focus Coach Suggestion</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">{coachPreview.recommendation}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{coachPreview.reason}</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('coach')}
            className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all shrink-0 self-end sm:self-center"
          >
            <span>View Focus Coach</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Goal Sessions Summary Card */}
      {dashboardData?.goals && dashboardData.goals.totalGoalSessions > 0 && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Goal Sessions Summary</h3>
              <p className="text-xs text-slate-400">Tracked performance across goal-based focus sessions</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-medium">
            <div className="text-center sm:text-left">
              <span className="text-slate-400 block text-[11px]">Goal Sessions</span>
              <span className="text-lg font-black text-white font-mono">{dashboardData.goals.totalGoalSessions}</span>
            </div>
            <div className="w-px h-8 bg-slate-800 hidden sm:block" />
            <div className="text-center sm:text-left">
              <span className="text-slate-400 block text-[11px]">Goals Completed</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{dashboardData.goals.goalsCompleted}</span>
            </div>
            <div className="w-px h-8 bg-slate-800 hidden sm:block" />
            <div className="text-center sm:text-left">
              <span className="text-slate-400 block text-[11px]">Completion Rate</span>
              <span className="text-lg font-black text-brand-300 font-mono">{dashboardData.goals.completionRate}%</span>
            </div>
          </div>
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

      {/* Section A2: Deep Work & Personal Best */}
      {dashboardData?.deepWork && (
        <div className="mt-6 p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Deep Work Performance</h3>
                <p className="text-xs text-slate-400">Longest uninterrupted study-like activity</p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Personal Record Metrics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Today's Longest Deep Work Block */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">Longest Deep Work Block (Today)</span>
              <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">
                {dashboardData.deepWork.todayLongestText || '0m 0s'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">Today's best continuous focus</span>
            </div>

            {/* This Week's Longest Block */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">This Week's Longest Block</span>
              <span className="text-2xl font-black text-brand-300 font-mono block mt-1">
                {dashboardData.deepWork.weeklyLongestText || '0m 0s'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">Past 7 days continuous peak</span>
            </div>

            {/* Personal Best */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/50 to-slate-950 border border-emerald-500/40">
              <span className="text-emerald-300 font-bold block">Personal Best</span>
              <span className="text-2xl font-black text-white font-mono block mt-1">
                {dashboardData.deepWork.personalBestText || '0m 0s'}
              </span>
              <span className="text-[10px] text-emerald-400/80 block mt-1">
                All-time longest uninterrupted focus block across completed sessions
              </span>
            </div>
          </div>
        </div>
      )}

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
