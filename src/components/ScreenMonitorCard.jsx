import React, { useEffect, useRef } from 'react';
import { Monitor, MonitorOff, Lock, ShieldCheck, RefreshCw, AlertCircle, MonitorUp, Eye } from 'lucide-react';
import { SCREEN_SOURCE_TYPES } from '../services/screenObserver';

export function ScreenMonitorCard({
  stream,
  isScreenActive,
  sourceType,
  isLoading,
  error,
  onEnableScreen,
  onDisableScreen,
  videoRef: externalVideoRef,
}) {
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const handleVideoRef = (node) => {
    if (externalVideoRef) {
      externalVideoRef.current = node;
    }
    internalVideoRef.current = node;

    if (node && stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play().catch((err) => console.error('[ScreenVideo] play() rejected:', err));
    }
  };

  // Attach MediaStream to video element srcObject when stream changes
  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode) {
      if (stream && videoNode.srcObject !== stream) {
        videoNode.srcObject = stream;
        videoNode.play().catch((err) => console.error('[ScreenVideo] play() rejected:', err));
      } else if (!stream) {
        videoNode.srcObject = null;
      }
    }
  }, [stream, videoRef]);

  // Format source type text
  const getSourceTypeLabel = () => {
    switch (sourceType) {
      case SCREEN_SOURCE_TYPES.SCREEN:
        return 'Entire Screen';
      case SCREEN_SOURCE_TYPES.WINDOW:
        return 'Application Window';
      case SCREEN_SOURCE_TYPES.BROWSER_TAB:
        return 'Browser Tab';
      default:
        return 'Shared Display';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800 flex flex-col justify-between h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg border ${
            isScreenActive 
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Screen Monitoring</h3>
            <p className="text-xs text-slate-400">User-Approved Context</p>
          </div>
        </div>

        {/* Status Badge */}
        {isScreenActive ? (
          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            <MonitorOff className="w-3 h-3 text-slate-400 mr-1" />
            <span>Not active</span>
          </span>
        )}
      </div>

      {/* Main Preview Container */}
      <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden mb-4 flex items-center justify-center">
        {/* CASE 1: Screen Sharing Active */}
        {isScreenActive && stream ? (
          <div className="relative w-full h-full">
            <video
              ref={handleVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain bg-black"
            />
            {/* Source Type Overlay Pill */}
            <div className="absolute top-2 left-2 flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-950/80 backdrop-blur border border-slate-800 text-[10px] text-cyan-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>{getSourceTypeLabel()}</span>
            </div>
          </div>
        ) : error ? (
          /* CASE 2: Canceled or Error State */
          <div className="p-4 text-center max-w-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">{error.message}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              You can continue the focus session without screen monitoring.
            </p>
          </div>
        ) : (
          /* CASE 3: Disabled State */
          <div className="p-4 text-center max-w-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <MonitorUp className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-xs font-medium text-slate-200">Screen Monitoring OFF</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              FocusLens needs temporary access to the screen you choose to share so it can understand which activity is occurring during your focus session.
            </p>
          </div>
        )}
      </div>

      {/* Action Controls & Privacy Disclaimer */}
      <div className="space-y-3">
        {/* Controls */}
        {isScreenActive ? (
          <button
            onClick={onDisableScreen}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <MonitorOff className="w-4 h-4 text-slate-400" />
            <span>Stop Screen Monitoring</span>
          </button>
        ) : error ? (
          <button
            onClick={onEnableScreen}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Requesting Access...' : 'Try Again'}</span>
          </button>
        ) : (
          <button
            onClick={onEnableScreen}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01]"
          >
            <Monitor className="w-4 h-4" />
            <span>{isLoading ? 'Requesting Access...' : 'Enable Screen Monitoring'}</span>
          </button>
        )}

        {/* Privacy Disclaimers */}
        <div className="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Only the screen you explicitly choose to share is available to FocusLens.</span>
          </div>
          <p className="text-[10px] text-slate-500 pl-5">
            Screen data is currently processed locally and is not uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
