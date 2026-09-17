import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, ArrowRight, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, Clock, Target, Lightbulb } from 'lucide-react';
import { apiFetch } from '../api/client';

export function FocusCoachPage({ onStartRecommendedSession, onNewSession }) {
  const [coachData, setCoachData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCoachData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/analytics/focus-coach');
      setCoachData(res);
    } catch (err) {
      console.error('Failed to fetch Focus Coach data:', err);
      setError('Could not load Focus Coach suggestions. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoachData();
  }, []);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
        <p className="text-sm font-medium">Analyzing your recent session patterns...</p>
      </div>
    );
  }

  const isLowData = coachData?.insufficientData;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/20">
              <Compass className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Focus Coach</h1>
          </div>
          <p className="text-sm text-slate-400">
            Practical, evidence-based suggestions based on your recent FocusLens sessions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCoachData}
            className="flex items-center space-x-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh Analysis</span>
          </button>

          <button
            onClick={onNewSession}
            className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
          >
            Start Focus Session
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Low-Data Empty State */}
      {isLowData ? (
        <div className="mt-10 p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Not Enough Session Data Yet</h2>
          <p className="text-sm text-slate-400 mt-2 mb-6 leading-relaxed">
            {coachData?.message || 'Complete a few more sessions and Focus Coach will start giving personalized recommendations based on your actual focus patterns.'}
          </p>
          <div className="text-xs text-slate-500 mb-8 font-mono">
            Analyzed {coachData?.generatedFromSessions || 0} / {coachData?.minimumRequired || 3} required completed sessions
          </div>
          <button
            onClick={onNewSession}
            className="inline-flex items-center space-x-2 text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-brand-600/25 transition-all hover:scale-105"
          >
            <span>Start Focus Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Main Card: YOUR NEXT MOVE */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-brand-500/40 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Sparkles className="w-64 h-64 text-brand-400" />
            </div>

            <div className="relative z-10 space-y-6">
              {/* Badge */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider">
                  <Lightbulb className="w-3.5 h-3.5 text-brand-400" />
                  <span>Your Next Move</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Based on your last {coachData?.generatedFromSessions || 14} sessions
                </span>
              </div>

              {/* Recommendation Title */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  {coachData?.recommendation}
                </h2>
                <p className="text-sm text-slate-300 mt-2 font-medium">
                  {coachData?.observation}
                </p>
              </div>

              {/* Evidence / Reason Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Why This Recommendation?</span>
                <p className="text-slate-200 text-sm leading-relaxed">{coachData?.reason}</p>
              </div>

              {/* Suggested Session Box & Action */}
              {coachData?.suggestedSession && (
                <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400">Suggested Next Session:</span>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-200">
                      <div className="flex items-center space-x-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                        <Clock className="w-3.5 h-3.5 text-brand-400" />
                        <span>{coachData.suggestedSession.durationMinutes} minutes</span>
                      </div>
                      {coachData.suggestedSession.goalText && (
                        <div className="flex items-center space-x-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                          <Target className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="truncate max-w-xs">{coachData.suggestedSession.goalText}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onStartRecommendedSession(coachData.suggestedSession)}
                    className="inline-flex items-center justify-center space-x-2 text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white px-5 py-3 rounded-xl shadow-lg shadow-brand-600/25 transition-all hover:scale-105 shrink-0"
                  >
                    <span>Start Recommended Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Observation Card */}
          {coachData?.secondary && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Supporting Insight</span>
              </div>
              <h3 className="text-base font-bold text-white">{coachData.secondary.recommendation}</h3>
              <p className="text-xs text-slate-300">{coachData.secondary.observation}</p>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                Reason: {coachData.secondary.reason}
              </div>
            </div>
          )}

          {/* Privacy & Methodology Footer Notice */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-start space-x-3 text-xs text-slate-400">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">100% Deterministic & Privacy-Preserving Engine:</span>
              {' '}Focus Coach recommendations are calculated entirely from your stored session metadata without external AI services or raw camera data processing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
