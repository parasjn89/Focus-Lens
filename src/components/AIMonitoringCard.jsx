import React from 'react';
import { Cpu, ShieldCheck, Sparkles } from 'lucide-react';
import { FACE_STATES } from '../services/faceTracker';
import { PHONE_STATES } from '../services/phoneTracker';
import { PERSON_STATES } from '../services/personTracker';
import { HEAD_ORIENTATIONS } from '../services/headPoseEstimator';
import { SCREEN_ACTIVITIES, SCREEN_ACTIVITY_LABELS } from '../services/screenClassifier';

export function AIMonitoringCard({
  isCameraActive,
  isVideoReady = false,
  videoStats = { videoWidth: 0, videoHeight: 0, readyState: 0, paused: true },
  isScreenActive = false,
  screenSourceType = 'unknown',
  screenActivity = SCREEN_ACTIVITIES.UNKNOWN,
  screenConfidence = null,
  screenMetrics = { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 },
  faceState,
  faceConfidence,
  phoneState,
  phoneConfidence,
  personState,
  personCount,
  headOrientation = HEAD_ORIENTATIONS.UNKNOWN,
  headMetrics = { yaw: 0, pitch: 0 },
  headConfidence,
  faceModelStatus = 'IDLE',
  objectModelStatus = 'IDLE',
  headModelStatus = 'IDLE',
  faceInferenceStatus = 'STOPPED',
  objectInferenceStatus = 'STOPPED',
  headInferenceStatus = 'STOPPED',
  faceModelError = null,
  objectModelError = null,
  headModelError = null,
  faceDebugStats = {},
  objectDebugStats = {},
  headDebugStats = {},
  screenDebugStats = {},
  onTestFaceInit = null,
  onRunFaceTest = null,
  onTestObjectInit = null,
  onRunObjectTest = null,
  onTestLandmarkerInit = null,
  onRunLandmarkerTest = null,
}) {
  const isFaceDetected = faceState === FACE_STATES.FACE_PRESENT;
  const isPhoneDetected = phoneState === PHONE_STATES.PHONE_PRESENT;

  // Format person text display
  const getPersonDisplayText = () => {
    if (!isCameraActive) return 'Camera Off';
    if (personState === PERSON_STATES.NO_PERSON) return 'No person';
    if (personState === PERSON_STATES.ONE_PERSON) return '1 person';
    return `Multiple people (${personCount})`;
  };

  // Format head direction display text
  const getHeadOrientationText = () => {
    if (!isCameraActive) return 'Camera Off';
    switch (headOrientation) {
      case HEAD_ORIENTATIONS.FORWARD:
        return 'Forward';
      case HEAD_ORIENTATIONS.LEFT:
        return 'Looking left';
      case HEAD_ORIENTATIONS.RIGHT:
        return 'Looking right';
      case HEAD_ORIENTATIONS.DOWN:
        return 'Looking down';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Monitoring</h3>
            <p className="text-xs text-slate-400">Local Browser Vision Models</p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          <Sparkles className="w-3 h-3 text-brand-400 mr-1" />
          <span>MediaPipe</span>
        </span>
      </div>

      {/* Main Status Indicators */}
      <div className="space-y-2 flex-1 flex flex-col justify-center my-1">
        {/* 1. Camera Status */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Camera</span>
          <span className={`inline-flex items-center font-semibold ${isCameraActive ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {isCameraActive ? 'Active' : 'Disabled'}
          </span>
        </div>

        {/* 2. Screen Status & Detected Activity */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Screen Activity</span>
          {!isScreenActive ? (
            <span className="text-slate-500">Not active</span>
          ) : (
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center font-semibold ${
                screenActivity !== SCREEN_ACTIVITIES.UNKNOWN ? 'text-cyan-300' : 'text-slate-400'
              }`}>
                <span className="w-2 h-2 rounded-full bg-cyan-400 mr-1.5 animate-pulse" />
                {SCREEN_ACTIVITY_LABELS[screenActivity] || screenActivity}
              </span>
              {screenConfidence !== null && (
                <span className="font-mono text-[10px] text-slate-400">
                  ({Math.round(screenConfidence * 100)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3. Face Detection Status */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Face</span>
          {!isCameraActive ? (
            <span className="text-slate-500">Camera Off</span>
          ) : isFaceDetected ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                Detected
              </span>
              {faceConfidence !== null && (
                <span className="font-mono text-[10px] text-slate-400 font-medium">
                  ({Math.round(faceConfidence * 100)}%)
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center text-amber-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5" />
              Not detected
            </span>
          )}
        </div>

        {/* 4. Head Orientation Status */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Head orientation</span>
          {!isCameraActive ? (
            <span className="text-slate-500">Camera Off</span>
          ) : (
            <span className={`inline-flex items-center font-semibold ${
              headOrientation === HEAD_ORIENTATIONS.FORWARD 
                ? 'text-emerald-400' 
                : headOrientation === HEAD_ORIENTATIONS.UNKNOWN 
                  ? 'text-slate-400' 
                  : 'text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-1.5 ${
                headOrientation === HEAD_ORIENTATIONS.FORWARD ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              {getHeadOrientationText()}
            </span>
          )}
        </div>

        {/* 5. Phone Detection Status */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Phone</span>
          {!isCameraActive ? (
            <span className="text-slate-500">Camera Off</span>
          ) : isPhoneDetected ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
                Detected
              </span>
              {phoneConfidence !== null && (
                <span className="font-mono text-[10px] text-slate-400 font-medium">
                  ({Math.round(phoneConfidence * 100)}%)
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
              Not detected
            </span>
          )}
        </div>

        {/* 6. Person Count Status */}
        <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">People</span>
          {!isCameraActive ? (
            <span className="text-slate-500">Camera Off</span>
          ) : (
            <span className={`font-semibold ${
              personState === PERSON_STATES.MULTIPLE_PEOPLE 
                ? 'text-amber-400' 
                : personState === PERSON_STATES.ONE_PERSON 
                  ? 'text-emerald-400' 
                  : 'text-slate-400'
            }`}>
              {getPersonDisplayText()}
            </span>
          )}
        </div>
      </div>

      {/* Privacy Note */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Screen analysis is processed locally in your browser. Screen content is not uploaded.</span>
        </div>
      </div>
    </div>
  );
}

