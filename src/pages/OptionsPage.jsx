import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Shield,
  ShieldCheck,
  Camera,
  Monitor,
  Calendar,
  LayoutDashboard,
  Bell,
  Palette,
  User,
  Check,
  Smartphone,
  Compass,
  Sparkles,
  RefreshCw,
  LogOut,
  ExternalLink,
  ChevronRight,
  Trash2,
  Lock,
  Flame,
  CheckCircle2,
  LayoutGrid,
  ChevronDown,
  HelpCircle,
  X,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserSettings,
  saveUserSettings,
  resetUserSettings,
  clearLocalSessionCache,
  loadUserSettingsFromServer,
} from '../utils/userSettings';
import {
  fetchGoogleCalendarStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from '../api/googleCalendarApi';
import { apiFetch } from '../api/client';

export function OptionsPage({ onNavigate }) {
  const { user, logout } = useAuth();

  // Settings state from reactive userSettings
  const [settings, setSettings] = useState(() => getUserSettings());
  const [toastMessage, setToastMessage] = useState(null);

  // Active section in Left Sidebar ('overview' by default)
  const [activeSection, setActiveSection] = useState('overview');

  // Real Focus Analytics data for Right Sidebar
  const [dashboardData, setDashboardData] = useState(null);
  const [consistencyData, setConsistencyData] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('week'); // 'week' | 'today' | 'month'
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Google Calendar Integration state
  const [calendarStatus, setCalendarStatus] = useState({
    loading: true,
    connected: false,
    email: null,
    error: null,
  });
  const [isDisconnectingCalendar, setIsDisconnectingCalendar] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);

  // Help Modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Local storage cache clearing state
  const [cacheClearInfo, setCacheClearInfo] = useState(null);

  // Load real user data (Google Calendar, Dashboard Stats, Consistency / Streak)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 0. Server-persisted user settings
      try {
        const loadedSettings = await loadUserSettingsFromServer();
        if (isMounted && loadedSettings) {
          setSettings(loadedSettings);
        }
      } catch (err) {
        console.warn('Settings load notice in OptionsPage:', err);
      }

      // 1. Google Calendar Status
      try {
        const calData = await fetchGoogleCalendarStatus();
        if (isMounted && calData) {
          setCalendarStatus({
            loading: false,
            connected: Boolean(calData.connected),
            email: calData.email || null,
            error: null,
          });
        }
      } catch {
        if (isMounted) {
          setCalendarStatus({
            loading: false,
            connected: false,
            email: null,
            error: 'Unable to fetch calendar status',
          });
        }
      }

      // 2. Real Dashboard Data for stats card
      try {
        const tzOffset = new Date().getTimezoneOffset().toString();
        const dashRes = await apiFetch('/api/analytics/dashboard', {
          headers: { 'X-Timezone-Offset': tzOffset },
        });
        if (isMounted && dashRes?.dashboard) {
          setDashboardData(dashRes.dashboard);
        }
      } catch (err) {
        console.warn('Dashboard stats load notice in OptionsPage:', err);
      }

      // 3. Real Consistency / Streak Data
      try {
        const tzOffset = new Date().getTimezoneOffset().toString();
        const consRes = await apiFetch('/api/analytics/consistency', {
          headers: { 'X-Timezone-Offset': tzOffset },
        });
        if (isMounted && consRes) {
          setConsistencyData(consRes);
        }
      } catch (err) {
        console.warn('Consistency stats load notice in OptionsPage:', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time synchronization for settings updates across components
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('focuslens_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('focuslens_settings_updated', handleSettingsUpdated);
    };
  }, []);

  // Show temporary toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Update a single setting and immediately persist
  const updateSetting = (key, value) => {
    const next = saveUserSettings({ [key]: value });
    setSettings(next);
    showToast('Preferences updated and saved');
  };

  // Reset all settings to defaults
  const handleResetDefaults = () => {
    const defaults = resetUserSettings();
    setSettings(defaults);
    showToast('Settings reset to defaults');
  };

  // Google Calendar Handlers
  const handleConnectCalendar = async () => {
    setIsConnectingCalendar(true);
    try {
      await connectGoogleCalendar();
    } catch (err) {
      console.error('Google Calendar connect error:', err);
      showToast('Could not initiate Google Calendar connection');
      setIsConnectingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setIsDisconnectingCalendar(true);
    try {
      await disconnectGoogleCalendar();
      setCalendarStatus({
        loading: false,
        connected: false,
        email: null,
        error: null,
      });
      showToast('Google Calendar disconnected');
    } catch (err) {
      console.error('Google Calendar disconnect error:', err);
      showToast('Failed to disconnect Google Calendar');
    } finally {
      setIsDisconnectingCalendar(false);
    }
  };

  // Clear Local Cache
  const handleClearCache = () => {
    const res = clearLocalSessionCache();
    setCacheClearInfo(res);
    showToast(`Cleared ${res.count} offline cached sessions`);
  };

  // Format seconds to human-readable string
  const formatSeconds = (seconds) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  // Navigation sections list
  const navSections = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid, description: 'Command center snapshot' },
    { id: 'session', label: 'Focus Session', icon: Clock, description: 'Timer & session flow' },
    { id: 'monitoring', label: 'Focus Monitoring', icon: Camera, description: 'Sensors & AI detectors' },
    { id: 'privacy', label: 'Privacy & Integrations', icon: ShieldCheck, description: 'Calendar & privacy guarantees' },
    { id: 'dashboard', label: 'Dashboard Preferences', icon: LayoutDashboard, description: 'Metrics & startup views' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'In-app countdown alerts' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Dark theme ergonomics' },
    { id: 'account', label: 'Account & Data', icon: User, description: 'Profile, security & cache' },
  ];

  // Derive Right Sidebar stats based on selected period
  const getSelectedPeriodStats = () => {
    if (!dashboardData) {
      return { totalActiveSec: 0, sessionCount: 0, focusScore: 0, focusPoints: 0 };
    }
    if (statsPeriod === 'today') {
      const today = dashboardData.today || {};
      return {
        totalActiveSec: today.totalActiveSec || 0,
        sessionCount: today.sessionCount || 0,
        focusScore: today.studyPercentage !== undefined ? today.studyPercentage : (today.focusScore || 0),
        focusPoints: dashboardData.focusPoints?.todayPoints ?? dashboardData.focusPoints?.today ?? 0,
      };
    }
    if (statsPeriod === 'month') {
      const monthly = dashboardData.monthly?.metrics || {};
      return {
        totalActiveSec: monthly.totalActiveSec || 0,
        sessionCount: monthly.sessionCount || 0,
        focusScore: monthly.studyPercentage !== undefined ? monthly.studyPercentage : (monthly.focusScore || 0),
        focusPoints: dashboardData.focusPoints?.lifetimePoints ?? dashboardData.focusPoints?.total ?? 0,
      };
    }
    // Default 'week'
    const weekly = dashboardData.weekly?.metrics || {};
    return {
      totalActiveSec: weekly.totalActiveSec || 0,
      sessionCount: weekly.sessionCount || 0,
      focusScore: weekly.studyPercentage !== undefined ? weekly.studyPercentage : (weekly.focusScore || 0),
      focusPoints: dashboardData.focusPoints?.weekPoints ?? dashboardData.focusPoints?.weekly ?? 0,
    };
  };

  const periodStats = getSelectedPeriodStats();
  const realCurrentStreak = consistencyData?.currentStreak ?? 0;
  const realBestStreak = consistencyData?.bestStreak ?? 0;

  // Derive Overview compact status tile values from real state
  const monitoringStatusText = (settings.defaultCamera && settings.defaultScreen)
    ? 'Active'
    : (settings.defaultCamera ? 'Camera Only' : (settings.defaultScreen ? 'Screen Only' : 'Inactive'));
  const monitoringSubtext = (settings.defaultCamera && settings.defaultScreen)
    ? 'Camera + Screen'
    : (settings.defaultCamera ? 'Webcam vision' : (settings.defaultScreen ? 'Display capture' : 'Manual timer'));

  const activeNotificationCount = (settings.autoResumeWarning ? 1 : 0) + (settings.confirmBeforePause ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl bg-slate-900/95 border border-cyan-500/40 text-cyan-200 text-xs font-medium shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-sm shadow-cyan-950/40">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Options & Settings
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Command Center
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
              Customize how FocusLens works for you.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
            title="Reset all settings to defaults"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset to Defaults</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-semibold shadow-md shadow-cyan-950/30 transition cursor-pointer"
          >
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Navigation Pills (Hidden on lg screens) */}
      <div className="lg:hidden flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {navSections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================
          THREE-COLUMN COMMAND CENTER GRID
      ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =========================================================
            LEFT SIDEBAR — SETTINGS NAVIGATION (Desktop)
        ========================================================= */}
        <aside className="hidden lg:block lg:col-span-3 space-y-2 sticky top-6">
          <div className="p-3.5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-1">
            <div className="px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </div>

            {navSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition cursor-pointer text-left group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800/70 text-slate-400 group-hover:text-slate-200'}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <span className="font-semibold block">{sec.label}</span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick System Badge */}
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>System Operational</span>
            </div>
            <p className="text-[11px] text-slate-400">FocusLens Engine v2.4 • Client ML</p>
          </div>
        </aside>


        {/* =========================================================
            MAIN AREA — COMMAND CENTER OR DETAILED SECTION
        ========================================================= */}
        <main className="lg:col-span-6 space-y-6">
          
          {/* VIEW: OVERVIEW (Default) */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              
              {/* 1. YOUR SETUP AT A GLANCE */}
              <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Your Setup at a Glance
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Quick overview of your current FocusLens configuration.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    REALTIME
                  </span>
                </div>

                {/* 5 Compact Status Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Tile 1: Focus Timer */}
                  <div
                    onClick={() => setActiveSection('session')}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-slate-400 group-hover:text-cyan-400 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-mono text-slate-400">SESSION</span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                      {settings.defaultDuration} minutes
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Default duration</div>
                  </div>

                  {/* Tile 2: Monitoring */}
                  <div
                    onClick={() => setActiveSection('monitoring')}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-slate-400 group-hover:text-teal-400 mb-2">
                      <Camera className="w-4 h-4" />
                      <span className={`text-[10px] font-mono ${monitoringStatusText === 'Active' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {monitoringStatusText}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-teal-300 transition truncate">
                      {monitoringSubtext}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Hardware sensors</div>
                  </div>

                  {/* Tile 3: Privacy */}
                  <div
                    onClick={() => setActiveSection('privacy')}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-400 mb-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-mono text-emerald-400">PROTECTED</span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                      100% Client-Side
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">WebAssembly ML</div>
                  </div>

                  {/* Tile 4: Notifications */}
                  <div
                    onClick={() => setActiveSection('notifications')}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-slate-400 group-hover:text-amber-400 mb-2">
                      <Bell className="w-4 h-4" />
                      <span className="text-[10px] font-mono text-slate-400">ALERTS</span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                      {activeNotificationCount} active
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">In-app warnings</div>
                  </div>

                  {/* Tile 5: Appearance */}
                  <div
                    onClick={() => setActiveSection('appearance')}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition cursor-pointer group col-span-2 sm:col-span-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 group-hover:text-purple-400 mb-2">
                      <Palette className="w-4 h-4" />
                      <span className="text-[10px] font-mono text-purple-400">THEME</span>
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                      Dark Navy
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Focus high-contrast</div>
                  </div>
                </div>
              </div>

              {/* 2. QUICK SETTINGS */}
              <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Quick Settings
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The essentials, right here.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Direct Control
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Control: Default Session Duration */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">
                        Default Session Duration
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Preselected length when launching a new session
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {[15, 25, 45, 60].map((mins) => {
                        const isSelected = settings.defaultDuration === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => updateSetting('defaultDuration', mins)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-md shadow-cyan-950/40'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {mins}m
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Control: Pause Auto-Resume (Informational + 5m Guarantee) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-200">
                          Pause Auto-Resume Protection
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          5 MINUTES FIXED
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Guarantees timer automatically resumes after exactly 300 seconds
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting('confirmBeforePause', !settings.confirmBeforePause)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        settings.confirmBeforePause ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                      role="switch"
                      aria-checked={settings.confirmBeforePause}
                      title="Toggle pause confirmation prompt"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          settings.confirmBeforePause ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Control: Camera Monitoring Default */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">
                        Camera Monitoring
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Enable local vision stream by default in setup
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting('defaultCamera', !settings.defaultCamera)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        settings.defaultCamera ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                      role="switch"
                      aria-checked={settings.defaultCamera}
                      title="Toggle default camera"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          settings.defaultCamera ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Control: Screen Monitoring Default */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">
                        Screen Monitoring
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Prompt for productive screen classification
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting('defaultScreen', !settings.defaultScreen)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        settings.defaultScreen ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                      role="switch"
                      aria-checked={settings.defaultScreen}
                      title="Toggle default screen share"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          settings.defaultScreen ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Control: Session Auto-Resume Notification */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">
                        Session Notifications
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        High-priority alerts when 5-minute pause expires
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSetting('autoResumeWarning', !settings.autoResumeWarning)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        settings.autoResumeWarning ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                      role="switch"
                      aria-checked={settings.autoResumeWarning}
                      title="Toggle session notifications"
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          settings.autoResumeWarning ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. PRODUCTIVITY TOOLS */}
              <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Productivity Tools
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Manage your connected apps and tools.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Integrations
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tool 1: Google Calendar */}
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 text-blue-400 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold text-slate-200">Google Calendar</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {calendarStatus.loading ? (
                          <span className="font-mono text-slate-400">Checking...</span>
                        ) : calendarStatus.connected ? (
                          <span className="text-emerald-400 font-medium truncate block">
                            Connected {calendarStatus.email ? `(${calendarStatus.email})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not Connected</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800/60">
                      {calendarStatus.connected ? (
                        <button
                          type="button"
                          disabled={isDisconnectingCalendar}
                          onClick={handleDisconnectCalendar}
                          className="w-full text-center px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          {isDisconnectingCalendar ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isConnectingCalendar}
                          onClick={handleConnectCalendar}
                          className="w-full text-center px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          {isConnectingCalendar ? 'Redirecting...' : 'Manage / Connect'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tool 2: Connected Integrations */}
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 text-cyan-400 mb-2">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-bold text-slate-200">Integrations</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-200 font-semibold">
                          {calendarStatus.connected ? '1 Connected' : '0 Connected'}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Google Calendar sync</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => setActiveSection('privacy')}
                        className="w-full text-center px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>

                  {/* Tool 3: Data & Privacy */}
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-bold text-slate-200">Data & Privacy</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="text-emerald-400 font-semibold">Protected</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Zero media capture</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => setActiveSection('privacy')}
                        className="w-full text-center px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
                      >
                        View Settings
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* VIEW: FOCUS SESSION */}
          {activeSection === 'session' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Focus Session
                    </h2>
                    <p className="text-xs text-slate-400">
                      Configure default countdown durations and session flow protections.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* Default Session Duration */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Default Session Duration
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Initial timer duration preselected when setting up a new focus session.
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {[15, 25, 45, 60].map((mins) => {
                      const isSelected = settings.defaultDuration === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => updateSetting('defaultDuration', mins)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-md shadow-cyan-950/40'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {mins}m
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pause Auto-Resume Behavior (Informational + Status) */}
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-200">
                        Pause Auto-Resume Protection
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ACTIVE (5 MIN MAX)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    To maintain focus integrity, FocusLens permits a maximum cumulative pause window of exactly <strong>5 minutes (300 seconds)</strong>. If a session remains paused beyond this limit, the timer automatically resumes and notifies you in-app.
                  </p>
                </div>

                {/* Confirm Before Pausing */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Confirm Before Pausing Session
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Displays the 5-minute pause limit warning modal before halting active countdown.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('confirmBeforePause', !settings.confirmBeforePause)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.confirmBeforePause ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.confirmBeforePause}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.confirmBeforePause ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Confirm Before Ending Early */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Confirm Before Ending Session
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Prompts for confirmation before manually ending a session prior to countdown completion.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('confirmBeforeEnd', !settings.confirmBeforeEnd)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.confirmBeforeEnd ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.confirmBeforeEnd}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.confirmBeforeEnd ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: FOCUS MONITORING */}
          {activeSection === 'monitoring' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Focus Monitoring
                    </h2>
                    <p className="text-xs text-slate-400">
                      Manage hardware input defaults and view active vision detection models.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* Camera Monitoring Default */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Enable Camera Stream by Default
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Requests webcam stream during pre-session setup for posture and presence tracking.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('defaultCamera', !settings.defaultCamera)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.defaultCamera ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.defaultCamera}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.defaultCamera ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Screen Share Default */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Enable Screen Capture by Default
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Prompts for browser screen share during setup to classify productive window context.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('defaultScreen', !settings.defaultScreen)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.defaultScreen ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.defaultScreen}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.defaultScreen ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Real Active Capabilities Overview */}
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Active Vision Detectors (MediaPipe Engine)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <Smartphone className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200 block">Phone Detection</span>
                        <span className="text-slate-400 text-[11px]">Identifies handheld smartphone usage in video stream.</span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <User className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200 block">Person Presence</span>
                        <span className="text-slate-400 text-[11px]">Monitors user attendance and flags absence intervals.</span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <Compass className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200 block">Head Orientation</span>
                        <span className="text-slate-400 text-[11px]">Tracks 3D yaw, pitch, and roll to detect screen gaze.</span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <Monitor className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-200 block">Screen Classification</span>
                        <span className="text-slate-400 text-[11px]">Categorizes active work surface (Code, Doc, Browser).</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strict Microphone Exemption Notice */}
                <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-300 text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong>Zero Audio Capture:</strong> FocusLens does not access or record microphone inputs. Audio processing is completely omitted from the application.
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: PRIVACY & INTEGRATIONS */}
          {activeSection === 'privacy' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Privacy & Integrations
                    </h2>
                    <p className="text-xs text-slate-400">
                      Inspect client-side AI processing, calendar synchronization, and local session data.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* Guarantee: Local Model Execution */}
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-slate-200">
                      100% Client-Side Machine Learning
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    All computer vision inference (MediaPipe face detection, head pose, and object detection) runs directly inside your web browser using WebAssembly. Camera video streams and screen captures never leave your machine and are never uploaded to our servers.
                  </p>
                </div>

                {/* Google Calendar Live Connection Card */}
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-200 block">
                          Google Calendar Integration
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Sync focus blocks and scheduled study sessions directly to your calendar.
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {calendarStatus.loading ? (
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                          Checking...
                        </span>
                      ) : calendarStatus.connected ? (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Connected</span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800/80 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>Not Connected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                    <div className="text-xs text-slate-400">
                      {calendarStatus.connected && calendarStatus.email ? (
                        <span>Linked account: <strong className="text-slate-200">{calendarStatus.email}</strong></span>
                      ) : (
                        <span>Connect your Google account to enable two-way event scheduling.</span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {calendarStatus.connected ? (
                        <button
                          type="button"
                          disabled={isDisconnectingCalendar}
                          onClick={handleDisconnectCalendar}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          {isDisconnectingCalendar ? 'Disconnecting...' : 'Disconnect Calendar'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isConnectingCalendar}
                          onClick={handleConnectCalendar}
                          className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-brand-600/20 disabled:opacity-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{isConnectingCalendar ? 'Redirecting...' : 'Connect Google Calendar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Offline Local Storage Cache */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Offline Session Cache
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Clear unsubmitted offline session snapshots saved to browser localStorage.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Clear Local Cache</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: DASHBOARD PREFERENCES */}
          {activeSection === 'dashboard' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Dashboard Preferences
                    </h2>
                    <p className="text-xs text-slate-400">
                      Choose your startup category filter and toggle visible dashboard cards.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* Default Category Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Default Category Filter
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      The initial category active when opening your personal analytics dashboard.
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {[
                      { id: 'ALL', label: 'All Work' },
                      { id: 'Study', label: 'Study' },
                      { id: 'Coding', label: 'Coding' },
                      { id: 'Other', label: 'Other' },
                    ].map((cat) => {
                      const isSelected = settings.defaultCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => updateSetting('defaultCategory', cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-950/40'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Show Focus Score */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Show Focus Score Metric
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Displays the productive ratio percentage inside the Today's Focus card.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('showFocusScore', !settings.showFocusScore)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.showFocusScore ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.showFocusScore}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.showFocusScore ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Gamified Focus Points Card */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Show Gamified Focus Points Card
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Displays level progression, today's points, and stage artwork on Dashboard.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('showFocusPoints', !settings.showFocusPoints)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.showFocusPoints ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.showFocusPoints}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.showFocusPoints ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Focus Consistency Streak Card */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Show Focus Streak Card
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Displays consecutive focus days, weekly completion, and streak flame.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('showFocusStreak', !settings.showFocusStreak)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.showFocusStreak ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.showFocusStreak}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.showFocusStreak ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Notifications
                    </h2>
                    <p className="text-xs text-slate-400">
                      Manage in-app session alerts and review external notification support.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* Pause Warning In-App Modal */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-slate-200 block">
                      Auto-Resume Notice Modal
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Displays high-priority popup alert whenever a 5-minute pause limit expires.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSetting('autoResumeWarning', !settings.autoResumeWarning)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      settings.autoResumeWarning ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                    role="switch"
                    aria-checked={settings.autoResumeWarning}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        settings.autoResumeWarning ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Browser Push Notifications (Clearly Coming Soon) */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 opacity-80">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-200">
                        Desktop System Push Notifications
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        COMING SOON
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Native operating system desktop alerts when timer intervals elapse outside browser.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="w-12 h-6 flex items-center rounded-full p-1 bg-slate-800 cursor-not-allowed opacity-50"
                  >
                    <div className="bg-slate-500 w-4 h-4 rounded-full" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: APPEARANCE */}
          {activeSection === 'appearance' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Appearance & Theme
                    </h2>
                    <p className="text-xs text-slate-400">
                      FocusLens is purpose-built for sustained, glare-free cognitive focus.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">
                      Active Palette: Dark Navy & Cyan
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      OPTIMIZED FOR FOCUS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Light mode is disabled intentionally. Research demonstrates that high-contrast dark environments reduce pupil constriction and cognitive fatigue during extended deep work sessions.
                  </p>

                  <div className="flex items-center space-x-2 pt-2">
                    <div className="flex items-center space-x-1 text-[11px] text-slate-400 font-mono">
                      <span className="w-4 h-4 rounded-full bg-slate-950 border border-slate-700" title="Slate 950 Background" />
                      <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700" title="Slate 900 Cards" />
                      <span className="w-4 h-4 rounded-full bg-cyan-500" title="Cyan 500 Primary" />
                      <span className="w-4 h-4 rounded-full bg-teal-400" title="Teal 400 Secondary" />
                      <span className="w-4 h-4 rounded-full bg-amber-400" title="Amber 400 Streak" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW: ACCOUNT & DATA */}
          {activeSection === 'account' && (
            <section className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                      Account & Data
                    </h2>
                    <p className="text-xs text-slate-400">
                      Manage your profile credentials, security credentials, and session state.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ← Overview
                </button>
              </div>

              <div className="space-y-5">
                {/* User Profile Summary Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-base">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {user?.name || 'FocusLens User'}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        {user?.email || 'No email attached'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400/90 block mt-0.5">
                        @{user?.username || 'user'} • Active Member
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('profile')}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('profile')}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Password</span>
                    </button>
                  </div>
                </div>

                {/* Logout and Danger Zone */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Session Authentication
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Sign out of your active session on this device.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (logout) logout();
                      if (onNavigate) onNavigate('landing');
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </section>
          )}

        </main>


        {/* =========================================================
            RIGHT SIDEBAR — REAL STATS & MOTIVATION PANEL
        ========================================================= */}
        <aside className="lg:col-span-3 space-y-4">
          
          {/* CARD 1: FOCUS STREAK */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-slate-900/70 to-slate-950/90 backdrop-blur-xl border border-amber-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-amber-200 uppercase tracking-wider font-mono">
                  Focus Streak
                </span>
              </div>
              {realBestStreak > 0 && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Best: {realBestStreak}d
                </span>
              )}
            </div>

            <div className="pt-1">
              <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {realCurrentStreak} {realCurrentStreak === 1 ? 'day' : 'days'}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {realCurrentStreak > 0
                  ? "Keep going! You're building consistency."
                  : "Start a focus session today to kick off your streak!"}
              </p>
            </div>
          </div>

          {/* CARD 2: FOCUS STATS (WITH REAL DATA & PERIOD SELECTOR) */}
          <div className="p-5 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Focus Stats
              </span>

              {/* Period Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  <span>
                    {statsPeriod === 'week' ? 'This week' : statsPeriod === 'today' ? 'Today' : 'This month'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isPeriodDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-32 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl p-1 z-30 space-y-0.5">
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'week', label: 'This week' },
                      { id: 'month', label: 'This month' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setStatsPeriod(p.id);
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                          statsPeriod === p.id
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Real Stats Metric Rows */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Total Focus Time</span>
                <span className="font-mono font-bold text-white">
                  {formatSeconds(periodStats.totalActiveSec)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Sessions Completed</span>
                <span className="font-mono font-bold text-cyan-300">
                  {periodStats.sessionCount}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Average Focus Score</span>
                <span className="font-mono font-bold text-teal-300">
                  {periodStats.sessionCount > 0 ? `${periodStats.focusScore}%` : '0%'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Focus Points Earned</span>
                <span className="font-mono font-bold text-amber-300">
                  +{periodStats.focusPoints} pts
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: MOTIVATIONAL QUOTE (EXACTLY AS SPECIFIED) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/60 to-slate-950/80 border border-slate-800/80 shadow-md text-center space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 block">
              MANTRA
            </span>
            <blockquote className="text-xs font-serif italic text-slate-300 font-medium tracking-wide">
              &ldquo;The Only Easy Day Was Yesterday&rdquo;
            </blockquote>
          </div>

          {/* CARD 4: NEED HELP? */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md space-y-2.5">
            <div className="flex items-center space-x-2 text-slate-300">
              <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-white">Need Help?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Check our guides or reach support if you need assistance.
            </p>
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="w-full text-center px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer border border-slate-700/60 flex items-center justify-center space-x-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Help Center</span>
            </button>
          </div>

        </aside>

      </div>

      {/* =========================================================
          HELP CENTER / GUIDES MODAL (REAL, NOT A BROKEN ROUTE)
      ========================================================= */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">FocusLens Help & Guides</h3>
                  <p className="text-xs text-slate-400">Essential rules and features</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 max-h-80 overflow-y-auto pr-1">
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <span className="font-bold text-cyan-300 block mb-1">Pause Safety Limit (5 Minutes)</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  FocusLens automatically resumes paused sessions after 300 seconds (5 minutes) to protect your momentum.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <span className="font-bold text-teal-300 block mb-1">Local Privacy & Zero Audio</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  All face, posture, and screen classification models run 100% inside your browser WebAssembly sandbox. Audio and microphones are completely disabled.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <span className="font-bold text-amber-300 block mb-1">Focus Points & Streaks</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Complete at least one qualifying session daily to extend your Focus Streak. Earn points to advance stages from Beginner up to Focus Master.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
                <span className="font-bold text-purple-300 block mb-1">Focus Buddies & Messages</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Use the Focus Buddies tab in the top navigation bar to invite partners by username and exchange motivational cheers.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
