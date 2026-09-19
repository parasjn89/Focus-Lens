import React, { useState, useEffect, useRef } from 'react';
import { Clock, Flame, RefreshCw, Compass, Filter, ChevronDown, Check, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function PersonalDashboardPage({ onSelectSession, onNewSession, onNavigate }) {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [consistencyData, setConsistencyData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Category filter state: 'ALL' | 'Study' | 'Coding' | 'Other'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/dashboard');
      setDashboardData(res.dashboard);
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

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
        <p className="text-sm font-medium">Loading personal focus dashboard...</p>
      </div>
    );
  }

  const today = dashboardData?.today || {};

  // Compute category-filtered metrics for Today's Focus
  let displayFocusSeconds = today.totalActiveSec || 0;
  let displayCategoryLabel = 'All Work';

  if (selectedCategory === 'Study') {
    displayFocusSeconds = today.totalStudyLikeSec || 0;
    displayCategoryLabel = 'Study';
  } else if (selectedCategory === 'Coding') {
    displayFocusSeconds = today.totalCodingSec || 0;
    displayCategoryLabel = 'Coding';
  } else if (selectedCategory === 'Other') {
    displayFocusSeconds = Math.max(0, (today.totalActiveSec || 0) - ((today.totalStudyLikeSec || 0) + (today.totalCodingSec || 0)));
    displayCategoryLabel = 'Other';
  }

  const focusPercentage = today.studyPercentage !== undefined ? today.studyPercentage : 100;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      
      {/* =========================================
          1. HEADER
      ========================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-800/60 relative z-20">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Focus Better Today!
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">
            Welcome back, <span className="font-semibold text-white">{user?.name || user?.email || 'Focus Champion'}</span>.
          </p>
        </div>

        {/* Action Controls: All Work, Filter, Refresh, New task */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-sm relative z-20">
            {/* All Work Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setIsFilterOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Show all focus activity"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedCategory === 'ALL' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span>All Work</span>
            </button>

            {/* Filter Dropdown */}
            <div className="relative z-30" ref={filterRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                  selectedCategory !== 'ALL'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                aria-expanded={isFilterOpen}
                aria-haspopup="true"
                title="Filter by category"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{selectedCategory !== 'ALL' ? selectedCategory : 'Filter'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Glassmorphic Dropdown Popover */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1">
                    Categories
                  </div>

                  {/* 1. Study */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('Study');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      selectedCategory === 'Study'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>Study</span>
                    </div>
                    {selectedCategory === 'Study' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>

                  {/* 2. Coding */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('Coding');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      selectedCategory === 'Coding'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span>Coding</span>
                    </div>
                    {selectedCategory === 'Coding' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>

                  {/* 3. Other */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('Other');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      selectedCategory === 'Other'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Other</span>
                    </div>
                    {selectedCategory === 'Other' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>

                  {/* Clear filter / Show All Work */}
                  {selectedCategory !== 'ALL' && (
                    <div className="pt-1 mt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('ALL');
                          setIsFilterOpen(false);
                        }}
                        className="w-full flex items-center justify-center py-1.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition cursor-pointer"
                      >
                        Show All Work
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchDashboard}
            className="w-9 h-9 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer shadow-sm"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* New Task Button */}
          <button
            type="button"
            onClick={onNewSession}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs sm:text-sm font-semibold shadow-md shadow-cyan-950/30 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
          >
            New task
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* =========================================
          MAIN CALM WORKSPACE LAYOUT
      ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start relative z-0">
        
        {/* LEFT COLUMN: TODAY'S FOCUS (PRIMARY) + FOCUS STREAK (COMPACT) */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          
          {/* 2. TODAY'S FOCUS — PRIMARY SECTION */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/70 to-slate-950/80 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6 relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ring-4 ring-cyan-500/20" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Today's Focus
                </span>
              </div>
              {selectedCategory !== 'ALL' && (
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
                  {displayCategoryLabel}
                </span>
              )}
            </div>

            {/* Big Focus Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 relative z-10">
              {/* Total Focus Time */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Total Focus Time
                </span>
                <span className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight block">
                  {formatSeconds(displayFocusSeconds)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {selectedCategory === 'ALL' ? 'Across all categories today' : `Today's ${displayCategoryLabel.toLowerCase()} time`}
                </span>
              </div>

              {/* Sessions Count */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Sessions Completed
                </span>
                <span className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-200 tracking-tight block">
                  {today.sessionCount || 0}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Focused intervals logged
                </span>
              </div>

              {/* Focus Score / Progress */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                  Focus Score
                </span>
                <span className="text-3xl sm:text-4xl font-mono font-extrabold text-teal-400 tracking-tight block">
                  {focusPercentage}%
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Productive ratio
                </span>
              </div>
            </div>

            {/* Focus Progress Bar */}
            <div className="pt-2 relative z-10 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Daily Focus Progress</span>
                <span className="font-mono text-cyan-400 font-semibold">{focusPercentage}%</span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, Math.max(5, focusPercentage))}%` }} 
                />
              </div>
            </div>
          </div>

          {/* 3. FOCUS STREAK — COMPACT */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Focus Streak
                  </span>
                  {consistencyData?.todayFocused && (
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      ✓ Focused today
                    </span>
                  )}
                </div>
                <div className="flex items-baseline space-x-2 mt-0.5">
                  <span className="text-xl font-extrabold text-white font-mono">
                    {consistencyData?.currentStreak || 0} {consistencyData?.currentStreak === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs text-slate-400 border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-3 sm:pt-0 sm:pl-6">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Best Streak</span>
                <span className="font-semibold text-slate-200 font-mono text-sm">{consistencyData?.bestStreak || 0} days</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">This Week</span>
                <span className="font-semibold text-slate-200 font-mono text-sm">
                  {consistencyData?.thisWeek?.focusDays || 0} / {consistencyData?.thisWeek?.eligibleDays || 7} days
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: NEXT SESSION (COMPACT) + MINIMAL SHORTCUTS */}
        <div className="lg:col-span-1 min-w-0 space-y-6">
          
          {/* 4. NEXT SESSION (VISUAL & ENGAGING RECOMMENDATION) */}
          <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-500/35 shadow-xl shadow-cyan-950/20 transition-all duration-300 group space-y-5">
            {/* Ambient soft glow & inner highlight */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-400/[0.04] to-transparent pointer-events-none" />

            {/* TOP ROW */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/50">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Next Session</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Recommended for peak focus</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/30">
                {recommendationData?.available && recommendationData.recommendation?.confidence
                  ? recommendationData.recommendation.confidence
                  : 'HIGH'}
              </span>
            </div>

            {/* MAIN CONTENT & DECORATIVE FOCUS TIMER VISUAL */}
            <div className="relative z-10 flex items-center justify-between gap-4 pt-1">
              {/* Left: Duration and Insight */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight flex items-baseline gap-1.5">
                  <span>
                    {recommendationData?.available && recommendationData.recommendation?.durationMinutes
                      ? recommendationData.recommendation.durationMinutes
                      : 25}
                  </span>
                  <span className="text-base sm:text-lg font-sans font-semibold text-cyan-400">min</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-3">
                  "{recommendationData?.available && recommendationData.recommendation?.reason
                    ? recommendationData.recommendation.reason
                    : 'Your recent sessions produce strong focus around 26 minutes.'}"
                </p>
              </div>

              {/* Right: Elegant circular timer / clock illustration */}
              <div className="relative shrink-0 w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center pointer-events-none select-none">
                {/* Ambient circular soft glow */}
                <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl motion-safe:animate-pulse" style={{ animationDuration: '4s' }} />

                <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                  <defs>
                    <linearGradient id="recTimerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.3" />
                    </linearGradient>
                    <radialGradient id="recGlassGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Abstract inner glass fill */}
                  <circle cx="50" cy="50" r="42" fill="url(#recGlassGlow)" />

                  {/* Outer subtle ticks / track with slow ambient rotation */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.15)"
                    strokeWidth="1.5"
                    strokeDasharray="3 5"
                    className="motion-safe:animate-[spin_90s_linear_infinite] origin-center"
                  />

                  {/* Background ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke="rgba(30, 41, 59, 0.6)"
                    strokeWidth="3"
                  />

                  {/* Elegant Cyan/Teal Progress Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke="url(#recTimerGrad)"
                    strokeWidth="3"
                    strokeDasharray="226"
                    strokeDashoffset="75"
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />

                  {/* Center dial and hands */}
                  <circle cx="50" cy="50" r="3" fill="#38bdf8" />
                  <line x1="50" y1="50" x2="50" y2="28" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
                  <line x1="50" y1="50" x2="64" y2="50" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />

                  {/* Focus dial indicator dots */}
                  <circle cx="50" cy="18" r="1.5" fill="#38bdf8" opacity="0.9" />
                  <circle cx="82" cy="50" r="1.5" fill="#2dd4bf" opacity="0.6" />
                  <circle cx="50" cy="82" r="1.5" fill="#94a3b8" opacity="0.4" />
                  <circle cx="18" cy="50" r="1.5" fill="#94a3b8" opacity="0.4" />
                </svg>
              </div>
            </div>

            {/* CTA: Premium glass/gradient button */}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('recommendations')}
              className="relative z-10 w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/15 via-teal-500/10 to-cyan-500/15 hover:from-cyan-500/25 hover:via-teal-500/20 hover:to-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/50 text-xs font-semibold text-cyan-200 hover:text-white shadow-sm shadow-cyan-950/50 hover:shadow-cyan-500/10 transition-all duration-200 cursor-pointer group/btn"
            >
              <span>View Recommendation</span>
              <span className="text-cyan-400 group-hover/btn:translate-x-0.5 transition-transform duration-200">
                &rarr;
              </span>
            </button>
          </div>

          {/* Minimal Quick Action: Weekly Review shortcut */}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('weekly-review')}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 text-xs text-slate-400 hover:text-white transition group shrink-0 cursor-pointer shadow-sm"
          >
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              <span className="font-semibold text-slate-300 group-hover:text-white transition-colors">
                Weekly review
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
          </button>

        </div>

      </div>

    </div>
  );
}
