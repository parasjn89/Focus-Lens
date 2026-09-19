import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Camera, CameraOff, ShieldCheck, RefreshCw, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

export function CameraMonitoringCard({
  stream,
  isCameraActive,
  isLoading,
  error,
  onEnableCamera,
  onDisableCamera,
  videoRef: externalVideoRef,
}) {
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const previewContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Stable callback ref: directly updates ref when DOM node mounts or unmounts
  const handleVideoRef = useCallback((node) => {
    if (externalVideoRef) {
      externalVideoRef.current = node;
    }
    internalVideoRef.current = node;

    if (node) {
      if (stream && node.srcObject !== stream) {
        node.srcObject = stream;
        node.play().catch((err) => {
          console.error('[Video] play() rejected:', err);
        });
      }
    }
  }, [externalVideoRef, stream]);

  // Effect to attach stream if stream updates while video is already mounted
  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode) {
      if (stream && videoNode.srcObject !== stream) {
        videoNode.srcObject = stream;
        videoNode.play().catch((err) => {
          console.error('[Video] play() rejected:', err);
        });
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

  return (
    <div className="group rounded-3xl p-6 relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 flex flex-col justify-between h-full shadow-2xl shadow-black/50 hover:shadow-emerald-500/5 transition-all duration-300">
      {/* Ambient subtle top glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent pointer-events-none" />

      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner transition-colors ${
              isCameraActive 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-emerald-500/10' 
                : 'bg-slate-800/70 text-slate-400 border-slate-700/60'
            }`}>
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Camera Monitoring</h3>
              <p className="text-xs text-slate-400 font-normal">On-Device Signal Observation</p>
            </div>
          </div>

          {/* Status Badge */}
          {isCameraActive ? (
            <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Camera Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/80">
              <CameraOff className="w-3 h-3 text-slate-400" />
              <span>Disabled</span>
            </span>
          )}
        </div>

        {/* Main Container / Video Feed Display */}
        <div
          ref={previewContainerRef}
          className={`relative aspect-video rounded-2xl bg-slate-950/90 border border-slate-800/90 overflow-hidden mb-4 flex items-center justify-center shadow-inner transition-all ${
            isCameraActive ? 'border-emerald-500/30 ring-1 ring-emerald-500/15 shadow-lg shadow-emerald-950/30' : ''
          }`}
        >
          {/* CASE 1: Camera Active & Streaming */}
          {isCameraActive && stream ? (
            <div className="relative w-full h-full">
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100" // Mirror camera feed
              />

              {/* Top Bar Overlays: Live Indicator & Expand Action */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 text-[10px] font-bold text-emerald-400 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE</span>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen camera' : 'Fullscreen camera'}
                  className="pointer-events-auto p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-md"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Bottom Bar Overlay: On-Device Processing badge & HD indicator */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/90 text-[10px] text-slate-300 shadow-md">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>On-device processing</span>
                </div>

                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono font-semibold text-slate-400">
                  HD
                </span>
              </div>
            </div>
          ) : error ? (
            /* CASE 2: Error or Permission Denied State */
            <div className="p-4 text-center max-w-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-200">{error.message}</p>
              <p className="text-[11px] text-slate-400">
                You can continue the focus session without camera monitoring.
              </p>
            </div>
          ) : (
            /* CASE 3: Camera Disabled State */
            <div className="p-4 text-center max-w-xs space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Camera className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-xs font-medium text-slate-200">Camera is currently disabled.</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enabling camera access will allow local detection of presence & posture. Raw video strictly remains on your device.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls & Privacy Panel */}
      <div className="space-y-3 pt-1">
        {/* Controls */}
        {isCameraActive ? (
          <button
            type="button"
            onClick={onDisableCamera}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950/40 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/60 shadow-sm hover:shadow-rose-500/10 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <CameraOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Disable Camera</span>
          </button>
        ) : error ? (
          <button
            type="button"
            onClick={onEnableCamera}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-emerald-500/40 hover:border-emerald-500/60 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isLoading ? 'Requesting Access...' : 'Try Again'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnableCamera}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-500/70 text-xs font-semibold shadow-sm hover:shadow-emerald-500/10 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Requesting Access...' : 'Enable Camera'}</span>
          </button>
        )}

        {/* Glass Privacy Information Panel */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-300 leading-tight">
              Your camera stream currently stays in your browser and is not uploaded.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

