import React, { useState } from 'react';
import { Mic, MicOff, ShieldCheck, Terminal, ChevronDown, ChevronUp, AlertCircle, Volume2 } from 'lucide-react';
import { SPEECH_STATES } from '../services/speechDetector.js';

export function MicrophoneMonitoringCard({
  isMicrophoneActive = false,
  isLoading = false,
  error = null,
  speechState = SPEECH_STATES.SILENCE,
  audioLevel = 0.0,
  debugStats = {},
  onEnableMicrophone = () => {},
  onDisableMicrophone = () => {},
}) {
  const [showDebug, setShowDebug] = useState(false);
  const [showPrivacyPrompt, setShowPrivacyPrompt] = useState(false);

  const isSpeechLike = speechState === SPEECH_STATES.SPEECH_LIKE;

  const handleEnableClick = () => {
    setShowPrivacyPrompt(true);
  };

  const handleConfirmEnable = () => {
    setShowPrivacyPrompt(false);
    onEnableMicrophone();
  };

  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg ${isMicrophoneActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {isMicrophoneActive ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Microphone</h3>
            <p className="text-xs text-slate-400">Local Web Audio VAD</p>
          </div>
        </div>

        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded ${
          isMicrophoneActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isMicrophoneActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
          {isMicrophoneActive ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Main Status & Activity Info */}
      <div className="space-y-3 flex-1 flex flex-col justify-center my-2">
        {/* Status Indicator */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Audio activity</span>
          {!isMicrophoneActive ? (
            <span className="text-slate-500 font-semibold">Not active</span>
          ) : isSpeechLike ? (
            <span className="inline-flex items-center font-bold text-amber-400">
              <Volume2 className="w-3.5 h-3.5 mr-1.5 animate-bounce text-amber-400" />
              Speech-like
            </span>
          ) : (
            <span className="inline-flex items-center font-semibold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500 mr-1.5" />
              Silence
            </span>
          )}
        </div>

        {/* Live Audio Level Meter */}
        {isMicrophoneActive && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Audio Level</span>
              <span>{Math.round(audioLevel * 100)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  audioLevel >= 0.15 ? 'bg-amber-400' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, Math.round(audioLevel * 100)))}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message display */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-[11px] font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </div>

      {/* Explicit Privacy Modal Prompt */}
      {showPrivacyPrompt && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3 my-2 text-xs">
          <div className="flex items-start space-x-2 text-amber-300 font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <span>Optional Microphone Access</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Microphone access is optional. FocusLens analyzes audio locally in your browser to estimate when speech-like activity is present. Audio is <strong>never uploaded, recorded, or stored</strong> into a file.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmEnable}
              className="flex-1 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-md"
            >
              Confirm & Enable
            </button>
            <button
              type="button"
              onClick={() => setShowPrivacyPrompt(false)}
              className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!showPrivacyPrompt && (
        <div className="pt-2">
          {isMicrophoneActive ? (
            <button
              type="button"
              onClick={onDisableMicrophone}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800 text-slate-300 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center space-x-2"
            >
              <MicOff className="w-4 h-4" />
              <span>Disable Microphone</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnableClick}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-semibold text-xs transition-all shadow-md shadow-amber-600/20 flex items-center justify-center space-x-2"
            >
              <Mic className="w-4 h-4" />
              <span>{isLoading ? 'Requesting Access...' : 'Enable Microphone'}</span>
            </button>
          )}
        </div>
      )}

      {/* Developer Diagnostics Section */}
      <div className="mt-2 pt-2 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          className="w-full flex items-center justify-between py-1 text-[11px] text-slate-500 hover:text-slate-300 font-mono transition-colors"
        >
          <span className="flex items-center space-x-1">
            <Terminal className="w-3 h-3 text-amber-400" />
            <span>Audio Diagnostics</span>
          </span>
          {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showDebug && (
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1.5 my-1">
            <div className="text-amber-400 font-bold text-[11px] pb-1 border-b border-slate-800 flex justify-between">
              <span>AUDIO DIAGNOSTICS</span>
              <span>{isMicrophoneActive ? 'RUNNING' : 'STOPPED'}</span>
            </div>

            <div className="flex justify-between">
              <span>Microphone stream:</span>
              <span className={isMicrophoneActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isMicrophoneActive ? 'OK' : 'DISABLED'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>AudioContext:</span>
              <span className={debugStats.audioContextState === 'running' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {(debugStats.audioContextState || 'CLOSED').toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span>AnalyserNode:</span>
              <span className={debugStats.analyserReady ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {debugStats.analyserReady ? 'READY' : 'OFF'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Current audio level:</span>
              <span className="text-amber-300 font-bold">
                {Math.round((debugStats.audioLevel || audioLevel) * 100)}% ({debugStats.audioLevel || audioLevel})
              </span>
            </div>

            <div className="flex justify-between">
              <span>Speech VAD detector:</span>
              <span className={isMicrophoneActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isMicrophoneActive ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-900 pt-1">
              <span>Current state:</span>
              <span className={isSpeechLike ? 'text-amber-400 font-bold animate-pulse' : 'text-slate-300'}>
                {speechState}
              </span>
            </div>
          </div>
        )}

        {/* Privacy Note Footer */}
        <div className="mt-2 flex items-center space-x-1.5 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>Local browser Web Audio analysis. Audio is not recorded or uploaded.</span>
        </div>
      </div>
    </div>
  );
}
