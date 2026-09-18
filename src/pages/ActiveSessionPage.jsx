import React, { useEffect, useRef, useCallback } from 'react';
import { Pause, Play, Square, Clock, Target, Info } from 'lucide-react';
import { formatSecondsToTime } from '../utils/formatters';
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
import { FuturisticTimer } from '../components/FuturisticTimer';
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
  const sessionStartTimeRef = useRef(Date.now());

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

  // Combined data sources payload abstraction for multi-modal activity classifier
  const combinedObservationData = {
    camera: {
      facePresent: faceState === 'FACE_PRESENT',
      phonePresent: phoneState === 'PHONE_PRESENT',
      personCount,
      rawPersonCount,
      personOnPhoneCount,
      isPersonOnPhoneScreen,
      headOrientation,
    },
    screen: {
      activity: screenActivity,
      confidence: screenConfidence,
      sourceType: screenSourceType,
    }
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Top Banner / Activity Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Target Focus Activity</span>
            <h2 className="text-lg font-bold text-white">{activity}</h2>
          </div>
        </div>

        {/* Current Activity Indicator Pill */}
        <div className="flex items-center space-x-3 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Current Inferred Activity</span>
            <span className="text-sm font-extrabold text-brand-300">
              {activityLabel}
            </span>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20" />
        </div>
      </div>

      {/* Compact Current Goal Card */}
      {sessionInfo?.goalText && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-brand-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">CURRENT GOAL</span>
              <h3 className="text-base font-extrabold text-white">{sessionInfo.goalText}</h3>
              {sessionInfo.goalType === 'TIME' && (
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Target: {sessionInfo.targetValue} min focus
                </p>
              )}
            </div>
          </div>

          {/* Goal Progress Display & Controls */}
          {sessionInfo.goalType === 'COUNT' && (
            <div className="flex items-center space-x-3 self-end sm:self-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Progress:</span>
              <div className="flex items-center space-x-2 font-mono font-bold text-sm text-white">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(0, (sessionInfo.goalProgress || 0) - 1);
                    sessionInfo.goalProgress = next;
                    sessionInfo.goalCompleted = sessionInfo.targetValue ? next >= sessionInfo.targetValue : false;
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-base transition-colors"
                  title="Decrease Completed Count"
                >
                  -
                </button>
                <span className="text-emerald-400 px-1 font-mono text-base">
                  {sessionInfo.goalProgress || 0} / {sessionInfo.targetValue || 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(sessionInfo.targetValue || 1000, (sessionInfo.goalProgress || 0) + 1);
                    sessionInfo.goalProgress = next;
                    sessionInfo.goalCompleted = sessionInfo.targetValue ? next >= sessionInfo.targetValue : false;
                  }}
                  className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-base transition-colors"
                  title="Increase Completed Count"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {sessionInfo.goalType === 'TIME' && (
            <div className="text-right bg-slate-950 p-2.5 rounded-xl border border-slate-800 self-end sm:self-auto">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Target Progress</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {Math.floor((totalSeconds - remainingSeconds) / 60)} / {sessionInfo.targetValue} min
              </span>
            </div>
          )}
        </div>
      )}

      {/* Futuristic 3D Timer Container */}
      <FuturisticTimer
        remainingSeconds={remainingSeconds}
        progressPercent={progressPercent}
        isPaused={isPaused}
        pauseStartedAt={pauseStartedAt}
        activity={activityLabel}
        onPause={onPause}
        onResume={onResume}
        onEndSession={handleManualEndSession}
        isCameraActive={isCameraActive}
        isScreenActive={isScreenActive}
      />

      {/* CURRENT ACTIVITY Hero Card (Milestone 9) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse ring-4 ring-brand-500/20" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">CURRENT ACTIVITY</h3>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-full bg-slate-900 text-brand-300 border border-slate-800 font-medium self-start sm:self-auto">
            Inferred from observable signals
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {activityLabel}
            </span>
          </div>
          {evidenceScore !== null && (
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 block">Evidence Score</span>
              <span className="text-sm font-mono font-bold text-brand-400">
                {(evidenceScore * 100).toFixed(0)}% <span className="text-[10px] text-slate-500 font-normal">(heuristic)</span>
              </span>
            </div>
          )}
        </div>

        {explanation && explanation.length > 0 && (
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
            <p className="text-xs font-semibold text-slate-400">Likely based on:</p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {explanation.map((item, idx) => (
                <li key={idx} className="flex items-center space-x-2">
                  <span className="text-brand-400 font-bold text-sm">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Grid: Camera Monitoring, Screen Monitor, AI Monitoring, Live Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

