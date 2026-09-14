import React, { useState } from 'react';
import {
  Award,
  Clock,
  BarChart2,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  Users,
  Code,
  Download,
  ShieldCheck,
  Zap,
  Activity,
  AlertCircle,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import {
  calculateActivityDurations,
  calculateActivityPercentages,
  countActivitySegments,
  mergeAdjacentSegments,
  generateSessionInsights,
  exportSessionMetadata,
  generateMockSessionData,
} from '../utils/sessionAnalytics.js';
import { ActivityBreakdownChart, CATEGORY_COLORS } from '../components/ActivityBreakdownChart.jsx';
import { ActivityTimeline } from '../components/ActivityTimeline.jsx';
import { SegmentDetailModal } from '../components/SegmentDetailModal.jsx';

export function SessionReportPage({ reportData: initialReportData, onNewSession, onHome }) {
  const [reportData, setReportData] = useState(initialReportData || {});
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedRelativeTiming, setSelectedRelativeTiming] = useState(null);
  const [isExported, setIsExported] = useState(false);

  const {
    activity = 'Focus Session',
    targetMinutes = 25,
    actualSecondsSpent = 0,
    pausedSecondsSpent = 0,
    activitySegments = [],
    completedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMockData = false,
  } = reportData || {};

  // Analytics calculation
  const mergedSegments = mergeAdjacentSegments(activitySegments);
  const totalActiveSeconds = Math.max(0, actualSecondsSpent);
  const categoryDurations = calculateActivityDurations(mergedSegments);
  const categoryPercentages = calculateActivityPercentages(categoryDurations, totalActiveSeconds);
  const categorySegmentCounts = countActivitySegments(mergedSegments);
  const insights = generateSessionInsights(mergedSegments, totalActiveSeconds);

  const activeCategories = Object.keys(categoryDurations).filter(
    (key) => (categoryDurations[key] || 0) > 0
  );

  // Download JSON export
  const handleExportJSON = () => {
    const exportPayload = exportSessionMetadata(reportData, mergedSegments);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `FocusLens_Session_Report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setIsExported(true);
    setTimeout(() => setIsExported(false), 3000);
  };

  // Toggle mock data for dev testing
  const handleLoadMockData = () => {
    const mock = generateMockSessionData();
    setReportData(mock);
  };

  const totalMinutesSpent = Math.max(1, Math.round(totalActiveSeconds / 60));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="text-center relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brand-500/20">
          <Award className="w-8 h-8 text-white" />
        </div>

        <div className="flex items-center justify-center space-x-2 mb-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
            Session Completed
          </span>
          {isMockData && (
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Dev Test Data (120 Min)
            </span>
          )}
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">SESSION REPORT</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Derived activity report for <strong>{activity}</strong> completed at {completedAt}.
        </p>

        {/* Dev Mock Data Toggle Button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleLoadMockData}
            className="text-[11px] font-mono text-slate-500 hover:text-brand-300 underline transition-colors"
          >
            [ Load 120-Min Dev Test Data ]
          </button>
        </div>
      </div>

      {/* SECTION 1: Prominent Session Overview */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">SESSION OVERVIEW</h2>
              <p className="text-xs text-slate-400">Target & actual session execution</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-md flex items-center space-x-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExported ? 'Exported!' : 'Export Session JSON'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Planned */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Planned Duration</span>
            <span className="text-2xl font-bold text-white font-mono">{targetMinutes} min</span>
          </div>

          {/* Actual */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Actual Duration</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {totalMinutesSpent} min
            </span>
            <span className="text-[10px] text-slate-500 block font-mono">({formatSecondsToTime(totalActiveSeconds)})</span>
          </div>

          {/* Paused */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Paused Duration</span>
            <span className="text-2xl font-bold text-slate-300 font-mono">
              {Math.round(pausedSecondsSpent / 60)} min
            </span>
          </div>

          {/* Target Activity */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Selected Target</span>
            <span className="text-base font-extrabold text-brand-300 truncate block mt-1">
              {activity}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State Warning */}
      {mergedSegments.length === 0 && (
        <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <strong>Not enough monitoring data to generate a detailed activity breakdown.</strong>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Ensure camera or screen monitoring is enabled during focus sessions to capture observational signals.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 2: Activity Breakdown Cards Grid */}
      {activeCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            ACTIVITY BREAKDOWN CARDS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {activeCategories.map((type) => {
              const durSec = categoryDurations[type] || 0;
              const pct = categoryPercentages[type] || 0;
              const count = categorySegmentCounts[type] || 0;
              const label = ACTIVITY_LABELS[type] || type;
              const style = CATEGORY_COLORS[type] || CATEGORY_COLORS.UNKNOWN;

              return (
                <div key={type} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-white flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.bg}`} />
                      <span>{label}</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-brand-400 bg-brand-950/60 px-2 py-0.5 rounded border border-brand-900/60">
                      {pct}%
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {formatMinutesText(Math.round(durSec / 60))}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                      <span>{formatSecondsToTime(durSec)}</span>
                      <span>{count} segment{count === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Activity Breakdown Bar Chart */}
      <ActivityBreakdownChart
        durations={categoryDurations}
        percentages={categoryPercentages}
        totalActiveSeconds={totalActiveSeconds}
      />

      {/* SECTION 4: Session Insights Grid */}
      {mergedSegments.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
            <TrendingUp className="w-5 h-5 text-brand-400" />
            <h3 className="text-base font-bold text-white">Session Insights</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Longest Study / Coding Streak */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-slate-400 font-medium">Longest Study Streak</span>
              <div className="text-xl font-bold text-emerald-400 font-mono my-1">
                {Math.round(insights.longestStudyStreakSec / 60)} min
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {formatSecondsToTime(insights.longestStudyStreakSec)} uninterrupted
              </span>
            </div>

            {/* Phone Activity */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-slate-400 font-medium">Phone Interference</span>
              <div className="text-xl font-bold text-amber-400 font-mono my-1">
                {Math.round(insights.totalPhoneSec / 60)} min
              </div>
              <span className="text-[10px] text-slate-500">
                {insights.phoneEventCount} event{insights.phoneEventCount === 1 ? '' : 's'} (Max: {formatSecondsToTime(insights.longestPhoneEventSec)})
              </span>
            </div>

            {/* Multiple People */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-slate-400 font-medium">Multiple People</span>
              <div className="text-xl font-bold text-indigo-300 font-mono my-1">
                {Math.round(insights.totalMultiplePeopleSec / 60)} min
              </div>
              <span className="text-[10px] text-slate-500">
                {insights.multiplePeopleEventCount} event{insights.multiplePeopleEventCount === 1 ? '' : 's'}
              </span>
            </div>

            {/* Activity Transitions */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-slate-400 font-medium">Activity Transitions</span>
              <div className="text-xl font-bold text-brand-300 font-mono my-1">
                {insights.transitionCount}
              </div>
              <span className="text-[10px] text-slate-500">
                Context switches recorded
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Activity Timeline */}
      <ActivityTimeline
        segments={mergedSegments}
        sessionStartMs={Date.now() - totalActiveSeconds * 1000}
        onSelectSegment={(seg, timing) => {
          setSelectedSegment(seg);
          setSelectedRelativeTiming(timing);
        }}
      />

      {/* Segment Details Modal */}
      {selectedSegment && (
        <SegmentDetailModal
          segment={selectedSegment}
          relativeTiming={selectedRelativeTiming}
          onClose={() => {
            setSelectedSegment(null);
            setSelectedRelativeTiming(null);
          }}
        />
      )}

      {/* Privacy Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Report generated from locally processed activity signals. No video or screen frames are stored or exported.</span>
        </div>
        <button
          type="button"
          onClick={handleExportJSON}
          className="text-brand-300 hover:text-white underline font-semibold transition-colors ml-4 flex-shrink-0"
        >
          Export JSON
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <button
          type="button"
          onClick={onNewSession}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-105"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Start New Session</span>
        </button>

        <button
          type="button"
          onClick={onHome}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-900 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  );
}
