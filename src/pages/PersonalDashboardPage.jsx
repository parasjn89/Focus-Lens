import React, { useState, useEffect, useRef } from 'react';
import { Clock, Flame, RefreshCw, Compass, Filter, ChevronDown, Check, ChevronRight, Sparkles, Trophy, Zap, Calendar, Target, Info, X, Layers, TrendingUp } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FOCUS_LEVELS } from '../utils/focusPoints';
import { getUserSettings } from '../utils/userSettings';

export function PersonalDashboardPage({ onSelectSession, onNewSession, onNavigate }) {
  const { user } = useAuth();
  const [userSettings, setUserSettings] = useState(() => getUserSettings());
  const [dashboardData, setDashboardData] = useState(null);
  const [consistencyData, setConsistencyData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Category filter state: initialized from user settings ('ALL' | 'Study' | 'Coding' | 'Other')
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return getUserSettings()?.defaultCategory || 'ALL';
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [isCardFilterOpen, setIsCardFilterOpen] = useState(false);
  const cardFilterRef = useRef(null);
  const [showPointsInfo, setShowPointsInfo] = useState(false);

  // Listen for user settings changes in realtime
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      if (e?.detail) {
        setUserSettings(e.detail);
      } else {
        setUserSettings(getUserSettings());
      }
    };
    window.addEventListener('focuslens_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('focuslens_settings_updated', handleSettingsUpdate);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (cardFilterRef.current && !cardFilterRef.current.contains(event.target)) {
        setIsCardFilterOpen(false);
      }
    }
    if (isFilterOpen || isCardFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen, isCardFilterOpen]);

  const fetchDashboard = async (categoryParam, isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);
    try {
      const tzOffset = new Date().getTimezoneOffset().toString();
      const targetCat = (typeof categoryParam === 'string' && categoryParam) ? categoryParam : selectedCategory;
      const url = targetCat && targetCat !== 'ALL'
        ? `/api/analytics/dashboard?category=${encodeURIComponent(targetCat)}`
        : '/api/analytics/dashboard';
      const res = await apiFetch(url, {
        headers: {
          'X-Timezone-Offset': tzOffset,
        },
      });
      if (res && res.dashboard) {
        setDashboardData(res.dashboard);
      }
      const consistencyRes = await apiFetch('/api/analytics/consistency', {
        headers: {
          'X-Timezone-Offset': tzOffset,
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

  const isInitialMount = useRef(true);

  const handleCategoryChange = (category) => {
    const validCat = (category === 'Study' || category === 'Coding' || category === 'Other') ? category : 'ALL';
    if (validCat === 'ALL') {
      setSelectedCategory('ALL');
    } else {
      setSelectedCategory(validCat);
    }
    setIsFilterOpen(false);
    setIsCardFilterOpen(false);
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchDashboard(selectedCategory, true);
    } else {
      fetchDashboard(selectedCategory, false);
    }
  }, [selectedCategory]);

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
  const categories = dashboardData?.categories || {};

  // Derive strictly category-isolated metrics for Today's Focus
  const activeToday = (categories && categories[selectedCategory])
    ? categories[selectedCategory]
    : (selectedCategory === 'ALL'
        ? today
        : (dashboardData?.selectedCategory === selectedCategory ? today : { sessionCount: 0, totalActiveSec: 0, studyPercentage: 0, focusScore: 0 }));

  const displayFocusSeconds = activeToday.totalActiveSec || 0;
  const displaySessionCount = activeToday.sessionCount || 0;
  const displayCategoryLabel = selectedCategory === 'ALL' ? 'All Work' : selectedCategory;

  // Strict empty-state rule: if 0 sessions completed in category, focusScore MUST be 0%
  const focusPercentage = displaySessionCount > 0
    ? (activeToday.studyPercentage !== undefined ? activeToday.studyPercentage : (activeToday.focusScore || 0))
    : 0;

  let focusTimeSubtext = 'Across all categories today';
  if (selectedCategory === 'Study') {
    focusTimeSubtext = displayFocusSeconds > 0 ? "Today's study time" : 'No study time today';
  } else if (selectedCategory === 'Coding') {
    focusTimeSubtext = displayFocusSeconds > 0 ? "Today's coding time" : 'No coding time today';
  } else if (selectedCategory === 'Other') {
    focusTimeSubtext = displayFocusSeconds > 0 ? "Today's other time" : 'No other time today';
  } else if (displayFocusSeconds === 0) {
    focusTimeSubtext = 'No focus logged today';
  }

  const sessionsSubtext = displaySessionCount === 1 ? 'Focused interval' : 'Focused intervals';
  const scoreSubtext = displaySessionCount > 0 ? 'Productive ratio' : 'No sessions recorded';

  // Focus Points & Gamification Stage Metrics
  const focusPointsData = dashboardData?.focusPoints || {};
  const todayPoints = focusPointsData.todayPoints ?? focusPointsData.today ?? 0;
  const weekPoints = focusPointsData.weekPoints ?? focusPointsData.weekly ?? 0;
  const lifetimePoints = focusPointsData.lifetimePoints ?? focusPointsData.total ?? 0;
  const levelInfo = focusPointsData.levelInfo || {};
  const currentStage = focusPointsData.currentStage || levelInfo.level || 'Beginner';
  const currentStagePoints = focusPointsData.currentStagePoints ?? levelInfo.pointsInLevel ?? 0;
  const nextStage = focusPointsData.nextStage ?? levelInfo.nextLevel;
  const nextStagePoints = focusPointsData.nextStagePoints ?? levelInfo.nextLevelMinPoints;
  const stageMinPoints = levelInfo.levelMinPoints ?? 0;
  const stageSpan = nextStagePoints ? (nextStagePoints - stageMinPoints) : 300;
  const pointsToNextStage = focusPointsData.pointsToNextStage ?? levelInfo.pointsToNextLevel ?? 300;
  const progressPercent = focusPointsData.progressPercent ?? levelInfo.progressPercent ?? 0;
  const isMaxStage = focusPointsData.isMaxStage ?? levelInfo.isMaxLevel ?? (lifetimePoints >= 1500);

  const levelIndex = Array.isArray(FOCUS_LEVELS) ? FOCUS_LEVELS.findIndex(l => l.name === currentStage) : -1;
  const levelNumber = levelIndex >= 0 ? levelIndex + 1 : 1;

  const STAGE_MOTIVATIONS = {
    'Beginner': "Start small, build momentum. Every minute counts!",
    'Focused': "Great rhythm! You're locking into deep flow.",
    'Consistent': "Stay consistent. You're doing great!",
    'Deep Worker': "Exceptional focus stamina. Pushing peak performance!",
    'Focus Master': "Mastery achieved! You are operating at peak potential.",
  };
  const currentMotivation = STAGE_MOTIVATIONS[currentStage] || "Stay consistent. You're doing great!";

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
              onClick={() => handleCategoryChange('ALL')}
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
                    onClick={() => handleCategoryChange('Study')}
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
                    onClick={() => handleCategoryChange('Coding')}
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
                    onClick={() => handleCategoryChange('Other')}
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
                        onClick={() => handleCategoryChange('ALL')}
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
          
          {/* 2. TODAY'S FOCUS — PRIMARY SECTION (CLEAN & MODERN) */}
          <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6 relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Card Header: Status Dot, Title, and Category Dropdown */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse ring-4 ring-cyan-500/20" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Today's Focus
                </span>
              </div>

              {/* In-Card Category Selector [Category ▼] */}
              <div className="relative z-20" ref={cardFilterRef}>
                <button
                  type="button"
                  onClick={() => setIsCardFilterOpen(prev => !prev)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 text-slate-200 hover:text-white shadow-sm"
                  aria-expanded={isCardFilterOpen}
                  title="Filter category"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedCategory === 'Study' ? 'bg-indigo-400' :
                    selectedCategory === 'Coding' ? 'bg-teal-400' :
                    selectedCategory === 'Other' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  <span>{selectedCategory === 'ALL' ? 'All Work' : selectedCategory}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isCardFilterOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Card Category Dropdown Popover */}
                {isCardFilterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1">
                      Category
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('ALL')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                        selectedCategory === 'ALL'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>All Work</span>
                      </div>
                      {selectedCategory === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('Study')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                        selectedCategory === 'Study'
                          ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>Study</span>
                      </div>
                      {selectedCategory === 'Study' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('Coding')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                        selectedCategory === 'Coding'
                          ? 'bg-teal-500/20 text-teal-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                        <span>Coding</span>
                      </div>
                      {selectedCategory === 'Coding' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('Other')}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                        selectedCategory === 'Other'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Other</span>
                      </div>
                      {selectedCategory === 'Other' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Row with Subtle Vertical Dividers */}
            <div className={`grid grid-cols-1 ${userSettings?.showFocusScore !== false ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 pt-1 relative z-10`}>
              {/* Metric 1: Total Focus Time */}
              <div className="pb-4 sm:pb-0 sm:pr-6 space-y-1.5">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400/80" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Total Focus Time
                  </span>
                </div>
                <span className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight block">
                  {formatSeconds(displayFocusSeconds)}
                </span>
                <span className="text-xs text-slate-500 block">
                  {focusTimeSubtext}
                </span>
              </div>

              {/* Metric 2: Sessions Completed */}
              <div className={`py-4 sm:py-0 ${userSettings?.showFocusScore !== false ? 'sm:px-6' : 'sm:pl-6'} space-y-1.5`}>
                <div className="flex items-center space-x-2 text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-indigo-400/80" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Sessions Completed
                  </span>
                </div>
                <span className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-100 tracking-tight block">
                  {displaySessionCount}
                </span>
                <span className="text-xs text-slate-500 block">
                  {sessionsSubtext}
                </span>
              </div>

              {/* Metric 3: Focus Score */}
              {userSettings?.showFocusScore !== false && (
                <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <TrendingUp className="w-3.5 h-3.5 text-teal-400/80" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Focus Score
                    </span>
                  </div>
                  <span className="text-3xl sm:text-4xl font-mono font-extrabold text-teal-400 tracking-tight block">
                    {focusPercentage}%
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {scoreSubtext}
                  </span>
                </div>
              )}
            </div>

            {/* Daily Focus Progress */}
            <div className="pt-2 relative z-10 space-y-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span className="text-slate-300 font-semibold">Daily Focus Progress</span>
                <span className="font-mono text-cyan-400 font-bold">{focusPercentage}%</span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden ring-1 ring-white/5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-700 shadow-sm shadow-cyan-500/20" 
                  style={{ width: `${focusPercentage === 0 ? 0 : Math.min(100, Math.max(4, focusPercentage))}%` }} 
                />
              </div>
            </div>
          </div>

          {/* 3. FOCUS STREAK — COMPACT */}
          {userSettings?.showFocusStreak !== false && (
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
          )}

          {/* 3.5. GAMIFIED FOCUS POINTS BLOCK */}
          {userSettings?.showFocusPoints !== false && (
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/70 to-slate-950/80 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6 relative overflow-hidden">
              {/* Ambient subtle background glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* TOP ROW: Title on left, [ Level X ] and [ ⓘ ] on right */}
            <div className="flex items-start justify-between gap-4 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 shadow-sm shadow-amber-950/40 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wider uppercase font-mono">
                    Focus Points
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Your journey to a better you
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-gradient-to-r from-cyan-500/15 via-teal-500/15 to-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/40">
                  Level {levelNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPointsInfo(prev => !prev)}
                  className="p-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-colors cursor-pointer"
                  title="How Focus Points work"
                  aria-label="How Focus Points work"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Collapsible Info Card */}
            {showPointsInfo && (
              <div className="relative z-20 p-4 rounded-2xl bg-slate-950/95 border border-cyan-500/30 shadow-2xl space-y-2 text-xs text-slate-300 animate-in fade-in duration-200">
                <div className="flex items-center justify-between font-bold text-white text-[11px] uppercase tracking-wider border-b border-slate-800 pb-1.5">
                  <div className="flex items-center space-x-1.5 text-cyan-400">
                    <Info className="w-3.5 h-3.5" />
                    <span>How Focus Points Work</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPointsInfo(false)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-300 leading-relaxed list-disc list-inside">
                  <li>Earn <strong>1 Focus Point</strong> per 60 seconds of qualifying focused activity (Study, Coding, Document work).</li>
                  <li>Distractions like phone usage, browser entertainment, and absence produce <strong>0 points</strong>.</li>
                  <li>Points accumulate across all sessions to level up your stage: Beginner &rarr; Focused &rarr; Consistent &rarr; Deep Worker &rarr; Focus Master.</li>
                </ul>
              </div>
            )}

            {/* GAMIFIED STAGE VISUAL / GROWTH ILLUSTRATION */}
            <div className="flex items-center justify-center py-2 relative z-10">
              <div className="relative flex items-center justify-center">
                {/* Ambient radial glow */}
                <div className="absolute inset-0 w-28 h-28 -m-3 bg-gradient-to-tr from-cyan-500/15 via-teal-500/10 to-transparent rounded-full blur-xl pointer-events-none" />

                {/* Stage Emblem SVG */}
                <svg viewBox="0 0 100 80" className="w-24 h-20 relative z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  <defs>
                    <linearGradient id="emblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.7" />
                    </linearGradient>
                    <linearGradient id="crestFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>

                  {/* Hexagonal Shield Outline */}
                  <polygon
                    points="50,4 88,22 88,58 50,76 12,58 12,22"
                    fill="url(#crestFill)"
                    stroke="url(#emblemGrad)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />

                  {/* Inner subtle concentric contour */}
                  <polygon
                    points="50,11 81,26 81,54 50,69 19,54 19,26"
                    fill="none"
                    stroke="rgba(6, 182, 212, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />

                  {/* Center Trophy Symbol */}
                  <path
                    d="M38 28 H62 V38 C62 44 56 48 50 48 C44 48 38 44 38 38 Z"
                    fill="none"
                    stroke="url(#emblemGrad)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M50 48 V56" stroke="url(#emblemGrad)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M42 56 H58" stroke="url(#emblemGrad)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M38 32 H33 C30.5 32 30.5 38 33 38 H38" stroke="url(#emblemGrad)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M62 32 H67 C69.5 32 69.5 38 67 38 H62" stroke="url(#emblemGrad)" strokeWidth="1.5" strokeLinecap="round" />

                  {/* Star in Cup */}
                  <circle cx="50" cy="36" r="2.5" fill="#38bdf8" />

                  {/* 5 Stage Progress Nodes */}
                  {[
                    { cx: 28, cy: 68 },
                    { cx: 39, cy: 72 },
                    { cx: 50, cy: 74 },
                    { cx: 61, cy: 72 },
                    { cx: 72, cy: 68 },
                  ].map((pt, i) => {
                    const isActive = i + 1 <= levelNumber;
                    return (
                      <circle
                        key={i}
                        cx={pt.cx}
                        cy={pt.cy}
                        r={i + 1 === levelNumber ? 2.5 : 2}
                        fill={isActive ? '#38bdf8' : '#334155'}
                        className={isActive ? 'drop-shadow-[0_0_4px_#38bdf8]' : ''}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* STAGE NAME, MOTIVATION & POINTS RATIO */}
            <div className="space-y-2.5 relative z-10">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {currentStage}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {currentMotivation}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-sm sm:text-base font-extrabold text-white">
                    {isMaxStage ? (
                      <span className="text-teal-400">{lifetimePoints.toLocaleString()} pts</span>
                    ) : (
                      <>
                        <span className="text-cyan-400">{lifetimePoints.toLocaleString()}</span>
                        <span className="text-slate-500 font-medium"> / </span>
                        <span className="text-slate-300">{(nextStagePoints || lifetimePoints).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-700 shadow-sm shadow-cyan-500/30"
                  style={{ width: `${Math.min(100, Math.max(isMaxStage ? 100 : 3, progressPercent))}%` }}
                />
              </div>

              {/* Points Remaining to Next Stage */}
              <div className="text-xs text-slate-400 font-medium">
                {isMaxStage ? (
                  <span className="text-teal-400 font-semibold">★ Maximum stage reached • Peak Focus Master</span>
                ) : (
                  <span>
                    <strong className="text-white font-mono">{pointsToNextStage.toLocaleString()}</strong> points to next stage
                  </span>
                )}
              </div>
            </div>

            {/* THREE STAT BLOCKS: TODAY | THIS WEEK | LIFETIME */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 pt-1">
              {/* Today */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1.5">
                <div className="flex items-center space-x-2 text-white font-mono font-bold text-lg sm:text-xl">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{todayPoints.toLocaleString()}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                  Today
                </span>
              </div>

              {/* This Week */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1.5">
                <div className="flex items-center space-x-2 text-white font-mono font-bold text-lg sm:text-xl">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{weekPoints.toLocaleString()}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                  This Week
                </span>
              </div>

              {/* Lifetime */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1.5">
                <div className="flex items-center space-x-2 text-teal-300 font-mono font-bold text-lg sm:text-xl">
                  <Target className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{lifetimePoints.toLocaleString()}</span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                  Lifetime
                </span>
              </div>
            </div>
          </div>
        )}

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
