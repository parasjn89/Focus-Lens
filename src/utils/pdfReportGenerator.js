import { jsPDF } from 'jspdf';
import { ACTIVITY_LABELS } from '../services/activityAnalyzer.js';
import { formatSecondsToTime, formatMinutesText } from './formatters.js';
import { calculateFocusPointsFromDurations } from './focusPoints.js';
import { calculateDeepWorkBlocks } from './deepWork.js';
import {
  calculateActivityDurations,
  calculateActivityPercentages,
  countActivitySegments,
  mergeAdjacentSegments,
  generateSessionInsights,
} from './sessionAnalytics.js';

// ── Brand palette (RGB) ──────────────────────────────────────────────────────
const BRAND = { r: 99, g: 102, b: 241 };   // #6366f1 indigo-500
const EMERALD = { r: 52, g: 211, b: 153 }; // #34d399 emerald-400
const DARK = { r: 30, g: 41, b: 59 };      // #1e293b slate-800
const TEXT = { r: 51, g: 65, b: 85 };       // #334155 slate-700
const MUTED = { r: 100, g: 116, b: 139 };  // #64748b slate-500
const WHITE = { r: 255, g: 255, b: 255 };

// Chart bar colors per category (RGB)
const CHART_COLORS = {
  CODING:              { r: 99, g: 102, b: 241 },  // indigo
  STUDY_LIKE:          { r: 52, g: 211, b: 153 },  // emerald
  PHONE_ACTIVITY:      { r: 251, g: 146, b: 60 },  // orange
  MULTIPLE_PEOPLE:     { r: 129, g: 140, b: 248 }, // indigo-light
  AWAY_OR_NOT_VISIBLE: { r: 148, g: 163, b: 184 }, // slate
  VIDEO_ACTIVITY:      { r: 244, g: 114, b: 182 }, // pink
  BROWSER_ACTIVITY:    { r: 56, g: 189, b: 248 },  // sky
  DOCUMENT_ACTIVITY:   { r: 45, g: 212, b: 191 },  // teal
  SPEECH_LIKE:         { r: 251, g: 191, b: 36 },  // amber
  UNKNOWN:             { r: 148, g: 163, b: 184 }, // slate
};

// ── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W = 210;   // A4 width (mm)
const PAGE_H = 297;   // A4 height (mm)
const M_LEFT = 20;
const M_RIGHT = 20;
const M_TOP = 20;
const M_BOTTOM = 25;
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT;
const MAX_Y = PAGE_H - M_BOTTOM;

// ── Helper: ensure we don't overflow the page ────────────────────────────────
function ensureSpace(doc, y, needed) {
  if (y + needed > MAX_Y) {
    doc.addPage();
    return M_TOP;
  }
  return y;
}

// ── Section header ───────────────────────────────────────────────────────────
function drawSectionHeader(doc, y, title) {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text(title.toUpperCase(), M_LEFT, y);
  y += 1.5;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.6);
  doc.line(M_LEFT, y, M_LEFT + CONTENT_W, y);
  return y + 6;
}

// ── Key-value row ────────────────────────────────────────────────────────────
function drawKVRow(doc, y, label, value) {
  y = ensureSpace(doc, y, 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(label, M_LEFT, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(String(value), M_LEFT + 60, y);
  return y + 5.5;
}

// ── Horizontal bar with label ────────────────────────────────────────────────
function drawBar(doc, y, label, pct, durationText, color, maxBarW) {
  y = ensureSpace(doc, y, 9);
  const barH = 5;
  const labelColW = 48;
  const pctColW = 14;
  const durColW = 22;
  const barX = M_LEFT + labelColW;
  const barW = Math.max(1, (pct / 100) * maxBarW);

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(label, M_LEFT, y + 3.5);

  // Bar background
  doc.setFillColor(240, 240, 245);
  doc.roundedRect(barX, y, maxBarW, barH, 1, 1, 'F');

  // Bar fill
  doc.setFillColor(color.r, color.g, color.b);
  if (barW > 2) {
    doc.roundedRect(barX, y, barW, barH, 1, 1, 'F');
  } else if (barW > 0) {
    doc.rect(barX, y, barW, barH, 'F');
  }

  // Percentage
  const pctX = barX + maxBarW + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(`${pct}%`, pctX, y + 3.5);

  // Duration
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(durationText, pctX + pctColW, y + 3.5);

  return y + barH + 3;
}

/**
 * Generates a FocusLens Session Report PDF and triggers browser download.
 *
 * @param {Object} params
 * @param {Object} params.reportData       - Raw report data from session
 * @param {Array}  params.activitySegments - Raw activity segment array
 * @param {number} params.actualSecondsSpent
 * @param {number} params.pausedSecondsSpent
 * @param {string} params.activity         - Selected activity name
 * @param {number} params.targetMinutes    - Planned duration in minutes
 * @param {string} params.completedAt      - Completion time string
 */
export function generateSessionPDF({
  reportData = {},
  activitySegments = [],
  actualSecondsSpent = 0,
  pausedSecondsSpent = 0,
  activity = 'Focus Session',
  targetMinutes = 25,
  completedAt = '',
}) {
  // ── Compute analytics from the same corrected pipeline as the UI ──────────
  const mergedSegments = mergeAdjacentSegments(activitySegments);
  const totalActiveSeconds = Math.max(0, actualSecondsSpent);
  const categoryDurations = calculateActivityDurations(mergedSegments);
  const categoryPercentages = calculateActivityPercentages(categoryDurations, totalActiveSeconds);
  const categorySegmentCounts = countActivitySegments(mergedSegments);
  const insights = generateSessionInsights(mergedSegments, totalActiveSeconds);
  const pointsData = calculateFocusPointsFromDurations(categoryDurations);
  const deepWork = calculateDeepWorkBlocks(activitySegments, reportData);
  const totalMinutesSpent = Math.max(0, Math.round(totalActiveSeconds / 60));

  const activeCategories = Object.keys(categoryDurations).filter(
    (key) => (categoryDurations[key] || 0) > 0
  );

  // ── Create PDF document ───────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = M_TOP;

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER / BRANDING
  // ═══════════════════════════════════════════════════════════════════════════
  // Brand accent bar at very top
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, 4, 'F');

  y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text('FocusLens', M_LEFT, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('SESSION REPORT', M_LEFT + 55, y);

  // Date/time on the right
  const sessionDate = new Date();
  const dateStr = sessionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = completedAt || sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`${dateStr}  •  ${timeStr}`, PAGE_W - M_RIGHT, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(M_LEFT, y, PAGE_W - M_RIGHT, y);

  y += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  y = drawSectionHeader(doc, y, 'Session Overview');

  y = drawKVRow(doc, y, 'Selected Activity', activity);
  y = drawKVRow(doc, y, 'Planned Duration', `${targetMinutes} min`);
  y = drawKVRow(doc, y, 'Actual Duration', `${totalMinutesSpent} min (${formatSecondsToTime(totalActiveSeconds)})`);
  y = drawKVRow(doc, y, 'Paused Duration', `${Math.round(pausedSecondsSpent / 60)} min`);
  y = drawKVRow(doc, y, 'Completed At', timeStr);

  y += 4;

  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS POINTS
  // ═══════════════════════════════════════════════════════════════════════════
  y = drawSectionHeader(doc, y, 'Focus Points');

  y = drawKVRow(doc, y, 'Focus Points Earned', `+${pointsData.focusPoints}`);
  y = drawKVRow(doc, y, 'Qualifying Focus Time', `${pointsData.qualifyingMinutes} min (${formatSecondsToTime(pointsData.qualifyingSeconds)})`);

  y += 4;

  // ═══════════════════════════════════════════════════════════════════════════
  // GOAL PERFORMANCE (conditional)
  // ═══════════════════════════════════════════════════════════════════════════
  if (reportData.goalText) {
    y = drawSectionHeader(doc, y, 'Goal Performance');

    y = drawKVRow(doc, y, 'Goal', reportData.goalText);

    const targetVal = reportData.targetValue || 1;
    const progressVal = reportData.goalProgress || 0;
    const unitLabel = reportData.targetUnit || (reportData.goalType === 'TIME' ? 'min' : 'units');
    const completionPct = Math.min(100, Math.round((progressVal / targetVal) * 100));

    y = drawKVRow(doc, y, 'Progress', `${progressVal} / ${targetVal} ${unitLabel}`);
    y = drawKVRow(doc, y, 'Completion Rate', `${completionPct}%`);
    y = drawKVRow(doc, y, 'Status', reportData.goalCompleted ? 'Goal Completed ✓' : `In Progress (${completionPct}%)`);

    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEEP WORK
  // ═══════════════════════════════════════════════════════════════════════════
  y = drawSectionHeader(doc, y, 'Deep Work');

  y = drawKVRow(doc, y, 'Longest Block', deepWork.longestBlockText || 'N/A');
  y = drawKVRow(doc, y, 'Total Deep Work', deepWork.totalDeepWorkText || '0m 0s');
  y = drawKVRow(doc, y, 'Number of Blocks', String(deepWork.deepWorkBlocksCount || 0));

  if (deepWork.longestBlock && deepWork.longestBlock.timeRangeText) {
    y = drawKVRow(doc, y, 'Longest Block Range', deepWork.longestBlock.timeRangeText);
  }

  y += 4;

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITY DURATION BREAKDOWN (chart + table)
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeCategories.length > 0) {
    y = drawSectionHeader(doc, y, 'Activity Duration Breakdown');

    const maxBarW = CONTENT_W - 48 - 14 - 22 - 6; // labelCol + pctCol + durCol + padding

    activeCategories
      .sort((a, b) => (categoryDurations[b] || 0) - (categoryDurations[a] || 0))
      .forEach((type) => {
        const label = ACTIVITY_LABELS[type] || type;
        const pct = categoryPercentages[type] || 0;
        const durSec = categoryDurations[type] || 0;
        const color = CHART_COLORS[type] || CHART_COLORS.UNKNOWN;
        y = drawBar(doc, y, label, pct, formatSecondsToTime(durSec), color, maxBarW);
      });

    // Percentage total verification note
    const sumPct = activeCategories.reduce((acc, k) => acc + (categoryPercentages[k] || 0), 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    y = ensureSpace(doc, y, 5);
    doc.text(`Percentage total: ${sumPct}% (based on displayed activity durations; rounding may cause ±1% deviation)`, M_LEFT, y);

    y += 7;
  } else {
    y = drawSectionHeader(doc, y, 'Activity Duration Breakdown');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    y = ensureSpace(doc, y, 6);
    doc.text('No activity data was recorded for this session.', M_LEFT, y);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION INSIGHTS
  // ═══════════════════════════════════════════════════════════════════════════
  if (mergedSegments.length > 0) {
    y = drawSectionHeader(doc, y, 'Session Insights');

    y = drawKVRow(doc, y, 'Longest Study Streak', `${Math.round(insights.longestStudyStreakSec / 60)} min (${formatSecondsToTime(insights.longestStudyStreakSec)})`);

    if (insights.totalPhoneSec > 0 || insights.phoneEventCount > 0) {
      y = drawKVRow(doc, y, 'Phone Interference', `${Math.round(insights.totalPhoneSec / 60)} min — ${insights.phoneEventCount} event${insights.phoneEventCount === 1 ? '' : 's'}`);
    }

    if (insights.totalMultiplePeopleSec > 0 || insights.multiplePeopleEventCount > 0) {
      y = drawKVRow(doc, y, 'Multiple People', `${Math.round(insights.totalMultiplePeopleSec / 60)} min — ${insights.multiplePeopleEventCount} event${insights.multiplePeopleEventCount === 1 ? '' : 's'}`);
    }

    y = drawKVRow(doc, y, 'Activity Transitions', `${insights.transitionCount} context switches`);

    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS REPLAY SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  if (mergedSegments.length > 0) {
    y = drawSectionHeader(doc, y, 'Focus Replay Summary');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    y = ensureSpace(doc, y, 6);
    doc.text(`Total activity segments recorded: ${mergedSegments.length}`, M_LEFT, y);
    y += 5;

    // Show top-5 segments by duration
    const topSegments = [...mergedSegments]
      .sort((a, b) => {
        const dA = a.durationMs || ((a.endTime || 0) - (a.startTime || 0));
        const dB = b.durationMs || ((b.endTime || 0) - (b.startTime || 0));
        return dB - dA;
      })
      .slice(0, 5);

    if (topSegments.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      y = ensureSpace(doc, y, 5);
      doc.text('Top segments by duration:', M_LEFT, y);
      y += 4;

      topSegments.forEach((seg, idx) => {
        const dMs = seg.durationMs || ((seg.endTime || 0) - (seg.startTime || 0));
        const dSec = Math.max(0, Math.round(dMs / 1000));
        const label = ACTIVITY_LABELS[seg.type] || seg.type || 'Unknown';
        y = ensureSpace(doc, y, 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
        doc.text(`${idx + 1}. ${label} — ${formatSecondsToTime(dSec)}`, M_LEFT + 4, y);
        y += 4;
      });
    }

    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL / REFLECTION (conditional)
  // ═══════════════════════════════════════════════════════════════════════════
  const hasJournal = reportData.intention || reportData.reflection || reportData.journalEntry;

  if (hasJournal) {
    y = drawSectionHeader(doc, y, 'Journal & Reflection');

    if (reportData.intention) {
      y = ensureSpace(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
      doc.text('Pre-Session Intention:', M_LEFT, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const intentionLines = doc.splitTextToSize(reportData.intention, CONTENT_W - 4);
      intentionLines.forEach((line) => {
        y = ensureSpace(doc, y, 4.5);
        doc.text(line, M_LEFT + 2, y);
        y += 4;
      });
      y += 2;
    }

    if (reportData.reflection) {
      y = ensureSpace(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
      doc.text('Post-Session Reflection:', M_LEFT, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const reflectionLines = doc.splitTextToSize(reportData.reflection, CONTENT_W - 4);
      reflectionLines.forEach((line) => {
        y = ensureSpace(doc, y, 4.5);
        doc.text(line, M_LEFT + 2, y);
        y += 4;
      });
      y += 2;
    }

    if (reportData.journalEntry) {
      y = ensureSpace(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
      doc.text('Journal Entry:', M_LEFT, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const journalLines = doc.splitTextToSize(reportData.journalEntry, CONTENT_W - 4);
      journalLines.forEach((line) => {
        y = ensureSpace(doc, y, 4.5);
        doc.text(line, M_LEFT + 2, y);
        y += 4;
      });
      y += 2;
    }

    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY NOTICE (footer)
  // ═══════════════════════════════════════════════════════════════════════════
  y = ensureSpace(doc, y, 18);
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(M_LEFT, y, PAGE_W - M_RIGHT, y);
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const privacyText = 'Privacy Notice: This report was generated from locally processed activity signals. '
    + 'No raw camera video, microphone audio, or screen recording data is included in or uploaded with this document.';
  const privacyLines = doc.splitTextToSize(privacyText, CONTENT_W);
  privacyLines.forEach((line) => {
    y = ensureSpace(doc, y, 4);
    doc.text(line, M_LEFT, y);
    y += 3.5;
  });

  y += 2;
  doc.setFontSize(6.5);
  doc.text(`Generated by FocusLens • ${new Date().toISOString()}`, M_LEFT, y);

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `FocusLens-Session-${yyyy}-${mm}-${dd}.pdf`;

  doc.save(filename);
  return filename;
}

/**
 * Builds the PDF filename for a given date. Exported for testing.
 * @param {Date} [date] 
 * @returns {string}
 */
export function buildPdfFilename(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `FocusLens-Session-${yyyy}-${mm}-${dd}.pdf`;
}
