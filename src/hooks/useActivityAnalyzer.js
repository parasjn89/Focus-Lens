import { useState, useEffect, useRef } from 'react';
import { createActivityTracker, classifyMultimodalActivity, ACTIVITY_TYPES, ACTIVITY_LABELS, mergeActivitySegments } from '../services/activityAnalyzer';

/**
 * Custom React hook for live multimodal activity classification and segment tracking.
 * 
 * @param {Object} params
 * @param {boolean} params.isCameraActive
 * @param {boolean} params.isFacePresent
 * @param {boolean} params.isPhonePresent
 * @param {number} params.personCount
 * @param {string} params.headOrientation
 * @param {boolean} params.isScreenActive
 * @param {string} params.screenActivity
 * @param {number | null} params.screenConfidence
 * @param {string} params.screenSourceType
 * @param {Function} [params.onActivityChanged]
 */
export function useActivityAnalyzer({
  isCameraActive = false,
  isFacePresent = false,
  isPhonePresent = false,
  personCount = 0,
  rawPersonCount = 0,
  personOnPhoneCount = 0,
  isPersonOnPhoneScreen = false,
  headOrientation = 'UNKNOWN',
  isScreenActive = false,
  screenActivity = 'UNKNOWN',
  screenConfidence = null,
  screenSourceType = 'unknown',
  onActivityChanged = null,
}) {
  const [currentActivity, setCurrentActivity] = useState(ACTIVITY_TYPES.UNKNOWN);
  const [activitySegments, setActivitySegments] = useState([]);
  const [contributingSignals, setContributingSignals] = useState([]);
  const [explanation, setExplanation] = useState([]);
  const [evidenceScore, setEvidenceScore] = useState(null);

  const trackerRef = useRef(null);

  if (!trackerRef.current) {
    trackerRef.current = createActivityTracker({
      minimumActivityDurationMs: 1500,
      onSegmentCompleted: (seg) => {
        setActivitySegments((prev) => mergeActivitySegments([...prev, seg]));
      },
    });
  }

  const currentActivityRef = useRef(currentActivity);
  useEffect(() => {
    currentActivityRef.current = currentActivity;
  }, [currentActivity]);

  const onActivityChangedRef = useRef(onActivityChanged);
  useEffect(() => {
    onActivityChangedRef.current = onActivityChanged;
  }, [onActivityChanged]);

  // Update activity tracker whenever camera or screen input signals change
  useEffect(() => {
    if (trackerRef.current) {
      const cameraSignals = {
        isCameraActive,
        isFacePresent,
        isPhonePresent,
        personCount,
        rawPersonCount,
        personOnPhoneCount,
        isPersonOnPhoneScreen,
        headOrientation,
      };

      const screenSignals = {
        isScreenActive,
        screenActivity,
        screenConfidence,
        sourceType: screenSourceType,
      };

      const classification = classifyMultimodalActivity(cameraSignals, screenSignals);
      setContributingSignals(classification.contributingSignals);
      setExplanation(classification.explanation || []);
      setEvidenceScore(classification.evidenceScore);

      const res = trackerRef.current.updateMultimodalSignals(cameraSignals, screenSignals);
      
      if (res.currentActivity !== currentActivityRef.current) {
        setCurrentActivity(res.currentActivity);
        if (onActivityChangedRef.current) {
          onActivityChangedRef.current(res.currentActivity, res.activeSegment);
        }
      }

      const activeSeg = res.activeSegment;
      const completed = res.completedSegments;
      const nextSegments = activeSeg ? mergeActivitySegments([...completed, activeSeg]) : mergeActivitySegments(completed);

      setActivitySegments((prev) => {
        if (prev.length !== nextSegments.length) return nextSegments;
        if (prev.length > 0 && nextSegments.length > 0) {
          const lastPrev = prev[prev.length - 1];
          const lastNext = nextSegments[nextSegments.length - 1];
          if (lastPrev.type !== lastNext.type || Math.abs(lastPrev.endTime - lastNext.endTime) > 500) {
            return nextSegments;
          }
          return prev;
        }
        return nextSegments;
      });
    }
  }, [
    isCameraActive, isFacePresent, isPhonePresent, personCount, rawPersonCount, personOnPhoneCount, isPersonOnPhoneScreen, headOrientation,
    isScreenActive, screenActivity, screenConfidence, screenSourceType
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        trackerRef.current.reset();
      }
    };
  }, []);

  return {
    currentActivity,
    activityLabel: ACTIVITY_LABELS[currentActivity] || currentActivity,
    activitySegments,
    contributingSignals,
    explanation,
    evidenceScore,
  };
}
