import React from 'react';
import { Monitor, ShieldAlert, MonitorUp, CheckCircle2 } from 'lucide-react';

export function ScreenCardPlaceholder() {
  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden border border-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Screen & App Activity</h3>
            <p className="text-xs text-slate-400">Optional Context Analysis</p>
          </div>
        </div>
        <span className="inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          <span>Inactive</span>
        </span>
      </div>

      {/* Main Container */}
      <div className="relative aspect-video rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden mb-4">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            <MonitorUp className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-xs font-medium text-slate-200 mb-1">Screen Sharing Optional</p>
          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
            Will allow categorizing work tools vs. distraction websites locally without uploading your private window content.
          </p>
        </div>
      </div>

      {/* Simulated Indicators */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center space-x-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Target Application Context</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Primary Focus Window</span>
        </div>

        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center space-x-2 text-slate-300">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <span>Tab Switch Frequency</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Normal (Low)</span>
        </div>
      </div>
    </div>
  );
}
