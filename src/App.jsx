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
import { AuthProvider, useAuth } from './context/AuthContext';
import { startSession, saveSessionSegments, finalizeSession } from './api/sessionApi';
import { initBackgroundSync } from './api/syncManager';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  // Navigation state: 'landing' | 'setup' | 'active' | 'report' | 'history' | 'login' | 'register' | 'dashboard' | 'profile' | 'verify' | 'forgot-password' | 'coach' | 'consistency'
  const [currentView, setCurrentView] = useState('landing');
  const [prefilledSetupConfig, setPrefilledSetupConfig] = useState(null);

  // Session configuration & persistent record state
  const [sessionConfig, setSessionConfig] = useState({
    activity: 'Studying',
    durationMinutes: 25,
  });
  const [activeBackendSession, setActiveBackendSession] = useState(null);

  // Countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const pauseStartTimeRef = useRef(null);

  // Track activity segments and report data  const [activeSessionSegments, setActiveSessionSegments] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Initialize background retry sync manager on mount & check URL params
  useEffect(() => {
    initBackgroundSync();
    if (window.location.search.includes('token=') || window.location.pathname.includes('reset-password')) {
      setCurrentView('forgot-password');
    }
  }, []);

  // Handle protected route navigation
  const handleNavigate = (view) => {
    const protectedViews = ['dashboard', 'profile', 'history', 'verify', 'coach', 'consistency', 'recommendations'];
    if (protectedViews.includes(view) && !isAuthenticated && !isLoading) {
      setCurrentView('login');
      return;
    }
    setCurrentView(view);
  };

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

  // Countdown Timer Hook Effect
  useEffect(() => {
    let intervalId = null;

    if (isTimerRunning && !isTimerPaused) {
      intervalId = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            finishSession(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (isTimerRunning && isTimerPaused) {
      // Enforce 5-minute maximum pause timeout
      intervalId = setInterval(() => {
        if (pauseStartTimeRef.current) {
          const elapsedPaused = Date.now() - pauseStartTimeRef.current;
          if (elapsedPaused >= 300000) { // 5 minutes in ms
            // Auto resume
            pauseStartTimeRef.current = null;
            setIsTimerPaused(false);
          }
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTimerRunning, isTimerPaused]);

  // Handler to initialize a new focus session
  const handleStartSession = async ({ activity, durationMinutes, goalText = null, goalType = 'NONE', targetValue = null, targetUnit = null, initialStreams }) => {
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
    setIsTimerRunning(true);
    setIsTimerPaused(false);
    setActiveSessionSegments([]);

    // Create session in backend / local fallback store
    try {
      const { session, isOfflineFallback } = await startSession({
        plannedDurationMs,
        selectedActivity: activity,
        goalText,
        goalType,
        targetValue,
        targetUnit,
      });
      setActiveBackendSession(session);
    } catch (err) {
      console.warn('Failed to register session with backend:', err);
    }

    setCurrentView('active');
  };

  // Pause timer handler
  const handlePauseTimer = () => {
    pauseStartTimeRef.current = Date.now();
    setIsTimerPaused(true);
  };

  // Resume timer handler
  const handleResumeTimer = () => {
    pauseStartTimeRef.current = null;
    setIsTimerPaused(false);  };
  // Complete session (either via countdown end or user manual end)
  const finishSession = async (isAutoCompleted = false) => {
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    pauseStartTimeRef.current = null;

    const scheduledSeconds = sessionConfig.durationMinutes * 60;
    const actualSecondsSpent = scheduledSeconds - remainingSeconds;
    const actualDurationMs = (actualSecondsSpent > 0 ? actualSecondsSpent : scheduledSeconds) * 1000;

    let finalGoalProgress = activeBackendSession?.goalProgress ?? (sessionConfig.goalProgress || 0);
    let finalGoalCompleted = activeBackendSession?.goalCompleted ?? (sessionConfig.goalCompleted || false);

    // Save activity segments & finalize backend session
    if (activeBackendSession && activeBackendSession.id) {
      try {
        await saveSessionSegments(activeBackendSession.id, activeSessionSegments);
        const finalized = await finalizeSession(activeBackendSession.id, {
          actualDurationMs,
          pausedDurationMs: 0,
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

    const summaryReport = {
      activity: sessionConfig.activity,
      targetMinutes: sessionConfig.durationMinutes,
      actualSecondsSpent: actualSecondsSpent > 0 ? actualSecondsSpent : scheduledSeconds,
      activitySegments: activeSessionSegments,
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
    setCurrentView('report');
  };

  // End session manually button click
  const handleEndSession = () => {
    finishSession(false);
  };

  // Select historical session to view report
  const handleSelectHistoricalSession = (session) => {
    const actualSecs = session.actualDurationMs ? Math.round(session.actualDurationMs / 1000) : 0;
    const plannedMins = session.plannedDurationMs ? Math.round(session.plannedDurationMs / 60000) : 25;

    setReportData({
      activity: session.selectedActivity || 'Focus Session',
      targetMinutes: plannedMins,
      actualSecondsSpent: actualSecs,
      activitySegments: session.activitySegments || [],
      isAutoCompleted: true,
      completedAt: session.startedAt ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Previous Session',
      isHistorical: true,
    });
    setCurrentView('report');
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
            onCancel={() => handleNavigate('landing')}
          />
        )}

        {currentView === 'active' && (
          <ActiveSessionPage
            sessionInfo={sessionConfig}
            remainingSeconds={remainingSeconds}
            isPaused={isTimerPaused}
            onPause={handlePauseTimer}
            onResume={handleResumeTimer}
            onEndSession={handleEndSession}            onUpdateSessionSegments={(segments) => setActiveSessionSegments(segments)}
          />
        )}

        {currentView === 'report' && (
          <SessionReportPage
            reportData={reportData}
            onNewSession={() => handleNavigate('setup')}
            onHome={() => handleNavigate('landing')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'coach' && (
          <FocusCoachPage
            onStartRecommendedSession={handleStartRecommendedSession}
            onNewSession={() => handleNavigate('setup')}
          />
        )}

        {currentView === 'consistency' && (
          <ConsistencyPage
            onNewSession={() => handleNavigate('setup')}
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
            onLoginSuccess={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'register' && (
          <RegisterPage
            onNavigate={handleNavigate}
            onRegisterSuccess={(targetView) => setCurrentView(targetView || 'verify')}
          />
        )}

        {currentView === 'verify' && (
          <VerificationPage onNavigate={handleNavigate} />
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
