import React from 'react';
import { Play, Shield, Eye, Cpu, BarChart3, Lock, CheckCircle2, ArrowRight } from 'lucide-react';

export function LandingPage({ onStartSetup }) {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto px-4 pt-8 pb-12">
        {/* Glow backdrop decorative accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/20 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-medium mb-6">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Privacy-First AI-Assisted Focus Tracker</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Understand where your focus time actually goes <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-300 to-cyan-300"></span>
        </h1>

        {/* Tagline & Short Description */}
        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed mb-8">
          FocusLens monitors observable signals like presence, screen activity, and posture strictly on-device to help you build deeper focus habits without compromising privacy.
        </p>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartSetup}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-base shadow-xl shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Start Focus Session</span>
          </button>
        </div>
      </section>

      {/* Core Principles Grid */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Designed Around Strict Privacy Standards</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            FocusLens strictly observes physical activity signals without claiming to "read minds" or track private personal content.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">100% On-Device</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Raw camera video feeds and screen frames never leave your device. Computer vision models execute directly in your browser.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Observable Signals Only</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                FocusLens tracks objective, observable states (person presence, phone usage, posture gaze) rather than assuming subjective mental states.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Post-Session Analytics</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Receive structured timelines and visual reports highlighting unbroken focus windows, pause patterns, and distraction triggers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/80">
          <h3 className="text-xl font-bold text-white mb-6 text-center">What FocusLens Observes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-slate-300 font-medium">User Presence & Absence Detection</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-slate-300 font-medium">Phone & External Object Distractions</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-slate-300 font-medium">Head Pose & Gaze Direction Variance</span>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-slate-300 font-medium">Optional Active Window Categorization</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
