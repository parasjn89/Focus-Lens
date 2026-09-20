import React, { useState, useRef } from 'react';
import {
  BookOpen, Code2, BookMarked, Video, Edit3, Clock, Play, ShieldAlert,
  Camera, Monitor, Check, X, AlertCircle, Loader2, ArrowRight, CornerDownRight,
  Sparkles, Compass, Lightbulb, CheckCircle2, ShieldCheck, Target, ChevronRight
} from 'lucide-react';
import { getUserSettings } from '../utils/userSettings';

// Authoritative Terminal State Check Helpers
export const isTerminalCamera = (status) => ['ALLOWED', 'DENIED', 'UNAVAILABLE', 'ERROR'].includes(status);
export const isTerminalScreen = (status) => ['SHARED', 'DENIED', 'CANCELLED', 'UNAVAILABLE', 'ERROR'].includes(status);

export const isPermissionsComplete = (statuses) =>
  isTerminalCamera(statuses?.camera) &&
  isTerminalScreen(statuses?.screen);

export function SessionSetupPage({ onStartSession, onCancel, initialConfig }) {
  const userSettings = getUserSettings();
  const [selectedActivity, setSelectedActivity] = useState(initialConfig?.activity || 'Studying');
  const [customActivity, setCustomActivity] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(
    initialConfig?.durationMinutes || userSettings?.defaultDuration || 25
  );
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
    { id: 'Custom', label: 'Custom', icon: Edit3, desc: 'Specify your own activity' },
  ];

  const durationPresets = [15, 25, 45, 60, 90];

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
          <span className="text-xs px-3 py-1 rounded-full bg-[#168CFF]/20 text-[#00B8E6] border border-[#168CFF]/30 flex items-center space-x-1.5 font-medium">
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
          <span className="text-xs px-3 py-1 rounded-full bg-[#142A32] text-[#718894] border border-[rgba(120,170,190,0.16)] flex items-center space-x-1 font-medium">
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
          <span className="text-xs text-[#718894] font-medium">Waiting...</span>
        );
    }
  };

  const canLaunchFinalSession = isPermissionsComplete(permissionStatuses);

  // Derived live preview data
  const activeDurationMinutes = isCustomDurationSelected
    ? (parseInt(customDuration, 10) || 25)
    : (durationMinutes || 25);

  const finalActivityName = selectedActivity === 'Custom'
    ? (customActivity.trim() || 'Custom Activity')
    : selectedActivity;

  const currentActivityObj = activities.find(a => a.id === selectedActivity) || activities[0];

  const formatPreviewTime = (minutes) => {
    const m = Math.max(1, minutes);
    return `${m}:00`;
  };

  let previewGoalText = 'No target';
  let previewGoalTitle = 'No specific target set';
  if (goalType === 'TIME') {
    previewGoalText = `${targetValue || activeDurationMinutes} mins focus`;
    previewGoalTitle = goalText.trim() ? `${goalText.trim()} (${previewGoalText})` : previewGoalText;
  } else if (goalType === 'COUNT') {
    previewGoalText = `${targetValue || '1'} ${targetUnit.trim() || 'targets'}`;
    previewGoalTitle = goalText.trim() ? `${goalText.trim()} (${previewGoalText})` : previewGoalText;
  }

  // Active step for progress indicator
  let currentStep = 1;
  if (intention.trim().length > 0) {
    currentStep = 4;
  } else if (goalType !== 'NONE' || goalText.trim().length > 0) {
    currentStep = 3;
  } else if (durationMinutes || isCustomDurationSelected) {
    currentStep = 2;
  }

  return (
    <div className="min-h-full bg-[#10232A] text-[#F2F6F8] selection:bg-[#168CFF] selection:text-white px-4 sm:px-6 lg:px-8 py-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ============================================================ */}
        {/* 3. PAGE HEADER (Concept #6 Dashboard Header) */}
        {/* ============================================================ */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-[#142A32] border border-[rgba(120,170,190,0.16)] shadow-2xl overflow-hidden">
          {/* Abstract Mountain / Wave Horizon Decorative Silhouette */}
          <div className="absolute top-0 right-0 w-80 sm:w-96 h-full pointer-events-none overflow-hidden opacity-25 select-none">
            <svg viewBox="0 0 400 150" fill="none" className="w-full h-full text-[#00B8E6]">
              <path d="M0 150 L80 90 L160 120 L240 50 L320 90 L400 30 L400 150 Z" fill="currentColor" fillOpacity="0.08" />
              <path d="M40 150 L120 80 L200 110 L280 40 L360 80 L400 60 L400 150 Z" fill="currentColor" fillOpacity="0.14" />
              <path d="M0 150 L100 100 L180 130 L260 70 L340 100 L400 70" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-[#168CFF]/15 border border-[#168CFF]/30 text-[#00B8E6] text-[11px] font-bold tracking-widest uppercase mb-2">
                <Sparkles className="w-3 h-3 text-[#168CFF]" />
                <span>Session Setup</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#F2F6F8] tracking-tight">
                Let's Get Focused
              </h1>
              <p className="text-sm text-[#9BAFBC] mt-1">
                Configure your session and build momentum.
              </p>
            </div>

            {/* Subtle Right Quote */}
            <div className="flex items-center space-x-2 text-right self-start md:self-center">
              <div className="px-3.5 py-1.5 rounded-xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] text-xs text-[#9BAFBC] font-medium tracking-wide shadow-sm">
                <span className="text-[#00B8E6] font-semibold">“</span>
                The Only Easy Day Was Yesterday
                <span className="text-[#00B8E6] font-semibold">”</span>
              </div>
            </div>
          </div>

          {/* Compact Progress Indicator: [1 Activity] → [2 Duration] → [3 Goal] → [4 Intention] */}
          <div className="relative z-10 mt-6 pt-5 border-t border-[rgba(120,170,190,0.12)]">
            <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto no-scrollbar py-1 text-xs font-semibold">
              {[
                { step: 1, label: 'Activity' },
                { step: 2, label: 'Duration' },
                { step: 3, label: 'Goal' },
                { step: 4, label: 'Intention' },
              ].map((item, idx, arr) => {
                const isCurrent = currentStep === item.step;
                const isPast = currentStep > item.step;
                return (
                  <React.Fragment key={item.step}>
                    <div
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
                        isCurrent
                          ? 'bg-[#168CFF]/20 border-[#168CFF] text-[#F2F6F8] shadow-md shadow-[#168CFF]/20 font-bold'
                          : isPast
                            ? 'bg-[#18313A] border-[#00B8E6]/40 text-[#00B8E6]'
                            : 'bg-[#18313A]/60 border-[rgba(120,170,190,0.12)] text-[#718894]'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                        isCurrent
                          ? 'bg-[#168CFF] text-white shadow-sm'
                          : isPast
                            ? 'bg-[#00B8E6]/20 text-[#00B8E6]'
                            : 'bg-[#142A32] text-[#718894]'
                      }`}>
                        {isPast ? <Check className="w-3 h-3 stroke-[2.5]" /> : item.step}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <span className="text-[#718894]/60 text-xs px-1 select-none">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PRE-SESSION PERMISSIONS MODAL / VIEW (When Preparing) */}
        {/* ============================================================ */}
        {isPreparing ? (
          <div className="p-6 sm:p-8 rounded-3xl border border-[#168CFF]/40 bg-[#18313A] text-center max-w-xl mx-auto space-y-6 shadow-2xl shadow-black/60">
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#168CFF]/15 text-[#168CFF] flex items-center justify-center border border-[#168CFF]/30 mb-1 shadow-inner">
                <Loader2 className={`w-7 h-7 text-[#00B8E6] ${canLaunchFinalSession ? '' : 'animate-spin'}`} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#F2F6F8] tracking-tight">Preparing Focus Session</h2>
              <p className="text-xs text-[#9BAFBC] max-w-md">
                Both monitoring permissions must reach a resolved terminal state before the session timer starts.
              </p>
            </div>

            <div className="space-y-3 text-left border-t border-b border-[rgba(120,170,190,0.16)] py-5 my-4">
              {/* 1. Camera Access */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#142A32] border border-[rgba(120,170,190,0.16)]">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-[#18313A] text-[#00B8E6] border border-[rgba(120,170,190,0.12)]">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-[#F2F6F8]">1. Camera Access</span>
                    <p className="text-[11px] text-[#9BAFBC]">Presence & posture observation</p>
                  </div>
                </div>
                <div>{renderStatusBadge(permissionStatuses.camera)}</div>
              </div>

              {/* 2. Screen Sharing */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#142A32] border border-[rgba(120,170,190,0.16)]">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-[#18313A] text-[#00B8E6] border border-[rgba(120,170,190,0.12)]">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-[#F2F6F8]">2. Screen Sharing</span>
                    <p className="text-[11px] text-[#9BAFBC]">Workspace context classification (Requires click gesture)</p>
                  </div>
                </div>
                <div>{renderStatusBadge(permissionStatuses.screen)}</div>
              </div>
            </div>

            {/* Interactive Screen Sharing Step (Browser User-Activation Compliant) */}
            {permissionStatuses.screen === 'IDLE' && isTerminalCamera(permissionStatuses.camera) && (
              <div className="p-4 rounded-2xl bg-[#168CFF]/10 border border-[#168CFF]/30 text-left space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#00B8E6]">
                  <CornerDownRight className="w-4 h-4 text-[#168CFF]" />
                  <span>Screen Sharing Action Required</span>
                </div>
                <p className="text-xs text-[#9BAFBC] leading-relaxed">
                  Browsers require an explicit user click gesture to prompt screen sharing. Click below to share your screen or skip.
                </p>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleRequestScreenShare}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#168CFF] to-[#00B8E6] hover:from-[#1b93ff] hover:to-[#17c2ee] text-white font-semibold text-xs shadow-md shadow-[#168CFF]/30 flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Continue to Screen Sharing</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipScreenShare}
                    className="py-2.5 px-4 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.2)] hover:bg-[#203A43] text-[#9BAFBC] hover:text-[#F2F6F8] text-xs font-semibold transition-colors"
                  >
                    Skip Screen
                  </button>
                </div>
              </div>
            )}

            {/* Final Launch Button once permissionsComplete === true */}
            {canLaunchFinalSession && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-left space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>All Permission Stages Resolved!</span>
                </div>
                <p className="text-xs text-[#9BAFBC] leading-relaxed">
                  Camera ({permissionStatuses.camera}) and Screen ({permissionStatuses.screen}) status confirmed. Click below to begin your focus countdown.
                </p>
                <button
                  type="button"
                  onClick={launchActiveSession}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Focus Session Now ({activeDurationMinutes}:00)</span>
                </button>
              </div>
            )}

            {/* Diagnostics Block */}
            <div className="p-3.5 rounded-2xl bg-[#142A32] border border-[rgba(120,170,190,0.16)] text-left space-y-1 font-mono text-[11px] text-[#718894]">
              <div className="font-bold text-[#00B8E6] flex items-center justify-between">
                <span>SETUP DIAGNOSTICS</span>
                <span className="text-[10px] text-[#9BAFBC]">State: {setupState}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
                <div>Camera status: <span className="text-[#F2F6F8]">{permissionStatuses.camera}</span></div>
                <div>Screen status: <span className="text-[#F2F6F8]">{permissionStatuses.screen}</span></div>
                <div>permissionsComplete: <span className={canLaunchFinalSession ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{canLaunchFinalSession ? 'TRUE' : 'FALSE'}</span></div>
                <div>sessionStartAllowed: <span className={canLaunchFinalSession ? 'text-emerald-400 font-bold' : 'text-[#718894]'}>{canLaunchFinalSession ? 'TRUE' : 'FALSE'}</span></div>
                <div>timerStarted: <span className="text-[#718894]">FALSE (Timer Paused)</span></div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleCancelSetup}
                className="px-4 py-2 rounded-xl border border-[rgba(120,170,190,0.2)] text-xs text-[#9BAFBC] hover:text-[#F2F6F8] hover:bg-[#142A32] transition-colors"
              >
                Cancel Setup
              </button>
              <span className="text-xs font-semibold text-[#00B8E6]">
                {canLaunchFinalSession ? 'Ready to Start' : 'Resolving Setup Stages...'}
              </span>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* 4. TWO-COLUMN DASHBOARD GRID LAYOUT */
          /* ============================================================ */
          <form onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* -------------------------------------------------------- */}
              {/* LEFT COLUMN: SESSION CONFIGURATION (~68% width) */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-8 space-y-6">

                {/* 1. CHOOSE YOUR FOCUS ACTIVITY */}
                <div className="p-6 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#F2F6F8] tracking-tight flex items-center space-x-2">
                        <span>1. Choose Your Focus Activity</span>
                      </h2>
                      <p className="text-xs text-[#9BAFBC] mt-0.5">
                        Select the activity that best matches your session.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#00B8E6] bg-[#168CFF]/10 border border-[#168CFF]/20 px-2.5 py-0.5 rounded-full">
                      Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {activities.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedActivity === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setSelectedActivity(item.id)}
                          className={`group relative p-4 rounded-2xl text-left border transition-all flex flex-col justify-between h-28 ${
                            isSelected
                              ? 'bg-[#203A43] border-[#168CFF] shadow-lg shadow-[#168CFF]/15 text-[#F2F6F8]'
                              : 'bg-[#142A32] border-[rgba(120,170,190,0.16)] text-[#9BAFBC] hover:border-[rgba(120,170,190,0.3)] hover:bg-[#142A32]/90 hover:text-[#F2F6F8]'
                          }`}
                        >
                          {/* Checkmark in top-right when selected */}
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#168CFF] text-white flex items-center justify-center shadow-sm">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}

                          <div className="flex items-center space-x-3">
                            <div className={`p-2.5 rounded-xl transition-colors ${
                              isSelected
                                ? 'bg-[#168CFF] text-white shadow-md shadow-[#168CFF]/30'
                                : 'bg-[#18313A] text-[#00B8E6] border border-[rgba(120,170,190,0.16)] group-hover:text-white'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-sm tracking-tight">{item.label}</span>
                          </div>

                          <p className="text-[11px] text-[#718894] group-hover:text-[#9BAFBC] line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Activity Text Input */}
                  {selectedActivity === 'Custom' && (
                    <div className="mt-3 pt-3 border-t border-[rgba(120,170,190,0.12)] animate-fadeIn">
                      <label htmlFor="customActivityInput" className="block text-xs font-semibold text-[#F2F6F8] mb-1.5">
                        Specify Custom Activity Name <span className="text-[#00B8E6]">*</span>
                      </label>
                      <input
                        id="customActivityInput"
                        type="text"
                        placeholder="e.g., Writing Research Paper, Designing Figma Mockup"
                        value={customActivity}
                        onChange={(e) => setCustomActivity(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] focus:ring-1 focus:ring-[#168CFF] text-sm"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* 2. SET FOCUS DURATION */}
                <div className="p-6 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#F2F6F8] tracking-tight flex items-center space-x-2">
                        <span>2. Set Focus Duration</span>
                      </h2>
                      <p className="text-xs text-[#9BAFBC] mt-0.5">
                        Choose how long you want to focus.
                      </p>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-[#00B8E6] font-mono font-semibold bg-[#168CFF]/10 px-2.5 py-0.5 rounded-full border border-[#168CFF]/20">
                      <Clock className="w-3.5 h-3.5 text-[#168CFF]" />
                      <span>{activeDurationMinutes} mins</span>
                    </div>
                  </div>

                  {/* Duration Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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
                          className={`py-3 px-3 rounded-2xl font-bold text-sm border transition-all text-center flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-[#168CFF] border-[#168CFF] text-white shadow-lg shadow-[#168CFF]/30 scale-[1.02]'
                              : 'bg-[#142A32] border-[rgba(120,170,190,0.16)] text-[#9BAFBC] hover:border-[rgba(120,170,190,0.3)] hover:text-[#F2F6F8] hover:bg-[#142A32]/90'
                          }`}
                        >
                          <span className="text-base font-mono">{preset}</span>
                          <span className={`text-[10px] font-normal uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-[#718894]'}`}>
                            mins
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Duration Toggle & Expander */}
                  <div className="pt-2 border-t border-[rgba(120,170,190,0.12)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCustomDurationSelected(!isCustomDurationSelected)}
                      className="text-xs text-[#00B8E6] hover:text-[#168CFF] font-semibold flex items-center space-x-1 transition-colors self-start"
                    >
                      <span>{isCustomDurationSelected ? '← Choose from standard presets' : '+ Enter custom duration'}</span>
                    </button>

                    {isCustomDurationSelected && (
                      <div className="flex items-center space-x-2 animate-fadeIn">
                        <label htmlFor="customDurationInput" className="text-xs text-[#9BAFBC] whitespace-nowrap">
                          Minutes:
                        </label>
                        <input
                          id="customDurationInput"
                          type="number"
                          min="1"
                          max="480"
                          placeholder="e.g. 35"
                          value={customDuration}
                          onChange={(e) => setCustomDuration(e.target.value)}
                          className="w-28 px-3 py-1.5 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] text-xs font-mono font-bold text-center"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. GOAL CONFIGURATION (Optional) */}
                <div className="p-6 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#F2F6F8] tracking-tight flex items-center space-x-2">
                        <span>3. Goal Configuration</span>
                        <span className="text-xs text-[#718894] font-normal">(Optional)</span>
                      </h2>
                      <p className="text-xs text-[#9BAFBC] mt-0.5">
                        Set a quantified target to measure session success.
                      </p>
                    </div>
                    <Target className="w-4 h-4 text-[#00B8E6]" />
                  </div>

                  {/* 3 Horizontal Target Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setGoalType('NONE');
                        setGoalError(null);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        goalType === 'NONE'
                          ? 'bg-[#203A43] border-[#168CFF] text-[#F2F6F8] shadow-md shadow-[#168CFF]/15'
                          : 'bg-[#142A32] border-[rgba(120,170,190,0.16)] text-[#9BAFBC] hover:border-[rgba(120,170,190,0.3)] hover:text-[#F2F6F8]'
                      }`}
                    >
                      {goalType === 'NONE' && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#168CFF] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="font-bold text-xs text-[#F2F6F8] mb-1">No Specific Target</div>
                      <div className="text-[11px] text-[#718894] leading-relaxed">Generic focus timer session</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGoalType('TIME');
                        setGoalError(null);
                        if (!targetValue) setTargetValue(activeDurationMinutes.toString());
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        goalType === 'TIME'
                          ? 'bg-[#203A43] border-[#168CFF] text-[#F2F6F8] shadow-md shadow-[#168CFF]/15'
                          : 'bg-[#142A32] border-[rgba(120,170,190,0.16)] text-[#9BAFBC] hover:border-[rgba(120,170,190,0.3)] hover:text-[#F2F6F8]'
                      }`}
                    >
                      {goalType === 'TIME' && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#168CFF] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="font-bold text-xs text-[#F2F6F8] mb-1">Time Target</div>
                      <div className="text-[11px] text-[#718894] leading-relaxed">e.g. Study for 45 minutes</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGoalType('COUNT');
                        setGoalError(null);
                        if (!targetValue) setTargetValue('3');
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        goalType === 'COUNT'
                          ? 'bg-[#203A43] border-[#168CFF] text-[#F2F6F8] shadow-md shadow-[#168CFF]/15'
                          : 'bg-[#142A32] border-[rgba(120,170,190,0.16)] text-[#9BAFBC] hover:border-[rgba(120,170,190,0.3)] hover:text-[#F2F6F8]'
                      }`}
                    >
                      {goalType === 'COUNT' && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#168CFF] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div className="font-bold text-xs text-[#F2F6F8] mb-1">Count Target</div>
                      <div className="text-[11px] text-[#718894] leading-relaxed">e.g. Solve 5 DSA questions</div>
                    </button>
                  </div>

                  {/* Goal Configuration Fields */}
                  {goalType !== 'NONE' && (
                    <div className="space-y-4 pt-3 border-t border-[rgba(120,170,190,0.12)] animate-fadeIn">
                      <div>
                        <label htmlFor="goalTextInput" className="block text-xs font-semibold text-[#F2F6F8] mb-1">
                          Session Goal Description <span className="text-rose-400">*</span>
                        </label>
                        <input
                          id="goalTextInput"
                          type="text"
                          maxLength={120}
                          placeholder={goalType === 'TIME' ? 'e.g., Study React Hooks & Context architecture' : 'e.g., Complete 5 LeetCode binary search problems'}
                          value={goalText}
                          onChange={(e) => setGoalText(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] text-sm"
                          required
                        />
                        <span className="text-[10px] text-[#718894] block text-right mt-1 font-mono">
                          {goalText.length}/120 characters
                        </span>
                      </div>

                      {goalType === 'TIME' && (
                        <div>
                          <label htmlFor="targetFocusTimeInput" className="block text-xs font-semibold text-[#F2F6F8] mb-1">
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
                            className="w-full sm:w-48 px-4 py-2 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] text-sm font-mono font-bold"
                            required
                          />
                          <p className="text-[11px] text-[#718894] mt-1.5">
                            Goal completes automatically when qualifying focus time reaches target.
                          </p>
                        </div>
                      )}

                      {goalType === 'COUNT' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="targetCountInput" className="block text-xs font-semibold text-[#F2F6F8] mb-1">
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
                              className="w-full px-4 py-2 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] text-sm font-mono font-bold"
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="targetUnitInput" className="block text-xs font-semibold text-[#F2F6F8] mb-1">
                              Target Unit / Metric <span className="text-[#718894] font-normal">(Optional)</span>
                            </label>
                            <input
                              id="targetUnitInput"
                              type="text"
                              maxLength={40}
                              placeholder="e.g., questions, pages, commits"
                              value={targetUnit}
                              onChange={(e) => setTargetUnit(e.target.value)}
                              className="w-full px-4 py-2 rounded-xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {goalError && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{goalError}</span>
                    </div>
                  )}
                </div>

                {/* 4. SESSION INTENTION (Optional) */}
                <div className="p-6 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#F2F6F8] tracking-tight flex items-center space-x-2">
                        <span>4. Session Intention</span>
                        <span className="text-xs text-[#718894] font-normal">(Optional)</span>
                      </h2>
                      <p className="text-xs text-[#9BAFBC] mt-0.5">
                        Write a short note to stay accountable.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#718894]">{intention.length} / 300</span>
                  </div>

                  <textarea
                    id="sessionIntentionInput"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value.slice(0, 300))}
                    placeholder="What do you want to accomplish in this session?"
                    rows={2}
                    className="w-full px-4 py-3 rounded-2xl bg-[#142A32] border border-[rgba(120,170,190,0.25)] text-[#F2F6F8] placeholder-[#718894] focus:outline-none focus:border-[#168CFF] focus:ring-1 focus:ring-[#168CFF] text-xs resize-none transition-all leading-relaxed"
                  />
                  <p className="text-[11px] text-[#718894]">
                    Recorded in your Focus Journal. Adding an intention does not alter session metrics or timer startup.
                  </p>
                </div>

                {/* Privacy & Security Observability Notice */}
                <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-[#142A32] border border-[rgba(120,170,190,0.16)] text-xs text-[#9BAFBC]">
                  <ShieldCheck className="w-5 h-5 text-[#00B8E6] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#F2F6F8]">100% Client-Side Privacy Guarantee</p>
                    <p className="text-[11px] text-[#718894] leading-relaxed">
                      AI vision models run entirely locally via WebAssembly. No video frames, screen feeds, or audio signals are ever uploaded to any server.
                    </p>
                  </div>
                </div>

                {/* 9. PRIMARY CTA BUTTON */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={isPreparing}
                    className="w-full group relative py-4 px-6 rounded-2xl bg-gradient-to-r from-[#168CFF] to-[#00B8E6] hover:from-[#1b93ff] hover:to-[#17c2ee] active:scale-[0.99] text-white font-bold text-base shadow-xl shadow-[#168CFF]/25 hover:shadow-[#168CFF]/40 flex items-center justify-between transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                      <span className="tracking-wide">Start Focus Session</span>
                    </div>
                    <div className="flex items-center space-x-2 text-white/90 group-hover:translate-x-1 transition-transform">
                      <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
                        Initialize ({activeDurationMinutes}m)
                      </span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </button>

                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="text-xs text-[#718894] hover:text-[#F2F6F8] transition-colors py-1 px-2 rounded-lg"
                    >
                      Cancel and return to dashboard
                    </button>
                    <span className="text-[11px] text-[#718894] font-mono">
                      Step 1 of 2 (Hardware Check)
                    </span>
                  </div>
                </div>

              </div>

              {/* -------------------------------------------------------- */}
              {/* RIGHT COLUMN: SESSION PREVIEW & MOTIVATION (~32% width) */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-4 space-y-6">

                {/* 10. SESSION PREVIEW CARD */}
                <div className="p-6 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] space-y-5 shadow-2xl shadow-black/30">
                  <div className="flex items-center justify-between border-b border-[rgba(120,170,190,0.1)] pb-3">
                    <div className="flex items-center space-x-2">
                      <Compass className="w-4 h-4 text-[#168CFF]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2F6F8]">Session Preview</h3>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#168CFF]/15 text-[#00B8E6] border border-[#168CFF]/30">
                      Live
                    </span>
                  </div>

                  {/* Circular Timer Visualization Preview */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                        <defs>
                          <linearGradient id="previewRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#168CFF" />
                            <stop offset="100%" stopColor="#00B8E6" />
                          </linearGradient>
                        </defs>
                        {/* Background track circle */}
                        <circle
                          cx="80"
                          cy="80"
                          r="66"
                          stroke="rgba(120, 170, 190, 0.12)"
                          strokeWidth="7"
                          fill="none"
                        />
                        {/* Active progress accent ring */}
                        <circle
                          cx="80"
                          cy="80"
                          r="66"
                          stroke="url(#previewRingGradient)"
                          strokeWidth="7"
                          fill="none"
                          strokeDasharray="414.7"
                          strokeDashoffset="75"
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out"
                        />
                      </svg>
                      {/* Center content */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        <span className="text-3xl font-mono font-extrabold text-[#F2F6F8] tracking-tight">
                          {formatPreviewTime(activeDurationMinutes)}
                        </span>
                        <div className="mt-1 max-w-[120px] truncate">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#203A43] text-[#00B8E6] border border-[rgba(120,170,190,0.2)]">
                            {finalActivityName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#718894] mt-2 text-center max-w-[220px] truncate">
                      {currentActivityObj?.desc || 'Target focus activity'}
                    </p>
                  </div>

                  {/* Summary Breakdown Rows */}
                  <div className="space-y-2.5 border-t border-[rgba(120,170,190,0.1)] pt-4 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[rgba(120,170,190,0.06)]">
                      <span className="text-[#718894] font-medium">Goal</span>
                      <span className="font-semibold text-[#F2F6F8] text-right truncate max-w-[170px]" title={previewGoalTitle}>
                        {previewGoalText}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[rgba(120,170,190,0.06)]">
                      <span className="text-[#718894] font-medium">Intention</span>
                      <span className="font-semibold text-[#F2F6F8] text-right truncate max-w-[170px]" title={intention || 'Not set'}>
                        {intention.trim() ? intention.trim() : 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#718894] font-medium">Distractions</span>
                      <span className="inline-flex items-center space-x-1 font-semibold text-[#00B8E6]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B8E6] animate-pulse mr-1" />
                        Will be monitored
                      </span>
                    </div>
                  </div>
                </div>

                {/* 11. QUICK TIPS CARD */}
                <div className="p-5 rounded-3xl bg-[#18313A] border border-[rgba(120,170,190,0.16)] space-y-3.5 shadow-xl">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#9BAFBC]">
                    <Lightbulb className="w-4 h-4 text-[#00B8E6]" />
                    <span>Quick Tips</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[#9BAFBC]">
                    <li className="flex items-start space-x-2.5">
                      <Check className="w-3.5 h-3.5 text-[#00B8E6] shrink-0 mt-0.5" />
                      <span>Choose a realistic duration</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="w-3.5 h-3.5 text-[#00B8E6] shrink-0 mt-0.5" />
                      <span>Set a clear intention</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="w-3.5 h-3.5 text-[#00B8E6] shrink-0 mt-0.5" />
                      <span>Keep distractions away</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="w-3.5 h-3.5 text-[#00B8E6] shrink-0 mt-0.5" />
                      <span>Take short breaks</span>
                    </li>
                    <li className="flex items-start space-x-2.5">
                      <Check className="w-3.5 h-3.5 text-[#00B8E6] shrink-0 mt-0.5" />
                      <span>Be consistent</span>
                    </li>
                  </ul>
                </div>

                {/* 12. PRODUCTIVITY / MOTIVATIONAL CARD */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-[#18313A] to-[#142A32] border border-[rgba(120,170,190,0.16)] relative overflow-hidden shadow-xl">
                  {/* Abstract productivity graph / wave SVG */}
                  <svg className="absolute bottom-0 right-0 w-36 h-20 text-[#168CFF] pointer-events-none" viewBox="0 0 120 80" fill="none">
                    <path d="M0 60 Q 30 50, 60 30 T 120 10 L 120 80 L 0 80 Z" fill="currentColor" fillOpacity="0.08" />
                    <path d="M0 60 Q 30 50, 60 30 T 120 10" stroke="#168CFF" strokeWidth="2" strokeOpacity="0.35" fill="none" />
                  </svg>
                  <div className="relative z-10 space-y-1">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-[#168CFF]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#168CFF]">Daily Motivation</span>
                    </div>
                    <h4 className="text-base font-bold text-[#F2F6F8] leading-tight pt-1">
                      Small Steps<br />Big Results
                    </h4>
                    <p className="text-xs text-[#9BAFBC] pt-1">
                      Focus today. A better you tomorrow.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </form>
        )}

      </div>
    </div>
  );
}
