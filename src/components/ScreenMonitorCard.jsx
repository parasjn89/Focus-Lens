import React, { useEffect, useRef, useState } from 'react';
import { Monitor, MonitorOff, ShieldCheck, RefreshCw, AlertCircle, MonitorUp, Maximize2, Minimize2 } from 'lucide-react';
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
  const previewContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Fullscreen toggle listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

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
    <div className="group rounded-3xl p-6 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 flex flex-col justify-between h-full shadow-2xl shadow-black/50 hover:shadow-cyan-500/5 transition-all duration-300">
      {/* Ambient subtle top glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner transition-colors ${
              isScreenActive 
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 shadow-cyan-500/10' 
                : 'bg-slate-800/70 text-slate-400 border-slate-700/60'
            }`}>
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Screen Monitoring</h3>
              <p className="text-xs text-slate-400 font-normal">User-Approved Context</p>
            </div>
          </div>

          {/* Status Badge */}
          {isScreenActive ? (
            <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-sm shadow-cyan-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/80">
              <MonitorOff className="w-3 h-3 text-slate-400" />
              <span>Not active</span>
            </span>
          )}
        </div>

        {/* Main Preview Container */}
        <div
          ref={previewContainerRef}
          className={`relative aspect-video rounded-2xl bg-slate-950/90 border border-slate-800/90 overflow-hidden mb-4 flex items-center justify-center shadow-inner transition-all ${
            isScreenActive ? 'border-cyan-500/30 ring-1 ring-cyan-500/15 shadow-lg shadow-cyan-950/30' : ''
          }`}
        >
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

              {/* Top Bar Overlays: Source Type Overlay Pill & Fullscreen */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-[10px] font-medium text-cyan-300 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{getSourceTypeLabel()}</span>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen screen' : 'Fullscreen screen'}
                  className="pointer-events-auto p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-md"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Bottom Bar Overlay: On-Device Processing badge */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/90 text-[10px] text-slate-300 shadow-md">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>On-device processing</span>
                </div>
              </div>
            </div>
          ) : error ? (
            /* CASE 2: Canceled or Error State */
            <div className="p-4 text-center max-w-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
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
              <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <MonitorUp className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-xs font-medium text-slate-200">Screen Monitoring OFF</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                FocusLens needs temporary access to the screen you choose to share so it can understand which activity is occurring during your focus session.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls & Privacy Panel */}
      <div className="space-y-3 pt-1">
        {/* Controls */}
        {isScreenActive ? (
          <button
            type="button"
            onClick={onDisableScreen}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950/40 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/60 shadow-sm hover:shadow-rose-500/10 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <MonitorOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Stop Screen Monitoring</span>
          </button>
        ) : error ? (
          <button
            type="button"
            onClick={onEnableScreen}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-cyan-500/40 hover:border-cyan-500/60 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isLoading ? 'Requesting Access...' : 'Try Again'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnableScreen}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-500/70 text-xs font-semibold shadow-sm hover:shadow-cyan-500/10 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Requesting Access...' : 'Enable Screen Monitoring'}</span>
          </button>
        )}

        {/* Glass Privacy Information Panel */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight space-y-0.5">
              <p className="text-slate-300 font-medium">Only the screen you explicitly choose to share is available to FocusLens.</p>
              <p className="text-[10px] text-slate-500">Screen data is currently processed locally and is not uploaded.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

