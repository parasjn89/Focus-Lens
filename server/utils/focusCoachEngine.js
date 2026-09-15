import { calculateSessionAnalytics } from './analytics.js';

/**
 * Deterministic Focus Coach Engine
 * Analyzes up to 14 completed sessions and derived activity segments.
 * Requires a minimum of 3 completed sessions; otherwise returns low-data state.
 */
export function generateFocusCoachAnalysis(sessionsList = [], sessionSegmentMap = new Map()) {
  // 1. Filter completed non-abandoned sessions sorted by startedAt descending
  const completedSessions = sessionsList
    .filter(s => s && s.status === 'COMPLETED' && (s.actualDurationMs || s.plannedDurationMs) > 0)
    .sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt));

  // 2. Window: Last 14 completed sessions
  const windowSessions = completedSessions.slice(0, 14);

  if (windowSessions.length < 3) {
    return {
      insufficientData: true,
      generatedFromSessions: windowSessions.length,
      minimumRequired: 3,
      message: 'Complete a few more sessions and Focus Coach will start giving personalized recommendations.',
    };
  }

  // 3. Precompute metrics per session in the 14-session window
  const sessionMetrics = windowSessions.map(s => {
    const segments = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segments);
    const plannedMins = Math.round((s.plannedDurationMs || 1500000) / 60000);
    const actualSecs = Math.round((s.actualDurationMs || s.plannedDurationMs || 0) / 1000);
    const actualMins = Math.round(actualSecs / 60);
    const qualifyingSecs = stats.qualifyingSeconds || 0;
    const qualifyingMins = Math.round(qualifyingSecs / 60);

    return {
      session: s,
      stats,
      plannedMins,
      actualMins,
      qualifyingMins,
      longestDeepWorkSec: stats.deepWork?.longestBlockSec || 0,
      longestDeepWorkMins: Math.round((stats.deepWork?.longestBlockSec || 0) / 60),
      durationsSec: stats.durationsInSeconds || {},
      percentages: stats.percentages || {},
      hasGoal: Boolean(s.goalType && s.goalType !== 'NONE'),
      goalCompleted: Boolean(s.goalCompleted),
      goalType: s.goalType,
      goalText: s.goalText,
      targetValue: s.targetValue,
      targetUnit: s.targetUnit,
    };
  });

  const totalSessions = sessionMetrics.length;

  // Aggregate totals
  let totalPlannedMins = 0;
  let totalQualifyingMins = 0;
  let phoneSessionsCount = 0;
  let awaySessionsCount = 0;
  let screenDistractionCount = 0;
  let speechSessionsCount = 0;
  let multiplePeopleCount = 0;

  const deepWorkBlocks = [];
  const recentGoalSessions = [];

  sessionMetrics.forEach(m => {
    totalPlannedMins += m.plannedMins;
    totalQualifyingMins += m.qualifyingMins;

    if ((m.durationsSec.PHONE_ACTIVITY || 0) > 30) phoneSessionsCount++;
    if ((m.durationsSec.AWAY_OR_NOT_VISIBLE || 0) > 60) awaySessionsCount++;
    if ((m.durationsSec.UNKNOWN || 0) > 120) screenDistractionCount++;
    if ((m.durationsSec.SPEECH_LIKE || 0) > 30) speechSessionsCount++;

    const segments = sessionSegmentMap.get(m.session.id) || [];
    if (
      (m.stats.insights?.distractions || []).some(d => d.type === 'MULTIPLE_PEOPLE' || d.type === 'MULTIPLE_PEOPLE_PRESENT') ||
      segments.some(seg =>
        (seg.contributingSignals || []).some(s => typeof s === 'string' && s.includes('MULTIPLE_PEOPLE')) ||
        (seg.explanation && JSON.stringify(seg.explanation).includes('MULTIPLE_PEOPLE'))
      )
    ) {
      multiplePeopleCount++;
    }

    if (m.longestDeepWorkMins > 0) {
      deepWorkBlocks.push(m.longestDeepWorkMins);
    }

    if (m.hasGoal) {
      recentGoalSessions.push(m);
    }
  });

  const avgPlannedMins = Math.round(totalPlannedMins / totalSessions);
  const avgQualifyingMins = Math.round(totalQualifyingMins / totalSessions);

  // Candidate Recommendations Array
  const candidates = [];

  // ----------------------------------------------------
  // RULE 1: SESSION LENGTH MISMATCH
  // ----------------------------------------------------
  if (avgPlannedMins >= 35 && avgPlannedMins - avgQualifyingMins >= 10) {
    const recommendedMins = Math.max(15, Math.min(60, Math.round(avgQualifyingMins + 5)));
    candidates.push({
      category: 'SESSION_LENGTH',
      priority: 6,
      confidence: 'HIGH',
      observation: `Your recent sessions averaged ${avgPlannedMins} minutes planned, but yielded ${avgQualifyingMins} minutes of focused time.`,
      recommendation: `Try a shorter ${recommendedMins}-minute session today.`,
      reason: `Your recent sessions tend to produce their strongest focus in shorter blocks.`,
      suggestedSession: {
        durationMinutes: recommendedMins,
        goalType: 'TIME',
        goalText: `Focus for ${recommendedMins} minutes`,
        targetValue: recommendedMins,
        targetUnit: 'minutes',
      },
    });
  }

  // ----------------------------------------------------
  // RULE 2: DEEP WORK BLOCKS
  // ----------------------------------------------------
  if (deepWorkBlocks.length >= 3) {
    const sortedDW = [...deepWorkBlocks].sort((a, b) => a - b);
    const medianDW = sortedDW[Math.floor(sortedDW.length / 2)];
    if (medianDW >= 15 && medianDW <= 45) {
      const dwTarget = Math.min(60, Math.round(medianDW / 5) * 5 || 25);
      candidates.push({
        category: 'DEEP_WORK',
        priority: 10,
        confidence: 'MEDIUM',
        observation: `Your longest Deep Work Blocks usually peak between ${Math.max(10, dwTarget - 5)} and ${dwTarget + 5} minutes.`,
        recommendation: `A ${dwTarget}-minute focused target may fit your current pattern.`,
        reason: `Based on your recent sessions, continuous peak focus is maintained within this window.`,
        suggestedSession: {
          durationMinutes: dwTarget,
          goalType: 'TIME',
          goalText: `Deep Work block of ${dwTarget} minutes`,
          targetValue: dwTarget,
          targetUnit: 'minutes',
        },
      });
    }
  }

  // ----------------------------------------------------
  // RULE 3: PHONE DISTRACTIONS
  // ----------------------------------------------------
  if (phoneSessionsCount >= Math.ceil(totalSessions * 0.3) || phoneSessionsCount >= 3) {
    candidates.push({
      category: 'PHONE_DISTRACTION',
      priority: 1,
      confidence: 'HIGH',
      observation: `Phone activity was detected in ${phoneSessionsCount} of your last ${totalSessions} sessions.`,
      recommendation: `Keep your phone out of reach during your next session.`,
      reason: `Phone activity has been your most frequent interruption recently.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'NONE',
        goalText: null,
        targetValue: null,
        targetUnit: null,
      },
    });
  }

  // ----------------------------------------------------
  // RULE 4: LOOKING AWAY
  // ----------------------------------------------------
  if (awaySessionsCount >= Math.ceil(totalSessions * 0.35) || awaySessionsCount >= 3) {
    candidates.push({
      category: 'LOOKING_AWAY',
      priority: 3,
      confidence: 'MEDIUM',
      observation: `Looking-away events appeared in ${awaySessionsCount} of your last ${totalSessions} sessions.`,
      recommendation: `Try a simpler workspace with fewer visual distractions.`,
      reason: `Looking-away events have appeared frequently in your recent sessions.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'NONE',
        goalText: null,
        targetValue: null,
        targetUnit: null,
      },
    });
  }

  // ----------------------------------------------------
  // RULE 5: NON-STUDY SCREEN ACTIVITY
  // ----------------------------------------------------
  if (screenDistractionCount >= Math.ceil(totalSessions * 0.35) || screenDistractionCount >= 3) {
    candidates.push({
      category: 'NON_STUDY_SCREEN',
      priority: 4,
      confidence: 'MEDIUM',
      observation: `Unclassified or non-study screen activity occurred in ${screenDistractionCount} of your last ${totalSessions} sessions.`,
      recommendation: `Define the exact screen task before starting your next session.`,
      reason: `Writing the specific task you'll complete before starting keeps screen focus high.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'COUNT',
        goalText: 'Complete 1 target task',
        targetValue: 1,
        targetUnit: 'task',
      },
    });
  }

  // ----------------------------------------------------
  // RULE 6: SPEECH-LIKE ACTIVITY
  // ----------------------------------------------------
  if (speechSessionsCount >= Math.ceil(totalSessions * 0.3) || speechSessionsCount >= 3) {
    candidates.push({
      category: 'SPEECH_LIKE',
      priority: 5,
      confidence: 'MEDIUM',
      observation: `Speech-like activity was detected during ${speechSessionsCount} of your last ${totalSessions} sessions.`,
      recommendation: `Try a quieter environment for your next session.`,
      reason: `Background speech signals were detected during several recent sessions.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'NONE',
        goalText: null,
        targetValue: null,
        targetUnit: null,
      },
    });
  }

  // ----------------------------------------------------
  // RULE 7: MULTIPLE PEOPLE
  // ----------------------------------------------------
  if (multiplePeopleCount >= Math.ceil(totalSessions * 0.25) || multiplePeopleCount >= 2) {
    candidates.push({
      category: 'MULTIPLE_PEOPLE',
      priority: 2,
      confidence: 'HIGH',
      observation: `Multiple-person events appeared in ${multiplePeopleCount} of your last ${totalSessions} sessions.`,
      recommendation: `Try a quieter or more private workspace for your next focus block.`,
      reason: `Multiple-person events appeared repeatedly in recent sessions.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'NONE',
        goalText: null,
        targetValue: null,
        targetUnit: null,
      },
    });
  }

  // ----------------------------------------------------
  // RULE 8 & 9: GOAL COMPLETION / SUCCESS
  // ----------------------------------------------------
  if (recentGoalSessions.length >= 2) {
    const completedGoals = recentGoalSessions.filter(g => g.goalCompleted).length;
    const goalCompRate = Math.round((completedGoals / recentGoalSessions.length) * 100);

    if (goalCompRate < 60 && avgQualifyingMins >= 20) {
      candidates.push({
        category: 'GOAL_COMPLETION',
        priority: 8,
        confidence: 'HIGH',
        observation: `Your goal completion rate is ${goalCompRate}%, despite high overall focused time (${avgQualifyingMins} mins/session).`,
        recommendation: `Make session goals smaller and more specific.`,
        reason: `Setting smaller, specific targets (e.g., 'Solve 2 problems' instead of 'Study DSA') leads to higher completion rates.`,
        suggestedSession: {
          durationMinutes: Math.min(30, avgPlannedMins || 25),
          goalType: 'COUNT',
          goalText: 'Solve 2 practice questions',
          targetValue: 2,
          targetUnit: 'questions',
        },
      });
    } else if (goalCompRate >= 80) {
      candidates.push({
        category: 'GOAL_SUCCESS',
        priority: 11,
        confidence: 'HIGH',
        observation: `Your recent goal completion rate is strong at ${goalCompRate}%.`,
        recommendation: `Keep using specific session goals for your focus blocks.`,
        reason: `Your current strategy of setting defined session goals is working effectively.`,
        suggestedSession: {
          durationMinutes: avgPlannedMins || 25,
          goalType: 'COUNT',
          goalText: recentGoalSessions[0]?.goalText || 'Complete target task',
          targetValue: recentGoalSessions[0]?.targetValue || 2,
          targetUnit: recentGoalSessions[0]?.targetUnit || 'tasks',
        },
      });
    }
  }

  // ----------------------------------------------------
  // RULE 10: DISTRACTION TREND
  // ----------------------------------------------------
  if (totalSessions >= 4) {
    const half = Math.floor(totalSessions / 2);
    const recentHalf = sessionMetrics.slice(0, half);
    const olderHalf = sessionMetrics.slice(half);

    const recentDistractionSec = recentHalf.reduce((acc, m) => acc + (m.actualMins * 60 - m.qualifyingMins * 60), 0);
    const olderDistractionSec = olderHalf.reduce((acc, m) => acc + (m.actualMins * 60 - m.qualifyingMins * 60), 0);

    const diffMins = Math.round((recentDistractionSec - olderDistractionSec) / 60);

    if (diffMins >= 5) {
      candidates.push({
        category: 'DISTRACTION_TREND',
        priority: 9,
        confidence: 'MEDIUM',
        observation: `Your total distraction time increased by ${diffMins} minutes compared to prior sessions.`,
        recommendation: `Try reducing the number of things around you that can interrupt the session.`,
        reason: `Tracked distraction time has increased compared with the previous period.`,
        suggestedSession: {
          durationMinutes: Math.min(30, avgPlannedMins || 25),
          goalType: 'TIME',
          goalText: 'Undistracted 25 min block',
          targetValue: 25,
          targetUnit: 'minutes',
        },
      });
    } else if (diffMins <= -5) {
      candidates.push({
        category: 'DISTRACTION_TREND',
        priority: 9,
        confidence: 'MEDIUM',
        observation: `You've been experiencing fewer interruptions recently.`,
        recommendation: `Keep the same setup and session structure.`,
        reason: `Tracked distraction duration is lower compared to your earlier sessions.`,
        suggestedSession: {
          durationMinutes: avgPlannedMins || 25,
          goalType: 'NONE',
          goalText: null,
          targetValue: null,
          targetUnit: null,
        },
      });
    }
  }

  // ----------------------------------------------------
  // RULE 11: LONG SESSION FATIGUE SIGNAL
  // ----------------------------------------------------
  const longSessions = sessionMetrics.filter(m => m.plannedMins > 45);
  const shortSessions = sessionMetrics.filter(m => m.plannedMins <= 45);

  if (longSessions.length >= 2 && shortSessions.length >= 2) {
    const longAvgFocus = Math.round(longSessions.reduce((acc, m) => acc + m.qualifyingMins, 0) / longSessions.length);
    const shortAvgFocus = Math.round(shortSessions.reduce((acc, m) => acc + m.qualifyingMins, 0) / shortSessions.length);

    if (shortAvgFocus > longAvgFocus + 5) {
      candidates.push({
        category: 'LONG_SESSION_FATIGUE',
        priority: 7,
        confidence: 'HIGH',
        observation: `Sessions of 45 minutes or less averaged ${shortAvgFocus} minutes of focused time, compared with ${longAvgFocus} minutes in longer sessions.`,
        recommendation: `Shorter sessions currently appear to give you more focused time.`,
        reason: `Shorter focus blocks match your current peak productivity window.`,
        suggestedSession: {
          durationMinutes: 30,
          goalType: 'TIME',
          goalText: 'Focused 30 minutes',
          targetValue: 30,
          targetUnit: 'minutes',
        },
      });
    }
  }

  // ----------------------------------------------------
  // RULE 12: CONSISTENCY
  // ----------------------------------------------------
  if (totalSessions >= 3) {
    const dates = sessionMetrics.map(m => new Date(m.session.startedAt || m.session.createdAt)).sort((a, b) => a - b);
    let totalGapsMs = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGapsMs += dates[i] - dates[i - 1];
    }
    const avgGapDays = totalGapsMs / (dates.length - 1) / (1000 * 60 * 60 * 24);

    if (avgGapDays <= 1.5) {
      candidates.push({
        category: 'CONSISTENCY',
        priority: 12,
        confidence: 'LOW',
        observation: `You've been maintaining a regular focus routine.`,
        recommendation: `Keep the same session cadence.`,
        reason: `Consistent session frequency helps build lasting deep work habits.`,
        suggestedSession: {
          durationMinutes: avgPlannedMins || 25,
          goalType: 'NONE',
          goalText: null,
          targetValue: null,
          targetUnit: null,
        },
      });
    } else if (avgGapDays > 3) {
      candidates.push({
        category: 'CONSISTENCY',
        priority: 12,
        confidence: 'LOW',
        observation: `Your recent sessions are spaced irregularly (avg ${Math.round(avgGapDays)} days apart).`,
        recommendation: `Try scheduling one consistent focus block each day.`,
        reason: `Regular daily focus blocks build steady momentum over time.`,
        suggestedSession: {
          durationMinutes: 25,
          goalType: 'NONE',
          goalText: null,
          targetValue: null,
          targetUnit: null,
        },
      });
    }
  }

  // Fallback default recommendation if no candidate rule triggered
  if (candidates.length === 0) {
    candidates.push({
      category: 'GENERAL_FOCUS',
      priority: 99,
      confidence: 'MEDIUM',
      observation: `Your recent sessions average ${avgPlannedMins} minutes planned and ${avgQualifyingMins} minutes of focused time.`,
      recommendation: `Target a steady ${avgPlannedMins || 25}-minute session today.`,
      reason: `Consistent focus blocks help maintain steady deep work momentum.`,
      suggestedSession: {
        durationMinutes: avgPlannedMins || 25,
        goalType: 'NONE',
        goalText: null,
        targetValue: null,
        targetUnit: null,
      },
    });
  }

  // Sort candidates by priority ascending (lower priority number = higher urgency)
  candidates.sort((a, b) => a.priority - b.priority);

  const primary = candidates[0];
  const secondary = candidates.length > 1 ? candidates[1] : null;

  return {
    insufficientData: false,
    generatedFromSessions: totalSessions,
    primary,
    secondary: secondary ? {
      observation: secondary.observation,
      recommendation: secondary.recommendation,
      reason: secondary.reason,
      category: secondary.category,
    } : null,
    suggestedSession: primary.suggestedSession,
  };
}
