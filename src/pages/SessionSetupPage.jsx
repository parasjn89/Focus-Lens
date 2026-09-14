import React, { useState, useRef } from 'react';
import {
  BookOpen, Code2, BookMarked, Video, Edit3, Clock, Play, ShieldAlert,
  Camera, Mic, Monitor, Check, X, AlertCircle, Loader2
} from 'lucide-react';
import { requestMicrophoneStream } from '../services/microphoneMonitor.js';

export function SessionSetupPage({ onStartSession, onCancel }) {
  const [selectedActivity, setSelectedActivity] = useState('Studying');
  const [customActivity, setCustomActivity] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustomDurationSelected, setIsCustomDurationSelected] = useState(false);

  // Pre-session permission setup state machine
  const [isPreparing, setIsPreparing] = useState(false);
  const [setupStep, setSetupStep] = useState(null); // 'CAMERA' | 'MICROPHONE' | 'SCREEN' | 'COMPLETE'
  const [permissionStatuses, setPermissionStatuses] = useState({
    camera: 'IDLE', // 'IDLE' | 'REQUESTING' | 'ALLOWED' | 'DENIED' | 'UNAVAILABLE'
    microphone: 'IDLE',
    screen: 'IDLE',
  });

  const streamsRef = useRef({
    cameraStream: null,
    micStream: null,
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
    if (streamsRef.current.micStream) {
      streamsRef.current.micStream.getTracks().forEach(t => t.stop());
      streamsRef.current.micStream = null;
    }
    if (streamsRef.current.screenStream) {
      streamsRef.current.screenStream.getTracks().forEach(t => t.stop());
      streamsRef.current.screenStream = null;
    }
  };

  const handleCancelSetup = () => {
    stopAcquiredStreams();
    setIsPreparing(false);
    setSetupStep(null);
    setPermissionStatuses({ camera: 'IDLE', microphone: 'IDLE', screen: 'IDLE' });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isPreparing) return; // Prevent double-clicks

    const finalActivity = selectedActivity === 'Custom' 
      ? (customActivity.trim() || 'Custom Activity')
      : selectedActivity;
    
    const finalDuration = isCustomDurationSelected 
      ? (parseInt(customDuration, 10) || 25) 
      : durationMinutes;

    const validatedDuration = Math.max(1, finalDuration);

    setIsPreparing(true);
    setPermissionStatuses({ camera: 'IDLE', microphone: 'IDLE', screen: 'IDLE' });

    // STEP 1: CAMERA PERMISSION
    setSetupStep('CAMERA');
    setPermissionStatuses(prev => ({ ...prev, camera: 'REQUESTING' }));
    
    let camStream = null;
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        streamsRef.current.cameraStream = camStream;
        setPermissionStatuses(prev => ({ ...prev, camera: 'ALLOWED' }));
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionStatuses(prev => ({ ...prev, camera: 'DENIED' }));
        } else {
          setPermissionStatuses(prev => ({ ...prev, camera: 'UNAVAILABLE' }));
        }
      }
    } else {
      setPermissionStatuses(prev => ({ ...prev, camera: 'UNAVAILABLE' }));
    }

    await new Promise(r => setTimeout(r, 400));

    // STEP 2: MICROPHONE PERMISSION
    setSetupStep('MICROPHONE');
    setPermissionStatuses(prev => ({ ...prev, microphone: 'REQUESTING' }));

    let mStream = null;
    try {
      mStream = await requestMicrophoneStream();
      streamsRef.current.micStream = mStream;
      setPermissionStatuses(prev => ({ ...prev, microphone: 'ALLOWED' }));
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatuses(prev => ({ ...prev, microphone: 'DENIED' }));
      } else {
        setPermissionStatuses(prev => ({ ...prev, microphone: 'UNAVAILABLE' }));
      }
    }

    await new Promise(r => setTimeout(r, 400));

    // STEP 3: SCREEN SHARING PERMISSION
    setSetupStep('SCREEN');
    setPermissionStatuses(prev => ({ ...prev, screen: 'REQUESTING' }));

    let scStream = null;
    if (navigator?.mediaDevices?.getDisplayMedia) {
      try {
        scStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        streamsRef.current.screenStream = scStream;
        setPermissionStatuses(prev => ({ ...prev, screen: 'SHARED' }));
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'AbortError') {
          setPermissionStatuses(prev => ({ ...prev, screen: 'CANCELLED' }));
        } else {
          setPermissionStatuses(prev => ({ ...prev, screen: 'UNAVAILABLE' }));
        }
      }
    } else {
      setPermissionStatuses(prev => ({ ...prev, screen: 'UNAVAILABLE' }));
    }

    await new Promise(r => setTimeout(r, 500));

    // STEP 4: PERMISSIONS COMPLETE -> START SESSION
    setSetupStep('COMPLETE');

    onStartSession({
      activity: finalActivity,
      durationMinutes: validatedDuration,
      initialStreams: {
        cameraStream: streamsRef.current.cameraStream,
        micStream: streamsRef.current.micStream,
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
        return (
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1 font-medium">
            <AlertCircle className="w-3 h-3" />
            <span>Unavailable</span>
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-500 font-medium">Pending</span>
        );
    }
  };

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
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Preparing Focus Session</h2>
            <p className="text-xs text-slate-400 max-w-md">
              Handling permissions & initializing monitoring signals before the focus countdown begins.
            </p>
          </div>

          <div className="space-y-3 text-left border-t border-b border-slate-800/80 py-5 my-4">
            {/* Camera */}
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

            {/* Microphone */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-slate-200">2. Microphone Input</span>
                  <p className="text-[11px] text-slate-400">Voice activity detection</p>
                </div>
              </div>
              <div>{renderStatusBadge(permissionStatuses.microphone)}</div>
            </div>

            {/* Screen Sharing */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-slate-200">3. Screen Sharing</span>
                  <p className="text-[11px] text-slate-400">Context classification</p>
                </div>
              </div>
              <div>{renderStatusBadge(permissionStatuses.screen)}</div>
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
            <span className="text-xs font-semibold text-brand-400 animate-pulse">
              {setupStep === 'COMPLETE' ? 'Launching Session...' : `Checking ${setupStep || 'Permissions'}...`}
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
            className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all hover:scale-105"
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
