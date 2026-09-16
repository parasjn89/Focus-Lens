import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, CheckCircle2, Clock, Target, ShieldAlert, ArrowRight, Settings, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchRecommendedSession } from '../api/sessionApi.js';
import { BackButton } from '../components/BackButton.jsx';

export function RecommendationsPage({ onStartRecommendedSession, onCustomizeRecommendation, onNavigate, onNewSession }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecommendation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchRecommendedSession();
      setData(result);
    } catch (err) {
      console.error('Error fetching adaptive recommendation:', err);
      setError(err.message || 'Unable to load a recommendation right now.');
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchRecommendation();
  }, []);

  const handleStart = () => {
    if (data?.recommendation && onStartRecommendedSession) {
      onStartRecommendedSession({
        durationMinutes: data.recommendation.durationMinutes,
        goalText: data.recommendation.goalText,
        goalType: data.recommendation.goalType,
        targetValue: data.recommendation.targetValue,
        targetUnit: data.recommendation.targetUnit,
      });
    }
  };

  const handleCustomize = () => {
    if (data?.recommendation && onCustomizeRecommendation) {
      onCustomizeRecommendation({
        durationMinutes: data.recommendation.durationMinutes,
        goalText: data.recommendation.goalText,
        goalType: data.recommendation.goalType,
        targetValue: data.recommendation.targetValue,
        targetUnit: data.recommendation.targetUnit,
      });
    } else if (onStartRecommendedSession) {
      onStartRecommendedSession(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Sparkles className="w-6 h-6 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-200">Analyzing your recent sessions...</h2>
          <p className="text-sm text-slate-400">Evaluating focus utilization, deep work blocks, and goal completion patterns.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full mb-4 flex justify-start">
          <BackButton
            label="Back to Dashboard"
            onClick={() => onNavigate && onNavigate('dashboard')}
          />
        </div>
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-100">Unable to load a recommendation right now</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <button
            onClick={fetchRecommendation}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition shadow-lg shadow-emerald-900/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Insufficient history (< 5 completed sessions)
  if (!data?.available) {
    const completed = data?.sessionsCompleted || 0;
    const required = data?.sessionsRequired || 5;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <BackButton
              label="Back to Dashboard"
              onClick={() => onNavigate && onNavigate('dashboard')}
            />
          </div>

          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Compass className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Recommended Next Session</h1>
            </div>
            <p className="text-slate-400">Based on your recent FocusLens sessions.</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="max-w-md space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Not enough history yet</span>
              </div>

              <h2 className="text-2xl font-bold text-slate-100">
                Complete a few more sessions and FocusLens will start adapting recommendations to your focus patterns.
              </h2>

              <p className="text-sm text-slate-400 leading-relaxed">
                Personalized session recommendations require at least {required} completed focus sessions. You currently have {completed} completed {completed === 1 ? 'session' : 'sessions'}.
              </p>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Progress to personalized recommendations</span>
                  <span>{completed} / {required} sessions</span>
                </div>
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((completed / required) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onNewSession ? onNewSession() : onNavigate('setup')}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold transition shadow-lg shadow-emerald-900/30"
                >
                  <span>Start Focus Session</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rec = data.recommendation;
  const confidenceColorMap = {
    HIGH: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Contextual Navigation */}
        <div className="flex items-center justify-between">
          <BackButton
            label="Back to Dashboard"
            onClick={() => onNavigate && onNavigate('dashboard')}
          />
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
              <Compass className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Recommended Next Session</h1>
              <p className="text-sm text-slate-400 mt-1">Based on your recent FocusLens sessions.</p>
            </div>
          </div>
        </div>

        {/* Primary Recommendation Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-emerald-500/20 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Badge & Confidence */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Recommended for you</span>
            </div>

            {rec.confidence && (
              <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${confidenceColorMap[rec.confidence] || confidenceColorMap.MEDIUM}`}>
                Confidence: {rec.confidence}
              </span>
            )}
          </div>

          {/* Recommendation Main Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-b border-slate-800/80 pb-8">
            {/* Left: Duration & Goal */}
            <div className="space-y-4">
              <div className="flex items-baseline space-x-3">
                <Clock className="w-8 h-8 text-emerald-400 self-center" />
                <span className="text-5xl font-black text-white tracking-tight">{rec.durationMinutes}</span>
                <span className="text-xl font-medium text-slate-400">minutes</span>
              </div>

              {rec.goalText ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start space-x-3">
                  <Target className="w-5 h-5 text-teal-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Recommended Goal</span>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">{rec.goalText}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 flex items-center space-x-3">
                  <Target className="w-5 h-5 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Recommended Goal</span>
                    <p className="text-sm text-slate-400 italic mt-0.5">No specific goal needed — open timer</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Personal Reason */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Why this recommendation</span>
              <p className="text-base text-slate-200 leading-relaxed font-medium">
                "{rec.reason}"
              </p>
            </div>
          </div>

          {/* Evidence Grid */}
          {rec.evidence && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supporting Personal Evidence</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block font-medium">Sessions Analyzed</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{rec.evidence.sessionsAnalyzed}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block font-medium">Typical Focused Time</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-1 block">{rec.evidence.typicalFocusedMinutes} m</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block font-medium">Deep Work Peak</span>
                  <span className="text-2xl font-bold text-teal-400 mt-1 block">{rec.evidence.typicalLongestBlockMinutes} m</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-xs text-slate-400 block font-medium">Focus Utilization</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{rec.evidence.focusUtilizationPercent}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleStart}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center space-x-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-base transition shadow-xl shadow-emerald-900/30 active:scale-[0.99]"
            >
              <span>Start Recommended Session</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleCustomize}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold transition border border-slate-700"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Customize</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
