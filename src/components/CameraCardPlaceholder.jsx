import React from 'react';
import { Camera, Lock, UserCheck, Smartphone, EyeOff } from 'lucide-react';

export function CameraCardPlaceholder() {
  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Camera Observational Signals</h3>
            <p className="text-xs text-slate-400">On-Device Vision Analysis</p>
          </div>
        </div>
        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Placeholder</span>
        </span>
      </div>

      {/* Main Preview Container / Placeholder Graphic */}
      <div className="relative aspect-video rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden mb-4">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
        
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            <EyeOff className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-xs font-medium text-slate-200 mb-1">Webcam Feed Off (Initial Version)</p>
          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
            Future updates will analyze head pose & presence locally using browser MediaPipe algorithms without streaming raw video anywhere.
          </p>
        </div>
      </div>

      {/* Simulated Detection Signal Indicators */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center space-x-2 text-slate-300">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Person Presence</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Simulated Active</span>
        </div>

        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center space-x-2 text-slate-300">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>Phone Interference</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Not Detected</span>
        </div>
      </div>
    </div>
  );
}
