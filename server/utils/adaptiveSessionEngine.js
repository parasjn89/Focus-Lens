import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from './analytics.js';

/**
 * Adaptive Session Recommendation Engine
 * Analyzes up to 20 recent completed sessions to generate a personalized focus session recommendation.
 * Requires at least 5 completed sessions before producing a personalized recommendation.
 */
export async function generateAdaptiveSessionRecommendation(userId, options = {}) {
  // Option to pass custom sessions list (for testing)
  let sessionsList = options.sessions;
  if (!sessionsList) {
    sessionsList = await dbStore.getSessionsByUserId(userId, { limit: 2000 });
  }

  // 1. Filter completed sessions sorted by date descending (newest first)
  const completedSessions = (sessionsList || [])
    .filter(s => s && s.status === 'COMPLETED' && (s.actualDurationMs || s.plannedDurationMs) > 0)
    .sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt));

  const totalCompletedCount = completedSessions.length;

  // MINIMUM DATA CHECK: Require at least 5 completed sessions
  if (totalCompletedCount < 5) {
    return {
      available: false,
      reason: 'INSUFFICIENT_HISTORY',
      sessionsCompleted: totalCompletedCount,
      sessionsRequired: 5,
      message: 'Complete a few more sessions and FocusLens will start adapting recommendations to your focus patterns.',
    };
  }

  // DATA WINDOW: Last 20 completed sessions
  const windowSessions = completedSessions.slice(0, 20);

  // 2. Load segments and compute session metrics for each session in window
  const sessionMetrics = [];
  for (const s of windowSessions) {
    let segments = options.sessionSegmentMap ? options.sessionSegmentMap.get(s.id) : null;
    if (!segments) {
      segments = await dbStore.getSegmentsBySessionId(s.id);
    }

    const stats = calculateSessionAnalytics(s, segments || []);
    const plannedSecs = Math.max(60, Math.round((s.plannedDurationMs || 1500000) / 1000));
    const plannedMins = Math.max(1, Math.round(plannedSecs / 60));
    const actualSecs = Math.round((s.actualDurationMs || s.plannedDurationMs || 0) / 1000);
    const qualifyingSecs = stats.qualifyingSeconds || 0;
    const qualifyingMins = Math.round(qualifyingSecs / 60);

    const utilization = Math.min(1, Math.max(0, qualifyingSecs / plannedSecs));
    const longestDeepWorkSec = stats.deepWork?.longestBlockSec || 0;
    const longestDeepWorkMins = Math.round(longestDeepWorkSec / 60);

    const distractionSecs = (stats.durationsInSeconds?.PHONE_ACTIVITY || 0)
      + (stats.durationsInSeconds?.AWAY_OR_NOT_VISIBLE || 0)
      + (stats.durationsInSeconds?.SPEECH_LIKE || 0)
      + (stats.durationsInSeconds?.MULTIPLE_PEOPLE || 0);

    sessionMetrics.push({
      session: s,
      stats,
      plannedMins,
      actualSecs,
      qualifyingSecs,
      qualifyingMins,
      utilization,
      longestDeepWorkSec,
      longestDeepWorkMins,
      distractionSecs,
      distractionMins: Math.round(distractionSecs / 60),
      hasGoal: Boolean(s.goalType && s.goalType !== 'NONE' && s.goalText),
      goalType: s.goalType || 'NONE',
      goalText: s.goalText || null,
      targetValue: s.targetValue || null,
      targetUnit: s.targetUnit || null,
      goalCompleted: Boolean(s.goalCompleted),
      goalProgress: s.goalProgress || 0,
    });
  }

  // 3. Compute baseline metrics and recent norm duration
  const totalPlannedMins = sessionMetrics.reduce((acc, m) => acc + m.plannedMins, 0);
  const recentNormDuration = Math.round(totalPlannedMins / sessionMetrics.length);

  // ADAPTIVE CHANGE LIMIT: Max ±20 minutes from recent norm
  const recentMaxPlanned = Math.max(...sessionMetrics.map(m => m.plannedMins));
  const recentMinPlanned = Math.min(...sessionMetrics.map(m => m.plannedMins));

  // SAFETY BOUNDS: 10 to 90 min (unless user repeatedly used outside bounds)
  const maxAllowed = recentMaxPlanned > 90 ? Math.min(120, recentMaxPlanned) : 90;
  const minAllowed = recentMinPlanned < 10 ? Math.max(5, recentMinPlanned) : 10;

  const adaptiveMinDuration = Math.max(minAllowed, Math.round(recentNormDuration - 20));
  const adaptiveMaxDuration = Math.min(maxAllowed, Math.round(recentNormDuration + 20));

  // 4. Bucketing by standard candidate durations
  const candidateDurations = [15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90];
  const bucketMap = new Map();

  candidateDurations.forEach(d => {
    bucketMap.set(d, {
      targetDuration: d,
      sessions: [],
    });
  });

  // Assign each session to nearest candidate duration
  sessionMetrics.forEach(m => {
    let closestCandidate = candidateDurations[0];
    let minDiff = Math.abs(m.plannedMins - closestCandidate);
    for (const c of candidateDurations) {
      const diff = Math.abs(m.plannedMins - c);
      if (diff < minDiff) {
        minDiff = diff;
        closestCandidate = c;
      }
    }
    bucketMap.get(closestCandidate).sessions.push(m);
  });

  // Calculate bucket statistics
  const bucketStats = [];
  bucketMap.forEach((data, targetDuration) => {
    const sList = data.sessions;
    if (sList.length === 0) return;

    const avgUtil = sList.reduce((acc, m) => acc + m.utilization, 0) / sList.length;
    const avgQualifyingMins = sList.reduce((acc, m) => acc + m.qualifyingMins, 0) / sList.length;
    const avgDistractionMins = sList.reduce((acc, m) => acc + m.distractionMins, 0) / sList.length;

    // Median Deep Work mins
    const dwSorted = [...sList.map(m => m.longestDeepWorkMins)].sort((a, b) => a - b);
    const medianDW = dwSorted[Math.floor(dwSorted.length / 2)] || 0;

    bucketStats.push({
      targetDuration,
      count: sList.length,
      avgUtil,
      avgQualifyingMins,
      avgDistractionMins,
      medianDW,
      inAdaptiveRange: targetDuration >= adaptiveMinDuration && targetDuration <= adaptiveMaxDuration,
    });
  });

  // Sort bucketStats: prioritize those within adaptive range, then by utilization and count
  const validInRange = bucketStats.filter(b => b.inAdaptiveRange);
  const poolToUse = validInRange.length > 0 ? validInRange : bucketStats;

  // 5. Signal Analysis & Candidate Selection
  let recommendedDuration = recentNormDuration;
  let selectedSourcePattern = 'SESSION_LENGTH';
  let selectedReason = `Your recent sessions produce strong focus around ${recentNormDuration} minutes.`;
  let chosenStat = null;

  // SIGNAL 1: Best-performing session length (highest utilization with count >= 2)
  const bestUtilBucket = [...poolToUse]
    .filter(b => b.count >= 2)
    .sort((a, b) => b.avgUtil - a.avgUtil)[0];

  if (bestUtilBucket && bestUtilBucket.avgUtil >= 0.65) {
    recommendedDuration = bestUtilBucket.targetDuration;
    selectedSourcePattern = 'SESSION_LENGTH';
    selectedReason = `Your recent ${bestUtilBucket.targetDuration - 5}–${bestUtilBucket.targetDuration + 5} minute sessions had your highest focus utilization (${Math.round(bestUtilBucket.avgUtil * 100)}%).`;
    chosenStat = bestUtilBucket;
  } else {
    // SIGNAL 2: Deep Work Signal (longest median deep work block)
    const bestDWBucket = [...poolToUse]
      .filter(b => b.medianDW >= 15)
      .sort((a, b) => b.medianDW - a.medianDW)[0];

    if (bestDWBucket) {
      recommendedDuration = bestDWBucket.targetDuration;
      selectedSourcePattern = 'DEEP_WORK';
      selectedReason = `Your longest Deep Work Blocks are usually reached in ${Math.max(15, bestDWBucket.targetDuration - 5)}–${bestDWBucket.targetDuration + 5} minute sessions.`;
      chosenStat = bestDWBucket;
    } else {
      // SIGNAL 3: Distraction Signal (shorter sessions if long sessions have high distractions)
      const lowDistractionBucket = [...poolToUse]
        .filter(b => b.avgDistractionMins <= 3)
        .sort((a, b) => a.avgDistractionMins - b.avgDistractionMins)[0];

      if (lowDistractionBucket && poolToUse.some(b => b.avgDistractionMins > 8)) {
        recommendedDuration = lowDistractionBucket.targetDuration;
        selectedSourcePattern = 'DISTRACTION_PATTERN';
        selectedReason = `Your recent shorter sessions currently produce fewer interruptions.`;
        chosenStat = lowDistractionBucket;
      } else {
        // Fallback: Default to nearest 5 min of recentNormDuration
        const roundedNorm = Math.round(recentNormDuration / 5) * 5 || 25;
        recommendedDuration = roundedNorm;
        chosenStat = poolToUse.sort((a, b) => b.count - a.count)[0] || {
          count: sessionMetrics.length,
          avgQualifyingMins: Math.round(sessionMetrics.reduce((a, b) => a + b.qualifyingMins, 0) / sessionMetrics.length),
          medianDW: 15,
          avgUtil: 0.75,
        };
      }
    }
  }

  // Enforce Adaptive Change Limit & Safety Constraints
  recommendedDuration = Math.min(adaptiveMaxDuration, Math.max(adaptiveMinDuration, recommendedDuration));
  recommendedDuration = Math.round(recommendedDuration / 5) * 5 || 25;

  // 6. Goal Adaptation
  const goalSessions = sessionMetrics.filter(m => m.hasGoal);
  let recGoalType = 'NONE';
  let recGoalText = null;
  let recTargetValue = null;
  let recTargetUnit = null;

  if (goalSessions.length >= 2) {
    const countGoals = goalSessions.filter(m => m.goalType === 'COUNT');
    const timeGoals = goalSessions.filter(m => m.goalType === 'TIME');

    if (countGoals.length >= 1) {
      // Analyze COUNT goal progress
      const completedCountGoals = countGoals.filter(m => m.goalCompleted);
      const avgTarget = Math.round(countGoals.reduce((a, m) => a + (m.targetValue || 0), 0) / countGoals.length);
      const avgProgress = Math.round(countGoals.reduce((a, m) => a + (m.goalProgress || 0), 0) / countGoals.length);

      const targetVal = completedCountGoals.length > 0
        ? Math.min(avgTarget, Math.max(1, avgProgress))
        : Math.max(1, Math.min(3, avgProgress || 2));

      const sampleGoal = countGoals[0];
      const unit = sampleGoal.targetUnit || 'tasks';

      recGoalType = 'COUNT';
      recTargetValue = targetVal;
      recTargetUnit = unit;
      recGoalText = sampleGoal.goalText
        ? sampleGoal.goalText.replace(/\d+/, targetVal)
        : `Complete ${targetVal} ${unit}`;
    } else if (timeGoals.length >= 1) {
      const sampleGoal = timeGoals[0];
      recGoalType = 'TIME';
      recTargetValue = recommendedDuration;
      recTargetUnit = 'minutes';
      recGoalText = sampleGoal.goalText || `Focus for ${recommendedDuration} minutes`;
    }
  }

  // 7. Confidence Calculation
  let confidence = 'MEDIUM';
  if (sessionMetrics.length >= 12 && chosenStat && chosenStat.count >= 3) {
    confidence = 'HIGH';
  } else if (sessionMetrics.length < 8 || (chosenStat && chosenStat.count < 2)) {
    confidence = 'LOW';
  }

  // 8. Evidence Construction
  const evidence = {
    sessionsAnalyzed: sessionMetrics.length,
    typicalFocusedMinutes: Math.round(chosenStat?.avgQualifyingMins || (recommendedDuration * 0.8)),
    typicalLongestBlockMinutes: Math.round(chosenStat?.medianDW || 20),
    focusUtilizationPercent: Math.round((chosenStat?.avgUtil || 0.75) * 100),
  };

  return {
    available: true,
    recommendation: {
      durationMinutes: recommendedDuration,
      goalText: recGoalText,
      goalType: recGoalType,
      targetValue: recTargetValue,
      targetUnit: recTargetUnit,
      reason: selectedReason,
      evidence,
      confidence,
      sourcePattern: selectedSourcePattern,
    },
  };
}
