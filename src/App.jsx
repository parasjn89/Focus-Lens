import React, { useState, useEffect, useRef } from 'react';

import { Navbar } from './components/Navbar';
import { LandingNavbar } from './components/LandingNavbar';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { SessionSetupPage } from './pages/SessionSetupPage';
import { ActiveSessionPage } from './pages/ActiveSessionPage';
import { SessionReportPage } from './pages/SessionReportPage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PersonalDashboardPage } from './pages/PersonalDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { VerificationPage } from './pages/VerificationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { FocusCoachPage } from './pages/FocusCoachPage';
import { ConsistencyPage } from './pages/ConsistencyPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { WeeklyReviewPage } from './pages/WeeklyReviewPage';
import { FocusJournalPage } from './pages/FocusJournalPage';
import { CalendarPage } from './pages/CalendarPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { startSession, saveSessionSegments, finalizeSession, fetchSessionById } from './api/sessionApi';
import { initBackgroundSync } from './api/syncManager';
import { ROUTE_PATH_MAP, PATH_ALIASES, resolveViewFromLocation } from './utils/routes';

function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  // Navigation state initialized from location or active report session in storage
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const resolved = resolveViewFromLocation(window.location);
      const savedReportSessionId = sessionStorage.getItem('focuslens_active_report_session_id');
      if (savedReportSessionId && (resolved === 'landing' || resolved === 'report')) {
        return 'report';
      }
      return resolved;
    }
    return 'landing';
  });
  const [registrationState, setRegistrationState] = useState(null);
  const [prefilledSetupConfig, setPrefilledSetupConfig] = useState(null);

  // Session configuration & persistent record state
  const [sessionConfig, setSessionConfig] = useState({
    activity: 'Studying',
    durationMinutes: 25,
  });
  const [activeBackendSession, setActiveBackendSession] = useState(null);

  // Countdown timer state & logs
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [eventLogs, setEventLogs] = useState([]);
  const [activeSessionSegments, setActiveSessionSegments] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Precise timestamp-anchored timer & session references to prevent closure staleness
  const timerStartedAtRef = useRef(null);
  const pausedAtRef = useRef(null);
  const totalPausedMsRef = useRef(0);
  const isFinalizingRef = useRef(false);
  const activeBackendSessionRef = useRef(null);
  const activeSessionSegmentsRef = useRef([]);
  const activeBackendSessionPromiseRef = useRef(null);

  // Handle protected route navigation with browser history synchronization
  const handleNavigate = (view, options = {}) => {
    const { fromPopState = false, replace = false } = options;

    const protectedViews = ['dashboard', 'profile', 'history', 'verify', 'coach', 'consistency', 'recommendations', 'weekly-review', 'journal', 'messages', 'calendar', 'options'];
    if (protectedViews.includes(view) && !isAuthenticated && !isLoading) {
      handleNavigate('login', { replace: true });
      return;
    }
    // Prevent unverified accounts from bypassing verification to access session/dashboard views
    const unverifiedBlockedViews = ['dashboard', 'setup', 'history', 'coach', 'consistency', 'recommendations', 'weekly-review', 'journal', 'messages', 'calendar', 'options'];
    if (isAuthenticated && user && user.verificationStatus !== 'VERIFIED' && unverifiedBlockedViews.includes(view)) {
      handleNavigate('verify', { replace: true });
      return;
    }
    if (currentView === 'active' && view !== 'active') {
      setIsTimerRunning(false);
      setIsTimerPaused(false);
    }

    // Synchronize browser history entry (push or replace) unless triggered by popstate
    if (!fromPopState && typeof window !== 'undefined') {
      const canonicalPath = ROUTE_PATH_MAP[view] || `/${view === 'landing' ? '' : view}`;
      const currentState = window.history.state;
      if (!currentState || currentState.view !== view) {
        if (replace) {
          window.history.replaceState({ view }, '', canonicalPath);
        } else {
          window.history.pushState({ view }, '', canonicalPath);
        }
      }
    }

    setCurrentView(view);
  };

  // Initialize background retry sync manager, browser popstate listener & initial history state
  useEffect(() => {
    initBackgroundSync();

    // Check URL params for reset password
    if (window.location.search.includes('token=') || window.location.pathname.includes('reset-password')) {
      handleNavigate('forgot-password', { replace: true });
      return;
    }

    // Initialize initial history entry with replaceState if needed
    // CRITICAL: NEVER call pushState on initial load so pressing Back in a fresh tab cleanly exits to New Tab
    try {
      const initialView = resolveViewFromLocation(window.location);
      const canonicalPath = ROUTE_PATH_MAP[initialView] || `/${initialView === 'landing' ? '' : initialView}`;
      if (!window.history.state || window.history.state.view !== initialView) {
        window.history.replaceState({ view: initialView }, '', canonicalPath);
      }
    } catch (e) {}

    // Check if user was viewing a report before page refresh
    const savedReportSessionId = sessionStorage.getItem('focuslens_active_report_session_id');
    if (savedReportSessionId) {
      fetchSessionById(savedReportSessionId).then((fullData) => {
        if (fullData && fullData.session) {
          const s = fullData.session;
          const fullActualSecs = s.actualDurationMs ? Math.round(s.actualDurationMs / 1000) : 0;
          const fullPlannedMins = s.plannedDurationMs ? Math.round(s.plannedDurationMs / 60000) : 25;
          const fullPausedSecs = s.pausedDurationMs ? Math.round(s.pausedDurationMs / 1000) : 0;

          setReportData({
            id: s.id,
            sessionId: s.id,
            activity: s.selectedActivity || 'Focus Session',
            targetMinutes: fullPlannedMins,
            actualSecondsSpent: fullActualSecs,
            pausedSecondsSpent: fullPausedSecs,
            activitySegments: fullData.activitySegments || [],
            isAutoCompleted: true,
            completedAt: s.endedAt
              ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : s.startedAt
                ? new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Previous Session',
            goalText: s.goalText,
            goalType: s.goalType,
            targetValue: s.targetValue,
            targetUnit: s.targetUnit,
            goalProgress: s.goalProgress,
            goalCompleted: s.goalCompleted,
            intention: s.intention,
            workedWell: s.workedWell,
            gotInTheWay: s.gotInTheWay,
            notes: s.notes,
            isHistorical: true,
            isLoading: false,
          });
          handleNavigate('report', { replace: true });
        }
      }).catch(() => null);
    }

    // Listen to browser Back and Forward button navigation events
    const onPopState = (event) => {
      const stateView = event.state?.view;
      const targetView = stateView || resolveViewFromLocation(window.location);
      if (targetView) {
        handleNavigate(targetView, { fromPopState: true });
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Keep unverified authenticated users on the verification view or redirect unauthenticated
  useEffect(() => {
    if (!isLoading) {
      const protectedViews = ['dashboard', 'profile', 'history', 'verify', 'coach', 'consistency', 'recommendations', 'weekly-review', 'journal', 'messages', 'calendar', 'options'];
      if (protectedViews.includes(currentView) && !isAuthenticated) {
        handleNavigate('login', { replace: true });
        return;
      }
      const unverifiedBlockedViews = ['dashboard', 'setup', 'history', 'coach', 'consistency', 'recommendations', 'weekly-review', 'journal', 'messages', 'calendar', 'options'];
      if (isAuthenticated && user && user.verificationStatus !== 'VERIFIED' && unverifiedBlockedViews.includes(currentView)) {
        handleNavigate('verify', { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, user?.verificationStatus, currentView]);

  const handleStartRecommendedSession = (suggestedSession) => {
    if (!suggestedSession) {
      handleNavigate('setup');
      return;
    }
    setPrefilledSetupConfig({
      durationMinutes: suggestedSession.durationMinutes || 25,
      goalText: suggestedSession.goalText || '',
      goalType: suggestedSession.goalType || 'NONE',
      targetValue: suggestedSession.targetValue || null,
      targetUnit: suggestedSession.targetUnit || '',
    });
    handleNavigate('setup');
  };

  // Countdown Timer Hook Effect using precise Timestamp-Delta Calculation
  useEffect(() => {
    let intervalId = null;

    if (isTimerRunning && !isTimerPaused && timerStartedAtRef.current) {
      const updateTimer = () => {
        if (isFinalizingRef.current) return;

        const now = Date.now();
        const totalPlannedSecs = sessionConfig.durationMinutes * 60;
        const elapsedMs = now - timerStartedAtRef.current - totalPausedMsRef.current;
        const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
        const nextRemaining = Math.max(0, totalPlannedSecs - elapsedSecs);

        setRemainingSeconds(nextRemaining);

        if (nextRemaining <= 0) {
          if (!isFinalizingRef.current) {
            isFinalizingRef.current = true;
            if (intervalId) clearInterval(intervalId);
            finishSession(true);
          }
        }
      };

      // Immediate tick + 250ms high-precision polling interval
      updateTimer();
      intervalId = setInterval(updateTimer, 250);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTimerRunning, isTimerPaused, sessionConfig.durationMinutes]);

  // Handler to initialize a new focus session
  const handleStartSession = ({ activity, durationMinutes, goalText = null, goalType = 'NONE', targetValue = null, targetUnit = null, initialStreams }) => {
    const totalSecs = durationMinutes * 60;
    const plannedDurationMs = totalSecs * 1000;

    const newConfig = {
      activity,
      durationMinutes,
      goalText,
      goalType,
      targetValue,
      targetUnit,
      goalProgress: 0,
      goalCompleted: false,
      initialStreams,
    };

    setSessionConfig(newConfig);
    setRemainingSeconds(totalSecs);

    // Initialize timer timestamp anchors
    const now = Date.now();
    timerStartedAtRef.current = now;
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    isFinalizingRef.current = false;

    setIsTimerRunning(true);
    setIsTimerPaused(false);
    setActiveSessionSegments([]);
    activeSessionSegmentsRef.current = [];
    setActiveBackendSession(null);
    activeBackendSessionRef.current = null;

    setEventLogs([
      {
        time: '00:00',
        label: 'Session Initialized',
        description: `Target Activity: ${activity} (${durationMinutes} mins)${goalText ? ` • Goal: ${goalText}` : ''}`,
      },
      {
        time: '00:01',
        label: 'Observational Signals Ready',
        description: 'Camera, Screen & Audio analysis pipeline running strictly client-side.',
      }
    ]);

    // Transition IMMEDIATELY to active view so monitoring initializes without network latency blocking
    handleNavigate('active');

    // Register session asynchronously with backend and capture in ref
    const startPromise = startSession({
      plannedDurationMs,
      selectedActivity: activity,
      goalText,
      goalType,
      targetValue,
      targetUnit,
    });
    activeBackendSessionPromiseRef.current = startPromise;

    startPromise.then(({ session, isOfflineFallback }) => {
      setActiveBackendSession(session);
      activeBackendSessionRef.current = session;
      if (isOfflineFallback) {
        addEventLog('Local Persistence Active', 'Backend server offline. Session metadata saving safely to browser cache.');
      } else {
        addEventLog('Backend Synced', `Session #${session.id.slice(0, 8)} registered with PostgreSQL database.`);
      }
    }).catch((err) => {
      console.warn('Failed to register session with backend:', err);
    });
  };

  // Pause timer handler
  const handlePauseTimer = () => {
    if (isTimerRunning && !isTimerPaused) {
      pausedAtRef.current = Date.now();
      setIsTimerPaused(true);
      addEventLog('Session Paused', 'User manually paused countdown timer.');
    }
  };

  // Resume timer handler
  const handleResumeTimer = () => {
    if (isTimerRunning && isTimerPaused) {
      if (pausedAtRef.current) {
        totalPausedMsRef.current += (Date.now() - pausedAtRef.current);
        pausedAtRef.current = null;
      }
      setIsTimerPaused(false);
      addEventLog('Session Resumed', 'Focus countdown resumed.');
    }
  };

  // Helper to add timeline event log
  const addEventLog = (label, description) => {
    const scheduledSeconds = sessionConfig.durationMinutes * 60;
    let elapsedSecs = 0;
    if (timerStartedAtRef.current) {
      const currentPauseMs = isTimerPaused && pausedAtRef.current ? (Date.now() - pausedAtRef.current) : 0;
      const totalElapsedMs = Date.now() - timerStartedAtRef.current - (totalPausedMsRef.current + currentPauseMs);
      elapsedSecs = Math.max(0, Math.floor(totalElapsedMs / 1000));
    } else {
      elapsedSecs = scheduledSeconds - remainingSeconds;
    }

    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    setEventLogs((prev) => {
      const nextLogs = [...prev, { time: timeStr, label, description }];
      return nextLogs.length > 100 ? nextLogs.slice(-100) : nextLogs;
    });
  };

  // Complete session (either via countdown end or user manual end)
  const finishSession = async (isAutoCompleted = false) => {
    if (isFinalizingRef.current && !isAutoCompleted) {
      // Prevent duplicate finalization
    }
    isFinalizingRef.current = true;
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    pauseStartTimeRef.current = null;

    const scheduledSeconds = sessionConfig.durationMinutes * 60;
    let actualSecondsSpent = scheduledSeconds;
    if (timerStartedAtRef.current) {
      const currentPauseMs = isTimerPaused && pausedAtRef.current ? (Date.now() - pausedAtRef.current) : 0;
      const totalElapsedMs = Date.now() - timerStartedAtRef.current - (totalPausedMsRef.current + currentPauseMs);
      actualSecondsSpent = Math.min(scheduledSeconds, Math.max(1, Math.floor(totalElapsedMs / 1000)));
    }
    const actualDurationMs = actualSecondsSpent * 1000;

    // Await backend registration if still in-flight to prevent dropped sessions
    let backendSession = activeBackendSessionRef.current || activeBackendSession;
    if (!backendSession && activeBackendSessionPromiseRef.current) {
      try {
        const startRes = await activeBackendSessionPromiseRef.current;
        if (startRes?.session) {
          backendSession = startRes.session;
          activeBackendSessionRef.current = backendSession;
          setActiveBackendSession(backendSession);
        }
      } catch (err) {
        console.warn('Waiting for session registration failed:', err);
      }
    }

    // Read segments from ref to prevent stale closure in timer intervals
    const segmentsToSave = activeSessionSegmentsRef.current?.length > 0
      ? activeSessionSegmentsRef.current
      : activeSessionSegments;

    let finalGoalProgress = backendSession?.goalProgress ?? (sessionConfig.goalProgress || 0);
    let finalGoalCompleted = backendSession?.goalCompleted ?? (sessionConfig.goalCompleted || false);

    // Save activity segments & finalize backend session in PostgreSQL
    if (backendSession && backendSession.id) {
      try {
        await saveSessionSegments(backendSession.id, segmentsToSave);
        const finalized = await finalizeSession(backendSession.id, {
          actualDurationMs,
          pausedDurationMs: totalPausedMsRef.current,
          status: 'COMPLETED',
          goalProgress: finalGoalProgress,
          goalCompleted: finalGoalCompleted,
        });

        if (finalized?.session) {
          finalGoalProgress = finalized.session.goalProgress ?? finalGoalProgress;
          finalGoalCompleted = finalized.session.goalCompleted ?? finalGoalCompleted;
        }
      } catch (err) {
        console.warn('Failed to persist session completion metadata:', err);
      }
    }

    const sessionId = backendSession?.id || null;
    if (sessionId) {
      try {
        sessionStorage.setItem('focuslens_active_report_session_id', sessionId);
      } catch (e) {}
    }

    const summaryReport = {
      id: sessionId,
      sessionId,
      activity: sessionConfig.activity,
      targetMinutes: sessionConfig.durationMinutes,
      actualSecondsSpent: actualSecondsSpent > 0 ? actualSecondsSpent : scheduledSeconds,
      pausedSecondsSpent: Math.round(totalPausedMsRef.current / 1000),
      activitySegments: segmentsToSave,
      isAutoCompleted,
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      goalText: sessionConfig.goalText,
      goalType: sessionConfig.goalType,
      targetValue: sessionConfig.targetValue,
      targetUnit: sessionConfig.targetUnit,
      goalProgress: finalGoalProgress,
      goalCompleted: finalGoalCompleted,
    };

    setReportData(summaryReport);
    handleNavigate('report');
  };

  // End session manually button click
  const handleEndSession = () => {
    finishSession(false);
  };

  // Select historical session to view report - fetches full persisted activity segments & metadata
  const handleSelectHistoricalSession = async (sessionSummary) => {
    if (!sessionSummary) return;

    const sessionId = sessionSummary.id || sessionSummary.sessionId;
    const actualSecs = sessionSummary.actualDurationMs ? Math.round(sessionSummary.actualDurationMs / 1000) : 0;
    const plannedMins = sessionSummary.plannedDurationMs ? Math.round(sessionSummary.plannedDurationMs / 60000) : 25;
    const pausedSecs = sessionSummary.pausedDurationMs ? Math.round(sessionSummary.pausedDurationMs / 1000) : 0;

    // Show initial session report immediately with loading skeleton
    setReportData({
      id: sessionId,
      sessionId,
      activity: sessionSummary.selectedActivity || 'Focus Session',
      targetMinutes: plannedMins,
      actualSecondsSpent: actualSecs,
      pausedSecondsSpent: pausedSecs,
      activitySegments: sessionSummary.activitySegments || [],
      isAutoCompleted: true,
      completedAt: sessionSummary.startedAt ? new Date(sessionSummary.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Previous Session',
      goalText: sessionSummary.goalText || null,
      goalType: sessionSummary.goalType || 'NONE',
      targetValue: sessionSummary.targetValue || null,
      targetUnit: sessionSummary.targetUnit || null,
      goalProgress: sessionSummary.goalProgress ?? 0,
      goalCompleted: sessionSummary.goalCompleted ?? false,
      intention: sessionSummary.intention || null,
      workedWell: sessionSummary.workedWell || null,
      gotInTheWay: sessionSummary.gotInTheWay || null,
      notes: sessionSummary.notes || null,
      isHistorical: true,
      isLoading: true,
    });
    handleNavigate('report');

    if (sessionId) {
      try {
        sessionStorage.setItem('focuslens_active_report_session_id', sessionId);
      } catch (e) {}

      // Fetch full session details from backend (or local offline cache)
      try {
        const fullData = await fetchSessionById(sessionId);
        if (fullData && fullData.session) {
          const s = fullData.session;
          const fullActualSecs = s.actualDurationMs ? Math.round(s.actualDurationMs / 1000) : actualSecs;
          const fullPlannedMins = s.plannedDurationMs ? Math.round(s.plannedDurationMs / 60000) : plannedMins;
          const fullPausedSecs = s.pausedDurationMs ? Math.round(s.pausedDurationMs / 1000) : pausedSecs;

          setReportData({
            id: s.id,
            sessionId: s.id,
            activity: s.selectedActivity || sessionSummary.selectedActivity || 'Focus Session',
            targetMinutes: fullPlannedMins,
            actualSecondsSpent: fullActualSecs,
            pausedSecondsSpent: fullPausedSecs,
            activitySegments: fullData.activitySegments || [],
            isAutoCompleted: true,
            completedAt: s.endedAt
              ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : s.startedAt
                ? new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Previous Session',
            goalText: s.goalText ?? sessionSummary.goalText ?? null,
            goalType: s.goalType ?? sessionSummary.goalType ?? 'NONE',
            targetValue: s.targetValue ?? sessionSummary.targetValue ?? null,
            targetUnit: s.targetUnit ?? sessionSummary.targetUnit ?? null,
            goalProgress: s.goalProgress ?? sessionSummary.goalProgress ?? 0,
            goalCompleted: s.goalCompleted ?? sessionSummary.goalCompleted ?? false,
            intention: s.intention ?? sessionSummary.intention ?? null,
            workedWell: s.workedWell ?? sessionSummary.workedWell ?? null,
            gotInTheWay: s.gotInTheWay ?? sessionSummary.gotInTheWay ?? null,
            notes: s.notes ?? sessionSummary.notes ?? null,
            isHistorical: true,
            isLoading: false,
          });
          return;
        }
      } catch (err) {
        console.error('Failed to fetch full historical session details:', err);
      }
    }

    setReportData((prev) => (prev ? { ...prev, isLoading: false } : null));
  };

  const isAppView = isAuthenticated && !['landing', 'login', 'register', 'verify', 'forgot-password', 'active'].includes(currentView);

  return (
    <div className={`min-h-screen flex bg-navy-900 text-slate-100 selection:bg-brand-500 selection:text-white font-sans ${isAppView ? 'overflow-hidden' : ''}`}>
      
      {isAppView && (
        <Sidebar currentView={currentView} onNavigate={handleNavigate} />
      )}

      <div className={`flex-1 flex flex-col ${isAppView ? 'h-screen overflow-hidden relative' : 'min-h-screen'}`}>
        {/* Topbar for App Views, Navbar for Public/Active Views */}
        {isAppView ? (
          <Topbar currentView={currentView} />
        ) : currentView === 'landing' ? (
          <LandingNavbar onNavigate={handleNavigate} />
        ) : (
          <Navbar
            currentView={currentView}
            onNavigate={handleNavigate}
            activeSession={isTimerRunning}
          />
        )}

        {/* Main View Router */}
        <main className={`flex-1 ${isAppView ? 'overflow-y-auto relative z-0' : ''} ${!isAppView && currentView !== 'landing' ? 'pt-28 pb-12' : ''}`}>
        {currentView === 'landing' && (
          <LandingPage onStartSetup={() => handleNavigate('setup')} />
        )}

        {currentView === 'setup' && (
          <SessionSetupPage
            initialConfig={prefilledSetupConfig}
            onStartSession={handleStartSession}
            onCancel={() => handleNavigate(isAuthenticated ? 'dashboard' : 'landing')}
          />
        )}

        {currentView === 'active' && (
          <ActiveSessionPage
            sessionInfo={sessionConfig}
            remainingSeconds={remainingSeconds}
            isPaused={isTimerPaused}
            onPause={handlePauseTimer}
            onResume={handleResumeTimer}
            onEndSession={handleEndSession}
            eventLogs={eventLogs}
            onAddEventLog={addEventLog}
            onUpdateSessionSegments={(segments) => {
              setActiveSessionSegments(segments);
              activeSessionSegmentsRef.current = segments;
            }}
          />
        )}

        {currentView === 'report' && (
          <SessionReportPage
            reportData={reportData}
            onNewSession={() => {
              try { sessionStorage.removeItem('focuslens_active_report_session_id'); } catch (e) {}
              handleNavigate('setup');
            }}
            onHome={() => {
              try { sessionStorage.removeItem('focuslens_active_report_session_id'); } catch (e) {}
              handleNavigate('landing');
            }}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'coach' && (
          <FocusCoachPage
            onStartRecommendedSession={handleStartRecommendedSession}
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'consistency' && (
          <ConsistencyPage
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'weekly-review' && (
          <WeeklyReviewPage
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'journal' && (
          <FocusJournalPage
            onSelectSession={handleSelectHistoricalSession}
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'recommendations' && (
          <RecommendationsPage
            onStartRecommendedSession={handleStartRecommendedSession}
            onCustomizeRecommendation={handleStartRecommendedSession}
            onNavigate={handleNavigate}
            onNewSession={() => handleNavigate('setup')}
          />
        )}

        {currentView === 'history' && (
          <SessionHistoryPage
            onSelectSession={handleSelectHistoricalSession}
            onNewSession={() => handleNavigate('setup')}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onNavigate={handleNavigate}
            onLoginSuccess={(loggedInUser) => {
              if (loggedInUser?.verificationStatus !== 'VERIFIED') {
                handleNavigate('verify');
              } else {
                handleNavigate('dashboard');
              }
            }}
          />
        )}

        {currentView === 'register' && (
          <RegisterPage
            onNavigate={handleNavigate}
            onRegisterSuccess={(targetView, regInfo) => {
              if (regInfo) setRegistrationState(regInfo);
              handleNavigate(targetView || 'verify');
            }}
          />
        )}

        {currentView === 'verify' && (
          <VerificationPage
            onNavigate={handleNavigate}
            registrationState={registrationState}
          />
        )}

        {currentView === 'dashboard' && (
          <PersonalDashboardPage
            onSelectSession={handleSelectHistoricalSession}
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'profile' && (
          <ProfilePage onNavigate={handleNavigate} />
        )}

        {currentView === 'forgot-password' && (
          <ForgotPasswordPage onNavigate={handleNavigate} />
        )}

        {currentView === 'calendar' && (
          <CalendarPage
            onSelectSession={handleSelectHistoricalSession}
            onNewSession={() => handleNavigate('setup')}
            onNavigate={handleNavigate}
          />
        )}

        {['messages', 'options'].includes(currentView) && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm max-w-md mx-auto space-y-4">
              <h2 className="text-xl font-bold text-white capitalize">{currentView}</h2>
              <p className="text-sm text-slate-400">
                This section is coming soon. Focus session tracking and personal intelligence analytics are available on your Dashboard.
              </p>
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-md shadow-brand-600/20 cursor-pointer"
              >
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </main>

        {/* Footer */}
        {!isAppView && <Footer />}
      </div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
