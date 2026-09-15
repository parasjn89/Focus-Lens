import React, { useEffect, useRef, useCallback } from 'react';
import { Pause, Play, Square, Clock, Target, Info } from 'lucide-react';
import { formatSecondsToTime } from '../utils/formatters';
import { useWebcam } from '../hooks/useWebcam';
import { useVideoReady } from '../hooks/useVideoReady';
import { useScreenShare } from '../hooks/useScreenShare';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useHeadOrientation } from '../hooks/useHeadOrientation';
import { useMicrophone } from '../hooks/useMicrophone';
import { useScreenClassifier } from '../hooks/useScreenClassifier';
import { useActivityAnalyzer } from '../hooks/useActivityAnalyzer';
import { ACTIVITY_TYPES, ACTIVITY_LABELS } from '../services/activityAnalyzer';
import { SCREEN_ACTIVITY_LABELS } from '../services/screenClassifier';
import { testFaceModelInit, runSingleFaceTest } from '../services/faceDetector';
import { testObjectModelInit, runSingleObjectTest } from '../services/objectDetector';
import { testLandmarkerInit, runSingleLandmarkerTest } from '../services/headLandmarker';
import { CameraMonitoringCard } from '../components/CameraMonitoringCard';
import { ScreenMonitorCard } from '../components/ScreenMonitorCard';
import { MicrophoneMonitoringCard } from '../components/MicrophoneMonitoringCard';
import { AIMonitoringCard } from '../components/AIMonitoringCard';
import { LiveSessionSummaryCard } from '../components/LiveSessionSummaryCard';
import { EventTimelinePlaceholder } from '../components/EventTimelinePlaceholder';


export function ActiveSessionPage({
  sessionInfo,
  remainingSeconds,
  isPaused,
  onPause,
  onResume,
  onEndSession,
  eventLogs,
  onAddEventLog,
  onUpdateSessionSegments,
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
  const handleScreenActivityStateChange = useCallback((evt) => {
    if (onAddEventLog && evt) {
      const label = `Screen: ${SCREEN_ACTIVITY_LABELS[evt.activity] || evt.activity}`;
      const desc = `Local screen content classified as ${SCREEN_ACTIVITY_LABELS[evt.activity] || evt.activity} (${Math.round((evt.confidence || 0.85) * 100)}% confidence).`;
      onAddEventLog(label, desc);
    }
  }, [onAddEventLog]);

  const {
    screenActivity,
    confidence: screenConfidence,
    metrics: screenMetrics,
    debugStats: screenDebugStats,
  } = useScreenClassifier({
    screenVideoRef,
    isScreenActive,
    analysisIntervalMs: 2000,
    onStateChangeEvent: handleScreenActivityStateChange,
  });

  // Handle screen state change event logging
  useEffect(() => {
    if (onAddEventLog && isScreenActive) {
      onAddEventLog('Screen Monitoring Enabled', `Sharing context: ${screenSourceType}`);
    }
  }, [isScreenActive, screenSourceType, onAddEventLog]);

  // 4. Face Detection Hook
  const handleFaceStateChange = useCallback((evt) => {
    if (onAddEventLog) {
      const label = evt.type === 'FACE_PRESENT' ? 'Person Present' : 'Person Absent';
      const desc = evt.type === 'FACE_PRESENT'
        ? `User observed in camera feed (Confidence: ${Math.round((evt.confidence || 0.9) * 100)}%)`
        : 'No face observed in camera feed for debounced threshold window.';
      onAddEventLog(label, desc);
    }
  }, [onAddEventLog]);

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
    onStateChangeEvent: handleFaceStateChange,
  });

  // 5. Object Detection Hook
  const handleObjectObservationChange = useCallback((evt) => {
    if (onAddEventLog && evt) {
      if (evt.type === 'PHONE_PRESENT') {
        onAddEventLog('Phone Interference', `Cell phone detected in camera view (${Math.round((evt.confidence || 0.85) * 100)}% confidence).`);
      } else if (evt.type === 'PHONE_ABSENT') {
        onAddEventLog('Phone Removed', 'Cell phone no longer observed in frame.');
      } else if (evt.state === 'MULTIPLE_PEOPLE') {
        onAddEventLog('Multiple People Observed', `${evt.count} people detected in camera view.`);
      } else if (evt.state === 'ONE_PERSON' && evt.stateChanged) {
        onAddEventLog('Single Person Observed', 'Returned to 1 person in frame.');
      }
    }
  }, [onAddEventLog]);

  const handleSpanCompleted = useCallback((span) => {
    if (onAddEventLog && span) {
      if (span.type === 'PHONE_PRESENT') {
        onAddEventLog('Phone Span Event', `Cell phone interference observed for ${span.durationSeconds}s duration.`);
      } else if (span.type === 'MULTIPLE_PEOPLE') {
        onAddEventLog('Multiple People Span', `Second person present for ${span.durationSeconds}s duration.`);
      }
    }
  }, [onAddEventLog]);

  const {
    phoneState,
    phoneConfidence,
    personState,
    personCount,
    modelStatus: objectModelStatus,
    inferenceStatus: objectInferenceStatus,
    error: objectModelError,
    debugStats: objectDebugStats,
  } = useObjectDetection({
    videoRef,
    isCameraActive,
    isVideoReady,
    detectionIntervalMs: 500,
    onObservationEvent: handleObjectObservationChange,
    onSpanCompletedEvent: handleSpanCompleted,
  });

  // 6. Head Orientation Hook
  const handleHeadStateChange = useCallback((evt) => {
    if (onAddEventLog && evt) {
      let desc = `Head orientation: ${evt.orientation}`;
      if (evt.orientation === 'FORWARD') desc = 'Head oriented forward toward camera/screen.';
      else if (evt.orientation === 'LEFT') desc = 'Head turned to the left.';
      else if (evt.orientation === 'RIGHT') desc = 'Head turned to the right.';
      else if (evt.orientation === 'DOWN') desc = 'Head tilted downward.';

      onAddEventLog(`Head ${evt.orientation.toLowerCase()}`, desc);
    }
  }, [onAddEventLog]);

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
    onStateChangeEvent: handleHeadStateChange,
  });

  // 7. Microphone Hook
  const handleSpeechStateChange = useCallback((evt) => {
    if (onAddEventLog && evt) {
      if (evt.activity === 'SPEECH_LIKE') {
        onAddEventLog('Speech Activity Detected', 'Speech-like audio activity detected locally on microphone input.');
      } else if (evt.activity === 'SILENCE') {
        onAddEventLog('Silence Restored', 'Audio returned to silent baseline.');
      }
    }
  }, [onAddEventLog]);

  const {
    stream: micStream,
    isMicrophoneActive,
    isLoading: isMicLoading,
    error: micError,
    speechState,
    isSpeechDetected,
    audioLevel,
    debugStats: micDebugStats,
    startMicrophone,
    stopMicrophone,
  } = useMicrophone({
    initialStream: initialStreams?.micStream,
    onSpeechStateChangeEvent: handleSpeechStateChange,
  });

  // 8. Activity Analyzer Hook
  const handleActivityChanged = useCallback((newActivity) => {
    if (onAddEventLog) {
      onAddEventLog('Activity State', `Inferred Activity: ${ACTIVITY_LABELS[newActivity] || newActivity}`);
    }
  }, [onAddEventLog]);

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
    headOrientation,
    isScreenActive,
    screenActivity,
    screenConfidence,
    screenSourceType,
    isMicrophoneActive,
    speechState,
    isSpeechDetected,
    audioLevel,
    onActivityChanged: handleActivityChanged,
  });

  // Combined data sources payload abstraction for multi-modal activity classifier
  const combinedObservationData = {
    camera: {
      facePresent: faceState === 'FACE_PRESENT',
      phonePresent: phoneState === 'PHONE_PRESENT',
      personCount,
      headOrientation,
    },
    screen: {
      activity: screenActivity,
      confidence: screenConfidence,
      sourceType: screenSourceType,
    },
    audio: {
      isMicrophoneActive,
      speechState,
      audioLevel,
    }
  };

  // Keep parent session state updated with live activity segments
  useEffect(() => {
    if (onUpdateSessionSegments) {
      onUpdateSessionSegments(activitySegments);
    }
  }, [activitySegments, onUpdateSessionSegments]);

  // Stop camera, screen share, and microphone on countdown completion
  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (isCameraActive) stopCamera();
      if (isScreenActive) stopScreenShare();
      if (isMicrophoneActive) stopMicrophone();
    }
  }, [remainingSeconds, isCameraActive, isScreenActive, isMicrophoneActive, stopCamera, stopScreenShare, stopMicrophone]);

  // Manual End Session wrapper
  const handleManualEndSession = () => {
    stopCamera();
    stopScreenShare();
    stopMicrophone();
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
                    if (onAddEventLog) onAddEventLog('Goal Progress Updated', `Progress set to ${next}/${sessionInfo.targetValue}`);
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
                    if (onAddEventLog) onAddEventLog('Goal Progress Updated', `Progress set to ${next}/${sessionInfo.targetValue}`);
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

      {/* Main Hero Timer Display Container */}
      <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-slate-800 text-center relative overflow-hidden flex flex-col items-center justify-center">
        {/* Glow halo behind timer */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand-600/15 blur-[100px] rounded-full pointer-events-none" />

        {/* Status Badge */}
        <div className="mb-2 inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800">
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
          <span className={isPaused ? 'text-amber-400' : 'text-emerald-400'}>
            {isPaused ? 'Session Paused' : 'Session In Progress'}
          </span>
        </div>

        {/* Inferred Activity Note */}
        <p className="text-[11px] text-slate-400 mb-2 italic">
          Activity is inferred from observable signals.
        </p>

        {/* Large Countdown Timer */}
        <div className="my-1">
          <span className="text-6xl sm:text-8xl font-extrabold tracking-tight text-white font-mono timer-glow select-none">
            {formatSecondsToTime(remainingSeconds)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md bg-slate-900 rounded-full h-2 my-6 overflow-hidden border border-slate-800/80">
          <div
            className="bg-gradient-to-r from-brand-600 to-indigo-400 h-full transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Control Buttons (Pause, Resume, End) */}
        <div className="flex items-center justify-center gap-4 mt-2">
          {isPaused ? (
            <button
              onClick={onResume}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="px-6 py-3 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/20 flex items-center space-x-2 transition-all hover:scale-105"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={handleManualEndSession}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800/50 text-slate-300 font-semibold text-sm border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>End Session</span>
          </button>
        </div>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <MicrophoneMonitoringCard
          isMicrophoneActive={isMicrophoneActive}
          isLoading={isMicLoading}
          error={micError}
          speechState={speechState}
          audioLevel={audioLevel}
          debugStats={micDebugStats}
          onEnableMicrophone={startMicrophone}
          onDisableMicrophone={stopMicrophone}
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


        <LiveSessionSummaryCard
          activitySegments={activitySegments}
          currentActivityLabel={activityLabel}
          isCameraActive={isCameraActive}
        />

        <EventTimelinePlaceholder
          activity={activity}
          events={eventLogs}
          activitySegments={activitySegments}
          sessionStartTime={sessionStartTimeRef.current}
        />
      </div>
    </div>
  );
}

