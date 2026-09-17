import React, { useState } from 'react';
import {
  Award,
  Flame,
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
  Compass,
  FileText,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { formatSecondsToTime, formatMinutesText } from '../utils/formatters.js';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { calculateFocusPointsFromDurations } from '../utils/focusPoints.js';
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

import { FocusReplayView } from '../components/FocusReplayView.jsx';
import { BackButton } from '../components/BackButton.jsx';
import { calculateDeepWorkBlocks } from '../utils/deepWork.js';
import { generateSessionPDF } from '../utils/pdfReportGenerator.js';

export function SessionReportPage({ reportData: initialReportData, onNewSession, onHome, onNavigate }) {
  const [reportData, setReportData] = useState(initialReportData || {});
  const [activeView, setActiveView] = useState(() => (typeof window !== 'undefined' && window.location.hash === '#replay') ? 'replay' : 'report');
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedRelativeTiming, setSelectedRelativeTiming] = useState(null);
  const [isExported, setIsExported] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [coachPreview, setCoachPreview] = useState(null);

  React.useEffect(() => {
    const handlePop = (e) => {
      if (e.state?.subView === 'replay' || (typeof window !== 'undefined' && window.location.hash === '#replay')) {
        setActiveView('replay');
      } else {
        setActiveView('report');
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  React.useEffect(() => {
    if (initialReportData) {
      setReportData(initialReportData);
    }
  }, [initialReportData]);

  React.useEffect(() => {
    apiFetch('/api/analytics/focus-coach').then(res => {
      if (res && !res.insufficientData) setCoachPreview(res);
    }).catch(() => null);
  }, []);

  if (reportData?.isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
        <p className="text-sm font-medium">Loading session analytics & activity replay...</p>
      </div>
    );
  }

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

  // Download PDF export
  const handleExportPDF = () => {
    setIsPdfExporting(true);
    try {
      generateSessionPDF({
        reportData,
        activitySegments,
        actualSecondsSpent,
        pausedSecondsSpent,
        activity,
        targetMinutes,
        completedAt,
      });
    } catch (err) {
      console.error('[PDF Export] Failed:', err);
    } finally {
      setIsPdfExporting(false);
    }
  };

  // Toggle mock data for dev testing
  const handleLoadMockData = () => {
    const mock = generateMockSessionData();
    setReportData(mock);
  };

  const totalMinutesSpent = Math.max(1, Math.round(totalActiveSeconds / 60));

  const handleBackNavigation = () => {
    try {
      sessionStorage.removeItem('focuslens_active_report_session_id');
    } catch (e) {}

    if (onNavigate) {
      onNavigate('history');
    } else if (onHome) {
      onHome();
    }
  };

  const handleOpenReplay = () => {
    setActiveView('replay');
    try {
      window.history.pushState({ view: 'report', subView: 'replay' }, '', window.location.pathname + '#replay');
    } catch (e) {}
  };

  const handleBackToReport = () => {
    setActiveView('report');
    try {
      if (window.history.state?.subView === 'replay') {
        window.history.back();
        return;
      }
      window.history.replaceState({ view: 'report' }, '', window.location.pathname);
    } catch (e) {}
  };

  if (activeView === 'replay') {
    return (
      <FocusReplayView
        reportData={reportData}
        onBackToReport={handleBackToReport}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Contextual Navigation */}
      <div className="flex items-center justify-between">
        <BackButton
          label="Back to History"
          onClick={handleBackNavigation}
        />
        {onNavigate && (
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.removeItem('focuslens_active_report_session_id'); } catch (e) {}
              onNavigate('dashboard');
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Dashboard
          </button>
        )}
      </div>

      {/* Header Banner */}
      <div className="text-center relative">
        {/* Award Badge Hero Logo (Blue → Teal Gradient with Medal & Star) */}
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-cyan-500/25 border border-white/20"
          aria-hidden="true"
        >
          <svg
            className="w-11 h-11 sm:w-14 sm:h-14 text-white drop-shadow-sm"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left Ribbon Tail */}
            <path
              d="M21.5 36.5 L17 56 L25 50.5 L28.5 40"
              stroke="white"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Right Ribbon Tail */}
            <path
              d="M35.5 40 L39 50.5 L47 56 L42.5 36.5"
              stroke="white"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Circular Medal Medallion Outline */}
            <circle
              cx="32"
              cy="24"
              r="16.5"
              stroke="white"
              strokeWidth="3.2"
              fill="none"
            />
            {/* Center Star */}
            <path
              d="M 32 16.5 L 34.12 21.09 L 39.13 21.68 L 35.42 25.11 L 36.41 30.07 L 32 27.6 L 27.59 30.07 L 28.58 25.11 L 24.87 21.68 L 29.88 21.09 Z"
              fill="white"
            />
          </svg>
        </div>

        <div className="flex items-center justify-center space-x-2 mb-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block">
            Session Completed
          </span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">SESSION REPORT</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
          Derived activity report for <strong>{activity}</strong> completed at {completedAt}.
        </p>

        {/* Action Buttons Header */}
        <div className="flex items-center justify-center space-x-3">
          <button
            type="button"
            onClick={() => setActiveView('replay')}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition-all hover:scale-105"
          >
            <span>Open Focus Replay</span>
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

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleOpenReplay}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-brand-300 font-semibold text-xs transition-colors flex items-center space-x-1.5"
            >
              <span>Focus Replay →</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isPdfExporting}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-md shadow-brand-600/20 flex items-center space-x-2"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isPdfExporting ? 'Generating...' : 'Download PDF Report'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors flex items-center space-x-1.5"
              title="Export raw session data as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExported ? 'Exported!' : 'JSON'}</span>
            </button>
          </div>
        </div>

        {/* Focus Points Earned Highlight Card */}
        {(() => {
          const pointsData = calculateFocusPointsFromDurations(categoryDurations);
          return (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-950/80 via-slate-900 to-slate-950 border border-brand-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/20 transition-all duration-300 hover:shadow-cyan-400/40 shrink-0">
                  <Flame className="w-8 h-8 text-white drop-shadow-sm" strokeWidth={2.2} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider block">Focus Points Earned</span>
                  <span className="text-3xl font-extrabold text-white font-mono">+{pointsData.focusPoints}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Qualifying Focus Time</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {pointsData.qualifyingMinutes} min ({formatSecondsToTime(pointsData.qualifyingSeconds)})
                </span>
              </div>
            </div>
          );
        })()}

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

        {/* Deep Work Section Card */}
        {(() => {
          const deepWork = calculateDeepWorkBlocks(activitySegments, reportData);
          return (
            <div className="p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Deep Work</h3>
                    <p className="text-[11px] text-slate-400">Continuous uninterrupted focused activity</p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {deepWork.deepWorkBlocksCount} {deepWork.deepWorkBlocksCount === 1 ? 'block' : 'blocks'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium block">Longest Block</span>
                  <span className="text-xl font-extrabold text-emerald-400 font-mono block mt-0.5">
                    {deepWork.longestBlockText}
                  </span>
                  {deepWork.longestBlock && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      ({deepWork.longestBlock.timeRangeText})
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium block">Total Deep Work</span>
                  <span className="text-xl font-extrabold text-white font-mono block mt-0.5">
                    {deepWork.totalDeepWorkText}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium block">Number of Blocks</span>
                  <span className="text-xl font-extrabold text-brand-300 font-mono block mt-0.5">
                    {deepWork.deepWorkBlocksCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Next Session Suggestion Card */}
        {coachPreview && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Next Session Suggestion</span>
                <h4 className="text-sm font-bold text-white mt-0.5">{coachPreview.recommendation}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{coachPreview.reason}</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate && onNavigate('coach')}
              className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all shrink-0 self-end sm:self-center"
            >
              <span>View Focus Coach</span>
            </button>
          </div>
        )}

        {/* Goal Performance Section Card */}
        {reportData?.goalText && (
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-brand-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  <BookMarked className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Session Goal Performance</h3>
                  <p className="text-[11px] text-slate-400">Planned goal target vs actual session progress</p>
                </div>
              </div>

              {reportData.goalCompleted ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Goal Completed ✓</span>
                </span>
              ) : (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Partially Completed
                </span>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-medium block">Planned Goal Description</span>
              <p className="text-base font-extrabold text-white bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                {reportData.goalText}
              </p>
            </div>

            {(() => {
              const targetVal = reportData.targetValue || 1;
              const progressVal = reportData.goalProgress || 0;
              const unitLabel = reportData.targetUnit || (reportData.goalType === 'TIME' ? 'min' : 'units');
              const completionPct = Math.min(100, Math.round((progressVal / targetVal) * 100));

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">Goal Progress</span>
                    <span className="text-xl font-extrabold text-brand-300 font-mono block mt-0.5">
                      {progressVal} / {targetVal} {unitLabel}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">Completion Rate</span>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono block mt-0.5">
                      {completionPct}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium block">Status</span>
                    <span className={`text-base font-bold block mt-1 ${reportData.goalCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {reportData.goalCompleted ? 'Goal Completed' : `Progress: ${completionPct}%`}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
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
          onClick={handleBackNavigation}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-900 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to History</span>
        </button>
      </div>
    </div>
  );
}
