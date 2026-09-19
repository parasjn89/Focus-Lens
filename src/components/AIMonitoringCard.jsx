import React from 'react';
import { Cpu, ShieldCheck, Sparkles, Camera, Monitor, UserCheck, Compass, Smartphone, Users, Info } from 'lucide-react';
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
    const norm = (headOrientation || '').toUpperCase();
    switch (norm) {
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
    <div className="group rounded-3xl p-6 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 flex flex-col justify-between h-full shadow-2xl shadow-black/50 hover:shadow-indigo-500/5 transition-all duration-300">
      {/* Ambient subtle top glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent pointer-events-none" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner bg-indigo-500/10 text-indigo-400 border-indigo-500/25 shadow-indigo-500/10">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">AI Monitoring</h3>
              <p className="text-xs text-slate-400 font-normal">Local Browser Vision Models</p>
            </div>
          </div>

          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-sm">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>MediaPipe</span>
          </span>
        </div>

        {/* 6 Main Status Indicator Rows */}
        <div className="space-y-2 mb-4">
          {/* 1. Camera Status Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <Camera className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">Camera</span>
              <span title="Verifies webcam availability for on-device posture and presence detection" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            <span className={`inline-flex items-center font-semibold ${isCameraActive ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isCameraActive ? 'Active' : 'Disabled'}
            </span>
          </div>

          {/* 2. Screen Status & Detected Activity Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <Monitor className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">Screen Activity</span>
              <span title="Heuristic classification of active workspace (Coding, Reading, Lecture, etc.)" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            {!isScreenActive ? (
              <span className="font-medium text-slate-500">Not active</span>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className={`inline-flex items-center font-semibold ${
                  (screenActivity || '').toUpperCase() !== SCREEN_ACTIVITIES.UNKNOWN ? 'text-cyan-300' : 'text-slate-400'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5 animate-pulse" />
                  {SCREEN_ACTIVITY_LABELS[(screenActivity || '').toUpperCase()] || SCREEN_ACTIVITY_LABELS[screenActivity] || screenActivity}
                </span>
                {screenConfidence !== null && (
                  <span className="font-mono text-[10px] text-slate-400">
                    ({Math.round(screenConfidence * 100)}%)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. Face Detection Status Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">Face</span>
              <span title="On-device face presence observation via MediaPipe Vision" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            {!isCameraActive ? (
              <span className="font-medium text-slate-500">Camera Off</span>
            ) : isFaceDetected ? (
              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
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
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
                Not detected
              </span>
            )}
          </div>

          {/* 4. Head Orientation Status Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <Compass className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">Head orientation</span>
              <span title="Pitch and yaw angle analysis to verify attention toward workspace" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            {!isCameraActive ? (
              <span className="font-medium text-slate-500">Camera Off</span>
            ) : (
              <span className={`inline-flex items-center font-semibold ${
                headOrientation === HEAD_ORIENTATIONS.FORWARD 
                  ? 'text-emerald-400' 
                  : headOrientation === HEAD_ORIENTATIONS.UNKNOWN 
                    ? 'text-slate-400' 
                    : 'text-amber-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  headOrientation === HEAD_ORIENTATIONS.FORWARD 
                    ? 'bg-emerald-400 animate-pulse' 
                    : headOrientation === HEAD_ORIENTATIONS.UNKNOWN 
                      ? 'bg-slate-500' 
                      : 'bg-amber-400'
                }`} />
                {getHeadOrientationText()}
              </span>
            )}
          </div>

          {/* 5. Phone Detection Status Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">Phone</span>
              <span title="Object detection filter for handheld smartphone presence" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            {!isCameraActive ? (
              <span className="font-medium text-slate-500">Camera Off</span>
            ) : isPhoneDetected ? (
              <div className="flex items-center space-x-1.5">
                <span className="inline-flex items-center text-amber-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                Not detected
              </span>
            )}
          </div>

          {/* 6. Person Count Status Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/70 hover:border-slate-700/80 transition-all text-xs">
            <div className="flex items-center space-x-2.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-200 font-medium">People</span>
              <span title="Identifies whether one person or multiple individuals are in frame" className="text-slate-600 hover:text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </div>
            {!isCameraActive ? (
              <span className="font-medium text-slate-500">Camera Off</span>
            ) : (
              <span className={`inline-flex items-center font-semibold ${
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
      </div>

      {/* AI Privacy Footer Panel */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-sm mt-1">
        <div className="flex items-start space-x-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight space-y-0.5">
            <p className="text-slate-300 font-medium">All analysis is processed locally in your browser.</p>
            <p className="text-[10px] text-slate-500">No data is uploaded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


