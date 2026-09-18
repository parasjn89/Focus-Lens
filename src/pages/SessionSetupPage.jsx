import React, { useState, useRef } from 'react';
import {
  BookOpen, Code2, BookMarked, Video, Edit3, Clock, Play, ShieldAlert,
  Camera, Monitor, Check, X, AlertCircle, Loader2, ArrowRight, CornerDownRight
} from 'lucide-react';

// Authoritative Terminal State Check Helpers
export const isTerminalCamera = (status) => ['ALLOWED', 'DENIED', 'UNAVAILABLE', 'ERROR'].includes(status);
export const isTerminalScreen = (status) => ['SHARED', 'DENIED', 'CANCELLED', 'UNAVAILABLE', 'ERROR'].includes(status);

export const isPermissionsComplete = (statuses) =>
  isTerminalCamera(statuses?.camera) &&
  isTerminalScreen(statuses?.screen);

export function SessionSetupPage({ onStartSession, onCancel, initialConfig }) {
  const [selectedActivity, setSelectedActivity] = useState(initialConfig?.activity || 'Studying');
  const [customActivity, setCustomActivity] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(initialConfig?.durationMinutes || 25);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustomDurationSelected, setIsCustomDurationSelected] = useState(false);

  // Goal configuration state
  const [goalText, setGoalText] = useState(initialConfig?.goalText || '');
  const [goalType, setGoalType] = useState(initialConfig?.goalType || 'NONE'); // 'NONE' | 'TIME' | 'COUNT'
  const [targetValue, setTargetValue] = useState(initialConfig?.targetValue != null ? String(initialConfig.targetValue) : '');
  const [targetUnit, setTargetUnit] = useState(initialConfig?.targetUnit || '');
  const [goalError, setGoalError] = useState(null);

  // Session intention state (Focus Journal)
  const [intention, setIntention] = useState(initialConfig?.intention || '');

  // Pre-session permission setup state machine
  // States: 'IDLE' | 'REQUESTING_CAMERA' | 'CAMERA_RESOLVED' | 'WAITING_FOR_SCREEN_USER_ACTION' | 'REQUESTING_SCREEN' | 'SCREEN_RESOLVED' | 'PERMISSIONS_COMPLETE'
  const [isPreparing, setIsPreparing] = useState(false);
  const [setupState, setSetupState] = useState('IDLE');

  const [permissionStatuses, setPermissionStatuses] = useState({
    camera: 'IDLE',     // 'IDLE' | 'REQUESTING' | 'ALLOWED' | 'DENIED' | 'UNAVAILABLE' | 'ERROR'
    screen: 'IDLE',     // 'IDLE' | 'REQUESTING' | 'SHARED' | 'DENIED' | 'CANCELLED' | 'UNAVAILABLE' | 'ERROR'
  });

  const streamsRef = useRef({
    cameraStream: null,
    screenStream: null,
  });

  const activities = [
    { id: 'Studying', label: 'Studying', icon: BookOpen, desc: 'General study & review' },
    { id: 'Coding', label: 'Coding', icon: Code2, desc: 'Software dev & problem solving' },
    { id: 'Reading', label: 'Reading', icon: BookMarked, desc: 'Books, papers & documentation' },
    { id: 'Watching Lecture', label: 'Watching Lecture', icon: Video, desc: 'Online classes & tutorials' },
    { id: 'Custom', label: 'Custom', icon: Edit3, desc: 'Specify custom target activity' },
  ];

  const durationPresets = [25, 50, 90, 120];

  const stopAcquiredStreams = () => {
    if (streamsRef.current.cameraStream) {
      streamsRef.current.cameraStream.getTracks().forEach(t => t.stop());
      streamsRef.current.cameraStream = null;
    }
    if (streamsRef.current.screenStream) {
      streamsRef.current.screenStream.getTracks().forEach(t => t.stop());
      streamsRef.current.screenStream = null;
    }
  };

  const handleCancelSetup = () => {
    stopAcquiredStreams();
    setIsPreparing(false);
    setSetupState('IDLE');
    setPermissionStatuses({ camera: 'IDLE', screen: 'IDLE' });
  };

  // STEP 1 & 2: CAMERA ACQUISITION
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isPreparing) return; // Prevent double clicks

    setGoalError(null);
    if (goalType !== 'NONE') {
      const trimmedGoal = goalText.trim();
      if (!trimmedGoal) {
        setGoalError('Goal text is required when setting a goal target.');
        return;
      }
      if (trimmedGoal.length > 120) {
        setGoalError('Goal text cannot exceed 120 characters.');
        return;
      }

      if (goalType === 'TIME') {
        const val = parseFloat(targetValue);
        if (isNaN(val) || val < 1 || val > 600) {
          setGoalError('Target focus time must be between 1 and 600 minutes.');
          return;
        }
      } else if (goalType === 'COUNT') {
        const val = parseInt(targetValue, 10);
        if (isNaN(val) || val < 1 || val > 1000) {
          setGoalError('Target count must be a whole integer between 1 and 1000.');
          return;
        }
      }
    }

    setIsPreparing(true);
    setSetupState('REQUESTING_CAMERA');
    setPermissionStatuses({ camera: 'REQUESTING', screen: 'IDLE' });

    let camStatus = 'UNAVAILABLE';
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const cStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        streamsRef.current.cameraStream = cStream;
        camStatus = 'ALLOWED';
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          camStatus = 'DENIED';
        } else {
          camStatus = 'UNAVAILABLE';
        }
      }
    }

    // Update statuses for Camera (now terminal)
    const nextStatuses = {
      camera: camStatus,
      screen: 'IDLE',
    };
    setPermissionStatuses(nextStatuses);

    // Transition state machine
    setSetupState('WAITING_FOR_SCREEN_USER_ACTION');
  };

  // STEP 3: SCREEN SHARING ACQUISITION (REQUIRES DIRECT USER GESTURE)
  const handleRequestScreenShare = async () => {
    setSetupState('REQUESTING_SCREEN');
    setPermissionStatuses(prev => ({ ...prev, screen: 'REQUESTING' }));

    let scStatus = 'CANCELLED';
    if (navigator?.mediaDevices?.getDisplayMedia) {
      try {
        const scStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        streamsRef.current.screenStream = scStream;
        scStatus = 'SHARED';
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'AbortError') {
          scStatus = 'CANCELLED';
        } else {
          scStatus = 'UNAVAILABLE';
        }
      }
    } else {
      scStatus = 'UNAVAILABLE';
    }

    const updatedStatuses = { ...permissionStatuses, screen: scStatus };
    setPermissionStatuses(updatedStatuses);

    if (isPermissionsComplete(updatedStatuses)) {
      setSetupState('SCREEN_RESOLVED');
    }
  };

  // STEP 3 OPTION B: SKIP / CANCEL SCREEN SHARING
  const handleSkipScreenShare = () => {
    const updatedStatuses = { ...permissionStatuses, screen: 'CANCELLED' };
    setPermissionStatuses(updatedStatuses);
    if (isPermissionsComplete(updatedStatuses)) {
      setSetupState('SCREEN_RESOLVED');
    }
  };

  // SINGLE AUTHORITATIVE SESSION ACTIVATION FUNCTION
  const launchActiveSession = () => {
    if (!isPermissionsComplete(permissionStatuses)) {
      console.warn('[SessionSetup] Cannot start session: permissions not complete', permissionStatuses);
      return;
    }

    const finalActivity = selectedActivity === 'Custom'
      ? (customActivity.trim() || 'Custom Activity')
      : selectedActivity;

    const finalDuration = isCustomDurationSelected
      ? (parseInt(customDuration, 10) || 25)
      : durationMinutes;

    const validatedDuration = Math.max(1, finalDuration);

    const trimmedGoalText = goalText.trim();
    let finalTargetValue = null;
    let finalTargetUnit = null;

    if (goalType === 'TIME') {
      finalTargetValue = parseFloat(targetValue) || null;
      finalTargetUnit = 'minutes';
    } else if (goalType === 'COUNT') {
      finalTargetValue = parseInt(targetValue, 10) || null;
      finalTargetUnit = targetUnit.trim() || null;
    }

    setSetupState('PERMISSIONS_COMPLETE');

    onStartSession({
      activity: finalActivity,
      durationMinutes: validatedDuration,
      goalText: goalType !== 'NONE' ? trimmedGoalText : null,
      goalType,
      targetValue: finalTargetValue,
      targetUnit: finalTargetUnit,
      intention: intention.trim() || null,
      initialStreams: {
        cameraStream: streamsRef.current.cameraStream,
        screenStream: streamsRef.current.screenStream,
      }
    });
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTING':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center space-x-1.5 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Prompting...</span>
          </span>
        );
      case 'ALLOWED':
      case 'SHARED':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 font-medium">
            <Check className="w-3 h-3" />
            <span>{status === 'SHARED' ? 'Shared' : 'Allowed'}</span>
          </span>
        );
      case 'DENIED':
      case 'CANCELLED':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1 font-medium">
            <X className="w-3 h-3" />
            <span>{status === 'CANCELLED' ? 'Not Shared' : 'Denied'}</span>
          </span>
        );
      case 'UNAVAILABLE':
      case 'ERROR':
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1 font-medium">
            <AlertCircle className="w-3 h-3" />
            <span>Unavailable</span>
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-500 font-medium">Waiting...</span>
        );
    }
  };

  const canLaunchFinalSession = isPermissionsComplete(permissionStatuses);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Top Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Configure Focus Session</h1>
        <p className="text-slate-400 text-sm">Select your primary activity and target duration to initialize tracking.</p>
      </div>

      {isPreparing ? (
        <div className="glass-panel p-8 rounded-3xl border border-brand-500/30 bg-slate-950/90 text-center max-w-xl mx-auto space-y-6 shadow-2xl">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20 mb-1">
              <Loader2 className={`w-6 h-6 text-brand-400 ${canLaunchFinalSession ? '' : 'animate-spin'}`} />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Preparing Focus Session</h2>
            <p className="text-xs text-slate-400 max-w-md">
              Both monitoring permissions must reach a resolved terminal state before the session timer starts.
            </p>
          </div>

          <div className="space-y-3 text-left border-t border-b border-slate-800/80 py-5 my-4">
            {/* 1. Camera */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-slate-200">1. Camera Access</span>
                  <p className="text-[11px] text-slate-400">Presence & distraction detection</p>
                </div>
              </div>
              <div>{renderStatusBadge(permissionStatuses.camera)}</div>
            </div>

            {/* 2. Screen Sharing */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-slate-200">2. Screen Sharing</span>
                  <p className="text-[11px] text-slate-400">Context classification (Requires click gesture)</p>
                </div>
              </div>
              <div>{renderStatusBadge(permissionStatuses.screen)}</div>
            </div>
          </div>

          {/* Interactive Screen Sharing Step (Browser User-Activation Compliant) */}
          {permissionStatuses.screen === 'IDLE' && isTerminalCamera(permissionStatuses.camera) && (
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-left space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-brand-300">
                <CornerDownRight className="w-4 h-4 text-brand-400" />
                <span>Screen Sharing Action Required</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Browsers require an explicit user action to trigger screen sharing. Click below to share your screen window or skip.
              </p>
              <div className="flex items-center space-x-3 pt-1">
                <button
                  type="button"
                  onClick={handleRequestScreenShare}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md flex items-center justify-center space-x-1.5 transition-all"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Continue to Screen Sharing</span>
                </button>
                <button
                  type="button"
                  onClick={handleSkipScreenShare}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Skip Screen
                </button>
              </div>
            </div>
          )}

          {/* Final Launch Button once permissionsComplete === true */}
          {canLaunchFinalSession && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-left space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>All Permission Stages Resolved!</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Camera ({permissionStatuses.camera}) and Screen ({permissionStatuses.screen}) permission setup is complete. Click to begin your focus countdown.
              </p>
              <button
                type="button"
                onClick={launchActiveSession}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Focus Session Now ({isCustomDurationSelected ? customDuration || 25 : durationMinutes}:00)</span>
              </button>
            </div>
          )}

          {/* Debug Diagnostics Block */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 text-left space-y-1 font-mono text-[11px] text-slate-400">
            <div className="font-bold text-brand-400 flex items-center justify-between">
              <span>SETUP DIAGNOSTICS</span>
              <span className="text-[10px] text-slate-500">State: {setupState}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
              <div>Camera status: <span className="text-slate-200">{permissionStatuses.camera}</span></div>
              <div>Screen status: <span className="text-slate-200">{permissionStatuses.screen}</span></div>
              <div>permissionsComplete: <span className={canLaunchFinalSession ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{canLaunchFinalSession ? 'TRUE' : 'FALSE'}</span></div>
              <div>sessionStartAllowed: <span className={canLaunchFinalSession ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{canLaunchFinalSession ? 'TRUE' : 'FALSE'}</span></div>
              <div>timerStarted: <span className="text-slate-400">FALSE (Timer Paused)</span></div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleCancelSetup}
              className="px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Cancel Setup
            </button>
            <span className="text-xs font-semibold text-brand-400">
              {canLaunchFinalSession ? 'Ready to Start' : 'Resolving Setup Stages...'}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-8">
        {/* Activity Selection Section */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <label className="block text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
            <span>1. Select Target Activity</span>
            <span className="text-xs text-brand-400 font-normal">Required</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activities.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedActivity === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedActivity(item.id)}
                  className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-brand-600/20 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Custom Activity Text Input */}
          {selectedActivity === 'Custom' && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Custom Activity Name</label>
              <input
                type="text"
                placeholder="e.g., Writing Research Paper"
                value={customActivity}
                onChange={(e) => setCustomActivity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
                required
              />
            </div>
          )}
        </div>

        {/* Duration Selection Section */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <label className="block text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>2. Select Session Duration</span>
            </span>
          </label>

          {/* Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {durationPresets.map((preset) => {
              const isSelected = !isCustomDurationSelected && durationMinutes === preset;
              return (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setIsCustomDurationSelected(false);
                    setDurationMinutes(preset);
                  }}
                  className={`py-3 px-4 rounded-xl font-medium text-sm border transition-all text-center ${
                    isSelected
                      ? 'bg-brand-600 border-brand-500 text-white shadow-md shadow-brand-600/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {preset} mins
                </button>
              );
            })}
          </div>

          {/* Custom Duration Toggle & Input */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setIsCustomDurationSelected(!isCustomDurationSelected)}
              className="text-xs text-brand-400 hover:underline font-medium mb-2 inline-block"
            >
              {isCustomDurationSelected ? '← Choose from standard presets' : '+ Enter custom duration'}
            </button>

            {isCustomDurationSelected && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Duration in Minutes</label>
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="e.g. 45"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="w-full sm:w-48 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Goal Configuration Section */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <label className="block text-sm font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <BookMarked className="w-4 h-4 text-emerald-400" />
              <span>3. Goal Configuration (Optional)</span>
            </span>
            <span className="text-xs text-slate-400 font-normal">Set focus session target</span>
          </label>

          {/* Target Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setGoalType('NONE');
                setGoalError(null);
              }}
              className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                goalType === 'NONE'
                  ? 'bg-brand-600/20 border-brand-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold mb-0.5">No Specific Target</div>
              <div className="text-[10px] text-slate-500">Generic timer session</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setGoalType('TIME');
                setGoalError(null);
                if (!targetValue) setTargetValue(durationMinutes.toString());
              }}
              className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                goalType === 'TIME'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold mb-0.5">Time Target</div>
              <div className="text-[10px] text-slate-500">e.g. Study for 45 minutes</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setGoalType('COUNT');
                setGoalError(null);
                if (!targetValue) setTargetValue('3');
              }}
              className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                goalType === 'COUNT'
                  ? 'bg-brand-600/20 border-brand-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold mb-0.5">Count Target</div>
              <div className="text-[10px] text-slate-500">e.g. Solve 5 questions</div>
            </button>
          </div>

          {/* Goal Inputs */}
          {goalType !== 'NONE' && (
            <div className="space-y-4 pt-2 border-t border-slate-800/80 animate-fadeIn">
              <div>
                <label htmlFor="goalTextInput" className="block text-xs font-medium text-slate-300 mb-1">
                  Session Goal Description <span className="text-rose-400">*</span>
                </label>
                <input
                  id="goalTextInput"
                  type="text"
                  maxLength={120}
                  placeholder={goalType === 'TIME' ? 'e.g., Study React Hooks & Context' : 'e.g., Complete DSA binary search questions'}
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
                  required
                />
                <span className="text-[10px] text-slate-500 block text-right mt-1 font-mono">
                  {goalText.length}/120 characters
                </span>
              </div>

              {goalType === 'TIME' && (
                <div>
                  <label htmlFor="targetFocusTimeInput" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Focus Time (Minutes) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="targetFocusTimeInput"
                    type="number"
                    min="1"
                    max="600"
                    placeholder="e.g. 45"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full sm:w-48 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Goal completes automatically when qualifying focus time reaches target.
                  </p>
                </div>
              )}

              {goalType === 'COUNT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="targetCountInput" className="block text-xs font-medium text-slate-300 mb-1">
                      Target Count <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="targetCountInput"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      placeholder="e.g. 5"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="targetUnitInput" className="block text-xs font-medium text-slate-300 mb-1">
                      Target Label / Unit (Optional)
                    </label>
                    <input
                      id="targetUnitInput"
                      type="text"
                      maxLength={40}
                      placeholder="e.g., questions, chapters, pages"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {goalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{goalError}</span>
            </div>
          )}
        </div>

        {/* Session Intention Section (Focus Journal) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
          <label htmlFor="sessionIntentionInput" className="block text-sm font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Edit3 className="w-4 h-4 text-brand-400" />
              <span>4. Session Intention (Optional)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">{intention.length} / 300</span>
          </label>

          <textarea
            id="sessionIntentionInput"
            value={intention}
            onChange={(e) => setIntention(e.target.value.slice(0, 300))}
            placeholder="What do you want to accomplish in this session?"
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs resize-none transition-all"
          />
          <p className="text-[11px] text-slate-400">
            Free-form context for your Focus Journal. Adding an intention does not alter session metrics or timer startup.
          </p>
        </div>

        {/* Privacy Note Banner */}
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
          <ShieldAlert className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p>
            During this session, observability placeholders will display status updates. All video signals strictly remain on your device.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPreparing}
            className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all hover:scale-105 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Launch Session</span>
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
