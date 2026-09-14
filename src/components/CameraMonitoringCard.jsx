import React, { useEffect, useRef } from 'react';
import { Camera, CameraOff, Lock, ShieldCheck, RefreshCw, AlertCircle, Eye, UserCheck } from 'lucide-react';

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

  // Callback ref: fires when DOM node mounts
  const handleVideoRef = (node) => {
    if (externalVideoRef) {
      externalVideoRef.current = node;
    }
    internalVideoRef.current = node;

    if (node) {
      console.log('[Video] element mounted');
      if (stream && node.srcObject !== stream) {
        node.srcObject = stream;
        console.log('[Video] srcObject attached');
        node.play().then(() => {
          console.log('[Video] play() resolved');
        }).catch((err) => {
          console.error('[Video] play() rejected:', err);
        });
      }
    }
  };

  // Effect to attach stream if stream updates while video is already mounted
  useEffect(() => {
    const videoNode = videoRef.current;
    if (videoNode) {
      if (stream && videoNode.srcObject !== stream) {
        videoNode.srcObject = stream;
        console.log('[Video] srcObject attached');
        videoNode.play().then(() => {
          console.log('[Video] play() resolved');
        }).catch((err) => {
          console.error('[Video] play() rejected:', err);
        });
      } else if (!stream) {
        videoNode.srcObject = null;
      }
    }
  }, [stream, videoRef]);

  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800 flex flex-col justify-between h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg border ${
            isCameraActive 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Camera Monitoring</h3>
            <p className="text-xs text-slate-400">On-Device Signal Observation</p>
          </div>
        </div>

        {/* Status Badge */}
        {isCameraActive ? (
          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Camera Active</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            <CameraOff className="w-3 h-3 text-slate-400 mr-1" />
            <span>Disabled</span>
          </span>
        )}
      </div>

      {/* Main Container / Video Feed Display */}
      <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden mb-4 flex items-center justify-center">
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
            {/* Live Indicator Overlay */}
            <div className="absolute top-2 left-2 flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-950/80 backdrop-blur border border-slate-800 text-[10px] text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE</span>
            </div>
          </div>
        ) : error ? (
          /* CASE 2: Error or Permission Denied State */
          <div className="p-4 text-center max-w-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
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
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Camera className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-xs font-medium text-slate-200">Camera is currently disabled.</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enabling camera access will allow local detection of presence & focus posture. Raw video will strictly remain on your device.
            </p>
          </div>
        )}
      </div>

      {/* Action Controls & Privacy Disclaimer */}
      <div className="space-y-3">
        {/* Controls */}
        {isCameraActive ? (
          <button
            onClick={onDisableCamera}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <CameraOff className="w-4 h-4 text-slate-400" />
            <span>Disable Camera</span>
          </button>
        ) : error ? (
          <button
            onClick={onEnableCamera}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600/90 hover:bg-brand-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Requesting Access...' : 'Try Again'}</span>
          </button>
        ) : (
          <button
            onClick={onEnableCamera}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01]"
          >
            <Camera className="w-4 h-4" />
            <span>{isLoading ? 'Requesting Access...' : 'Enable Camera'}</span>
          </button>
        )}

        {/* Privacy Text Banner */}
        <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>Your camera stream currently stays in your browser and is not uploaded.</span>
        </div>
      </div>
    </div>
  );
}
