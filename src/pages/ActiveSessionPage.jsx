import React, { useEffect, useRef, useState } from 'react';
import { Target, Clock, ShieldCheck, Sparkles, Activity, CheckCircle2, Camera, Monitor, Eye } from 'lucide-react';
import { formatSecondsToTime } from '../utils/formatters';
import { formatPauseTime } from '../utils/sessionTimer';
import { useWebcam } from '../hooks/useWebcam';
import { useVideoReady } from '../hooks/useVideoReady';
import { useScreenShare } from '../hooks/useScreenShare';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useHeadOrientation } from '../hooks/useHeadOrientation';
import { useScreenClassifier } from '../hooks/useScreenClassifier';
import { useActivityAnalyzer } from '../hooks/useActivityAnalyzer';
import { ACTIVITY_TYPES, ACTIVITY_LABELS } from '../services/activityAnalyzer';
import { SCREEN_ACTIVITY_LABELS } from '../services/screenClassifier';
import { testFaceModelInit, runSingleFaceTest } from '../services/faceDetector';
import { testObjectModelInit, runSingleObjectTest } from '../services/objectDetector';
import { testLandmarkerInit, runSingleLandmarkerTest } from '../services/headLandmarker';
import { CameraMonitoringCard } from '../components/CameraMonitoringCard';
import { ScreenMonitorCard } from '../components/ScreenMonitorCard';
import { AIMonitoringCard } from '../components/AIMonitoringCard';
import { CircularGlassTimer } from '../components/CircularGlassTimer';
import { PauseConfirmModal } from '../components/PauseConfirmModal';
import { AutoResumeNoticeModal } from '../components/AutoResumeNoticeModal';

export function ActiveSessionPage({
  sessionInfo,
  remainingSeconds,
  isPaused,
  pauseStartedAt = null,
  onPause,
  onResume,
  onEndSession,
  onUpdateSessionSegments,
  isPauseConfirmOpen = false,
  onConfirmPause,
  onCancelPause,
  autoResumeNotice = null,
  onDismissAutoResumeNotice,
}) {
  const { activity, durationMinutes, initialStreams } = sessionInfo || { activity: 'Focus Session', durationMinutes: 25 };
  const totalSeconds = durationMinutes * 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)
  );

  const videoRef = useRef(null);
  const screenVideoRef = useRef(null);

  // Pause duration tracker for countdown display
  const [pauseRemainingSecs, setPauseRemainingSecs] = useState(null);

  useEffect(() => {
    if (!isPaused || !pauseStartedAt) {
      setPauseRemainingSecs(null);
      return;
    }
    const updatePauseInfo = () => {
      const remainingMs = 5 * 60 * 1000 - (Date.now() - pauseStartedAt);
      setPauseRemainingSecs(Math.max(0, Math.ceil(remainingMs / 1000)));
    };
    updatePauseInfo();
    const interval = setInterval(updatePauseInfo, 500);
    return () => clearInterval(interval);
  }, [isPaused, pauseStartedAt]);

  // 1. Webcam Hook
  const {
    stream: cameraStream,
    isCameraActive,
    isLoading: isCameraLoading,
    error: cameraError,
    startCamera,
    stopCamera
  } = useWebcam({ initialStream: initialStreams?.cameraStream });

  // Explicit Video Ready State tracker
  const { isVideoReady, videoStats } = useVideoReady(videoRef, cameraStream, isCameraActive);

  // 2. Screen Share Hook
  const {
    stream: screenStream,
    isScreenActive,
    sourceType: screenSourceType,
    isLoading: isScreenLoading,
    error: screenError,
    startScreenShare,
    stopScreenShare
  } = useScreenShare({ initialStream: initialStreams?.screenStream });

  // 3. Screen Classifier Hook (2000ms periodic canvas snapshot analysis)
  const {
    screenActivity,
    confidence: screenConfidence,
    metrics: screenMetrics,
    debugStats: screenDebugStats,
  } = useScreenClassifier({
    screenVideoRef,
    isScreenActive,
    analysisIntervalMs: 2000,
  });

  // 4. Face Detection Hook
  const {
    detectionState: faceState,
    confidence: faceConfidence,
    modelStatus: faceModelStatus,
    inferenceStatus: faceInferenceStatus,
    modelError: faceModelError,
    debugStats: faceDebugStats,
  } = useFaceDetection({
    videoRef,
    isCameraActive,
    isVideoReady,
    detectionIntervalMs: 500,
  });

  // 5. Object Detection Hook
  const {
    phoneState,
    phoneConfidence,
    personState,
    personCount,
    rawPersonCount,
    personOnPhoneCount,
    isPersonOnPhoneScreen,
    modelStatus: objectModelStatus,
    inferenceStatus: objectInferenceStatus,
    error: objectModelError,
    debugStats: objectDebugStats,
  } = useObjectDetection({
    videoRef,
    isCameraActive,
    isVideoReady,
    detectionIntervalMs: 500,
  });

  // 6. Head Orientation Hook
  const {
    orientation: headOrientation,
    confidence: headConfidence,
    metrics: headMetrics,
    modelStatus: headModelStatus,
    inferenceStatus: headInferenceStatus,
    error: headModelError,
    debugStats: headDebugStats,
  } = useHeadOrientation({
    videoRef,
    isCameraActive,
    isVideoReady,
    detectionIntervalMs: 500,
  });

  // 8. Activity Analyzer Hook
  const {
    currentActivity,
    activityLabel,
    activitySegments,
    explanation,
    evidenceScore,
  } = useActivityAnalyzer({
    isCameraActive,
    isFacePresent: faceState === 'FACE_PRESENT',
    isPhonePresent: phoneState === 'PHONE_PRESENT',
    personCount,
    rawPersonCount,
    personOnPhoneCount,
    isPersonOnPhoneScreen,
    headOrientation,
    isScreenActive,
    screenActivity,
    screenConfidence,
    screenSourceType,
  });

  // Keep parent session state updated with live activity segments
  useEffect(() => {
    if (onUpdateSessionSegments) {
      onUpdateSessionSegments(activitySegments);
    }
  }, [activitySegments, onUpdateSessionSegments]);

  // Stop camera and screen share on countdown completion
  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (isCameraActive) stopCamera();
      if (isScreenActive) stopScreenShare();
    }
  }, [remainingSeconds, isCameraActive, isScreenActive, stopCamera, stopScreenShare]);

  // Manual End Session wrapper
  const handleManualEndSession = () => {
    stopCamera();
    stopScreenShare();
    onEndSession();
  };

  // Real distractions count from tracked session activity segments
  const distractionCount = (activitySegments || []).filter(
    (s) => s.type === 'PHONE_ACTIVITY' || s.type === 'DISTRACTED' || s.type === 'OFF_TASK' || s.type === 'MULTIPLE_PEOPLE'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      {/* =========================================
          PAGE HEADER: STATUS PILL + HEADING + SUBTITLE
      ========================================= */}
      <div className="flex flex-col items-center text-center space-y-2.5">
        {/* Small "Session Active" status indicator */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-sm">
          <span className={`w-2 h-2 rounded-full ${
            isPaused
              ? 'bg-amber-400 animate-pulse ring-4 ring-amber-500/20'
              : remainingSeconds <= 0
              ? 'bg-emerald-400 ring-4 ring-emerald-500/20'
              : 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20'
          }`} />
          <span className="text-xs font-semibold tracking-wide text-slate-200">
            {isPaused ? (
              <span className="text-amber-300">
                Session Paused {pauseRemainingSecs !== null ? `• Auto-resumes in ${formatPauseTime(pauseRemainingSecs)}` : '• Paused'}
              </span>
            ) : remainingSeconds <= 0 ? (
              <span className="text-emerald-300">Session Complete</span>
            ) : (
              <span className="text-emerald-300">Session Active</span>
            )}
          </span>
        </div>

        {/* Main Heading & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Focus Session
        </h1>
        <p className="text-sm text-slate-400 font-medium max-w-md">
          {isPaused
            ? 'Session paused. Take a brief breath and reset.'
            : 'Stay focused. Make it count.'}
        </p>
      </div>

      {/* =========================================
          THREE-COLUMN PRODUCTIVITY DASHBOARD
      ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* --- LEFT COLUMN: FOCUS CARDS (lg:col-span-3) --- */}
        <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">
          {/* 1. Focus Session Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Focus Session</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700/50">
                {durationMinutes}m
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Target Activity</span>
              <h4 className="text-base font-bold text-white tracking-tight mt-0.5 truncate" title={activity}>
                {activity}
              </h4>
            </div>

            {/* Goal information if set */}
            {sessionInfo?.goalText && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-emerald-400">Current Goal</span>
                  {sessionInfo.goalType === 'TIME' && (
                    <span className="font-mono text-emerald-400 font-semibold">
                      {Math.floor((totalSeconds - remainingSeconds) / 60)} / {sessionInfo.targetValue} min
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-200 leading-snug">{sessionInfo.goalText}</p>

                {sessionInfo.goalType === 'COUNT' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Completed:</span>
                    <div className="flex items-center space-x-1.5 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0, (sessionInfo.goalProgress || 0) - 1);
                          sessionInfo.goalProgress = next;
                          sessionInfo.goalCompleted = sessionInfo.targetValue ? next >= sessionInfo.targetValue : false;
                        }}
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center font-bold"
                        title="Decrease count"
                      >
                        -
                      </button>
                      <span className="px-2 text-emerald-400 font-bold">
                        {sessionInfo.goalProgress || 0} / {sessionInfo.targetValue || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(sessionInfo.targetValue || 1000, (sessionInfo.goalProgress || 0) + 1);
                          sessionInfo.goalProgress = next;
                          sessionInfo.goalCompleted = sessionInfo.targetValue ? next >= sessionInfo.targetValue : false;
                        }}
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center font-bold"
                        title="Increase count"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Today's Focus Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-3.5 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Today's Focus</h3>
              </div>
              <span className="text-[10px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                Interval
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-400 font-medium">Elapsed Focus</span>
                <span className="text-sm font-mono font-bold text-white">
                  {formatSecondsToTime(totalSeconds - remainingSeconds)}
                </span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Inferred Mode</span>
              <span className="font-semibold text-cyan-300 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{activityLabel}</span>
              </span>
            </div>
          </div>

          {/* 3. Distractions Blocked Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-3 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Distractions Blocked</h3>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                distractionCount === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}>
                {distractionCount} Blocked
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phone Status:</span>
                <span className={phoneState === 'PHONE_PRESENT' ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-medium'}>
                  {phoneState === 'PHONE_PRESENT' ? 'Detected on desk' : 'No phone distraction'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Workspace Zone:</span>
                <span className={personCount > 1 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-medium'}>
                  {personCount > 1 ? `${personCount} People in view` : 'Solo focus zone'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
              {distractionCount === 0 ? 'Clean uninterrupted attention streak.' : 'Logged for post-session analytics.'}
            </p>
          </div>
        </div>

        {/* --- CENTER COLUMN: LARGE GLASSMORPHIC CIRCULAR TIMER (lg:col-span-6) --- */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-10 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 shadow-2xl order-1 lg:order-2">
          <CircularGlassTimer
            remainingSeconds={remainingSeconds}
            totalSeconds={totalSeconds}
            progressPercent={progressPercent}
            isPaused={isPaused}
            pauseRemainingSecs={pauseRemainingSecs}
            activity={activity}
            onPause={onPause}
            onResume={onResume}
            onEndSession={handleManualEndSession}
          />
        </div>

        {/* --- RIGHT COLUMN: MOTIVATION & SESSION STATS (lg:col-span-3) --- */}
        <div className="lg:col-span-3 space-y-5 order-3">
          {/* 1. Motivational / Focus Message Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/70 to-slate-950/80 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-2.5 hover:border-slate-700/80 transition-all">
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Mindful Focus</span>
            </div>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              {isPaused
                ? '"Rest is part of the work. Step back, breathe, and return with renewed clarity."'
                : progressPercent > 80
                ? '"Home stretch. Give this final interval your full dedicated attention."'
                : '"Deep focus builds momentum. Single-task your way to meaningful progress."'}
            </p>
            <div className="text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-800/80">
              Tip: Keep off-task tabs closed until your timer completes.
            </div>
          </div>

          {/* 2. Meaningful Session Statistics Card */}
          <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-3.5 hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Session Stats</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Live</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Completed</span>
                <span className="text-base font-mono font-bold text-white">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Remaining</span>
                <span className="text-base font-mono font-bold text-cyan-400">
                  {formatSecondsToTime(remainingSeconds)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Interval</span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  {durationMinutes} min
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Confidence</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  {evidenceScore !== null ? `${(evidenceScore * 100).toFixed(0)}%` : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Focus-Related Status Checklist (Real data only) */}
          <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-3 hover:border-slate-700/80 transition-all">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Focus Status</h3>
            </div>

            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  <span>Camera</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCameraActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isCameraActive ? 'Active' : 'Standby'}
                </span>
              </li>

              <li className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  <span>Screen Share</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isScreenActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isScreenActive ? 'Active' : 'Standby'}
                </span>
              </li>

              <li className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Head Orientation</span>
                </div>
                <span className="text-[10px] font-mono text-slate-300">
                  {headOrientation || 'FORWARD'}
                </span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* =========================================
          MONITORING CARDS: CAMERA, SCREEN & AI
      ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-800/80">
        <CameraMonitoringCard
          stream={cameraStream}
          isCameraActive={isCameraActive}
          isLoading={isCameraLoading}
          error={cameraError}
          onEnableCamera={startCamera}
          onDisableCamera={stopCamera}
          videoRef={videoRef}
        />

        <ScreenMonitorCard
          stream={screenStream}
          isScreenActive={isScreenActive}
          sourceType={screenSourceType}
          isLoading={isScreenLoading}
          error={screenError}
          onEnableScreen={startScreenShare}
          onDisableScreen={stopScreenShare}
          videoRef={screenVideoRef}
        />

        <AIMonitoringCard
          isCameraActive={isCameraActive}
          isVideoReady={isVideoReady}
          videoStats={videoStats}
          isScreenActive={isScreenActive}
          screenSourceType={screenSourceType}
          screenActivity={screenActivity}
          screenConfidence={screenConfidence}
          screenMetrics={screenMetrics}
          faceState={faceState}
          faceConfidence={faceConfidence}
          phoneState={phoneState}
          phoneConfidence={phoneConfidence}
          personState={personState}
          personCount={personCount}
          headOrientation={headOrientation}
          headMetrics={headMetrics}
          headConfidence={headConfidence}
          faceModelStatus={faceModelStatus}
          objectModelStatus={objectModelStatus}
          headModelStatus={headModelStatus}
          faceInferenceStatus={faceInferenceStatus}
          objectInferenceStatus={objectInferenceStatus}
          headInferenceStatus={headInferenceStatus}
          faceModelError={faceModelError}
          objectModelError={objectModelError}
          headModelError={headModelError}
          faceDebugStats={faceDebugStats}
          objectDebugStats={objectDebugStats}
          headDebugStats={headDebugStats}
          screenDebugStats={screenDebugStats}
          onTestFaceInit={testFaceModelInit}
          onRunFaceTest={() => runSingleFaceTest(videoRef.current)}
          onTestObjectInit={testObjectModelInit}
          onRunObjectTest={() => runSingleObjectTest(videoRef.current)}
          onTestLandmarkerInit={testLandmarkerInit}
          onRunLandmarkerTest={() => runSingleLandmarkerTest(videoRef.current)}
        />
      </div>

      {/* 5-Minute Maximum Pause Warning & Confirmation Modal */}
      <PauseConfirmModal
        isOpen={isPauseConfirmOpen}
        onConfirm={onConfirmPause}
        onCancel={onCancelPause}
      />

      {/* 5-Minute Auto-Resume Notification Modal */}
      <AutoResumeNoticeModal
        isOpen={Boolean(autoResumeNotice)}
        message={autoResumeNotice}
        onDismiss={onDismissAutoResumeNotice}
      />
    </div>
  );
}
