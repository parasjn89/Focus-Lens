import React, { useState } from 'react';
import { Cpu, ShieldCheck, Sparkles, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
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

  const [showDebug, setShowDebug] = useState(false);
  const [testLog, setTestLog] = useState(null);

  const isFaceDetected = faceState === FACE_STATES.FACE_PRESENT;
  const isPhoneDetected = phoneState === PHONE_STATES.PHONE_PRESENT;

  const renderStatusBadge = (status, errorMsg) => {
    if (status === 'READY') {
      return <span className="text-emerald-400 font-bold">READY</span>;
    }
    if (status === 'LOADING') {
      return <span className="text-amber-400 font-bold animate-pulse">LOADING</span>;
    }
    if (status === 'ERROR' || errorMsg) {
      return <span className="text-rose-400 font-bold">ERROR</span>;
    }
    return <span className="text-slate-500 font-medium">IDLE</span>;
  };

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

      {/* Developer Debug Toggle Section */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          className="w-full flex items-center justify-between py-1 text-[11px] text-slate-500 hover:text-slate-300 font-mono transition-colors"
        >
          <span className="flex items-center space-x-1">
            <Terminal className="w-3 h-3 text-brand-400" />
            <span>Vision Diagnostics</span>
          </span>
          {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showDebug && (
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1.5 my-1 max-h-72 overflow-y-auto">
            <div className="text-brand-400 font-bold text-[11px] pb-1 border-b border-slate-800 flex justify-between">
              <span>VISION DIAGNOSTICS</span>
              <span>{isCameraActive && isVideoReady ? 'RUNNING' : isCameraActive ? 'WAITING FOR VIDEO' : 'STOPPED'}</span>
            </div>

            <div className="flex justify-between">
              <span>Camera stream:</span>
              <span className={isCameraActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isCameraActive ? 'OK' : 'DISABLED'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Video ready:</span>
              <span className={isVideoReady ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {isVideoReady ? 'YES' : 'NO'} (State: {videoStats.readyState || faceDebugStats.readyState || 0})
              </span>
            </div>

            <div className="flex justify-between">
              <span>Video dimensions:</span>
              <span className="text-slate-200">
                {(videoStats.videoWidth || faceDebugStats.videoWidth || 0)} × {(videoStats.videoHeight || faceDebugStats.videoHeight || 0)}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Video paused:</span>
              <span className={videoStats.paused ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {videoStats.paused ? 'YES' : 'NO'}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-900">
              <span>Face model:</span>
              {renderStatusBadge(faceModelStatus, faceModelError)}
            </div>

            <div className="flex justify-between">
              <span>Face inference:</span>
              <span className={`font-bold ${faceInferenceStatus === 'RUNNING' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
                {faceInferenceStatus}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-900">
              <span>Object model:</span>
              {renderStatusBadge(objectModelStatus, objectModelError)}
            </div>

            <div className="flex justify-between">
              <span>Object inference:</span>
              <span className={`font-bold ${objectInferenceStatus === 'RUNNING' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
                {objectInferenceStatus}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-900">
              <span>Head landmarker:</span>
              {renderStatusBadge(headModelStatus, headModelError)}
            </div>

            <div className="flex justify-between">
              <span>Head inference:</span>
              <span className={`font-bold ${headInferenceStatus === 'RUNNING' ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
                {headInferenceStatus}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-900">
              <span>Face inference (Attempts/OK):</span>
              <span className="text-cyan-300">
                {faceDebugStats.attempts || 0} attempts / {faceDebugStats.successes || 0} OK
              </span>
            </div>

            <div className="flex justify-between">
              <span>Object inference (Attempts/OK):</span>
              <span className="text-indigo-300">
                {objectDebugStats.attempts || 0} attempts / {objectDebugStats.successes || 0} OK
              </span>
            </div>

            <div className="flex justify-between">
              <span>Face result (raw):</span>
              <span className="font-bold text-emerald-400">{faceDebugStats.rawFaces ?? 0} face(s)</span>
            </div>

            <div className="flex justify-between">
              <span>People (Physical Real):</span>
              <span className="font-bold text-emerald-400">{objectDebugStats.realPeople ?? 0} person(s)</span>
            </div>

            <div className="flex justify-between">
              <span>People (On Phone Screen):</span>
              <span className="font-bold text-amber-300">{objectDebugStats.onPhonePeople ?? 0} person(s)</span>
            </div>

            <div className="flex justify-between">
              <span>People (Raw Detections):</span>
              <span className="text-slate-400">{objectDebugStats.rawPeople ?? 0} total</span>
            </div>

            <div className="flex justify-between">
              <span>Phone result (raw):</span>
              <span className="font-bold text-amber-400">{objectDebugStats.rawPhones ?? 0} phone(s)</span>
            </div>

            <div className="flex justify-between">
              <span>Landmarks (raw):</span>
              <span className="text-purple-300">{headDebugStats.landmarkCount ?? 0} points</span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-900">
              <span>Screen classifier:</span>
              <span className="text-cyan-300 font-bold">
                {isScreenActive ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Screen frames (Attempts/OK):</span>
              <span className="text-cyan-300">
                {screenDebugStats.attempts || 0} attempts / {screenDebugStats.successes || 0} OK
              </span>
            </div>

            <div className="flex justify-between">
              <span>Screen dimensions & ready:</span>
              <span className="text-slate-200">
                {(screenDebugStats.videoWidth || 0)} × {(screenDebugStats.videoHeight || 0)} (Ready: {screenDebugStats.readyState || 0})
              </span>
            </div>

            {(faceModelError || objectModelError || headModelError || faceDebugStats.lastError || objectDebugStats.lastError) && (
              <div className="text-rose-400 text-[9px] p-1.5 rounded bg-rose-950/40 border border-rose-900/60 break-words my-1">
                <strong>Error:</strong> {faceModelError || objectModelError || headModelError || faceDebugStats.lastError || objectDebugStats.lastError}
              </div>
            )}

            {testLog && (
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-cyan-300 break-words my-1">
                {testLog}
              </div>
            )}

            {/* Standalone Diagnostic Test Buttons */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Isolated Model Tests</div>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (onTestFaceInit) {
                      setTestLog('Testing Face Model Init...');
                      const res = await onTestFaceInit();
                      setTestLog(res?.success ? `Face Model READY (${res.elapsedMs}ms, ${res.delegate})` : `Face Model ERROR: ${res?.error}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-[9px] font-bold transition-all border border-indigo-700/50"
                >
                  Init Face Model
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (onRunFaceTest) {
                      setTestLog('Running Face Detection Test...');
                      const res = await onRunFaceTest();
                      setTestLog(res?.error ? `Face Test Error: ${res.error}` : `Face Detections: ${res?.detectionsCount ?? 0}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[9px] font-bold transition-all border border-emerald-700/50"
                >
                  Pass Face Test
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (onTestObjectInit) {
                      setTestLog('Testing Object Model Init...');
                      const res = await onTestObjectInit();
                      setTestLog(res?.success ? `Object Model READY (${res.elapsedMs}ms, ${res.delegate})` : `Object Model ERROR: ${res?.error}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 text-[9px] font-bold transition-all border border-cyan-700/50"
                >
                  Init Object Model
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (onRunObjectTest) {
                      setTestLog('Running Object Detection Test...');
                      const res = await onRunObjectTest();
                      setTestLog(res?.success ? `People: ${res.peopleCount}, Phones: ${res.phoneCount}` : `Object Test Error: ${res?.error}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 text-[9px] font-bold transition-all border border-cyan-700/50"
                >
                  Pass Object Test
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (onTestLandmarkerInit) {
                      setTestLog('Testing Landmarker Init...');
                      const res = await onTestLandmarkerInit();
                      setTestLog(res?.success ? `Landmarker READY (${res.elapsedMs}ms, ${res.delegate})` : `Landmarker ERROR: ${res?.error}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[9px] font-bold transition-all border border-purple-700/50"
                >
                  Init Landmarker
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (onRunLandmarkerTest) {
                      setTestLog('Running Landmarker Test...');
                      const res = await onRunLandmarkerTest();
                      setTestLog(res?.success ? `Landmarks: ${res.landmarkCount} pts` : `Landmarker Error: ${res?.error}`);
                    }
                  }}
                  className="py-1 px-2 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[9px] font-bold transition-all border border-purple-700/50"
                >
                  Pass Landmark Test
                </button>
              </div>
            </div>
          </div>
        )}
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

