import { useState, useRef, useEffect, useCallback } from 'react';
import { createScreenObservation, getSourceTypeFromTrack, SCREEN_SOURCE_TYPES } from '../services/screenObserver';

/**
 * Custom React hook to safely manage browser screen sharing streams via navigator.mediaDevices.getDisplayMedia().
 */
export function useScreenShare({ initialStream = null } = {}) {
  const [stream, setStream] = useState(initialStream);
  const [isScreenActive, setIsScreenActive] = useState(!!(initialStream && initialStream.active));
  const [sourceType, setSourceType] = useState(() => {
    if (initialStream && initialStream.getVideoTracks()[0]) {
      return getSourceTypeFromTrack(initialStream.getVideoTracks()[0]);
    }
    return SCREEN_SOURCE_TYPES.UNKNOWN;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // { type: string, message: string }

  const activeStreamRef = useRef(initialStream);

  // Ownership flag: true = stream was passed externally (caller owns lifecycle), false = we created it
  const isExternalStreamRef = useRef(!!(initialStream && initialStream.active));

  /**
   * Stops all active screen MediaStreamTracks and resets state.
   * If skipTrackStop is true, only resets internal state without stopping tracks.
   */
  const stopScreenShare = useCallback(({ skipTrackStop = false } = {}) => {
    if (activeStreamRef.current && !skipTrackStop) {
      const tracks = activeStreamRef.current.getTracks();
      tracks.forEach((track) => {
        track.stop(); // Release screen capture resources
      });
    }
    activeStreamRef.current = null;
    isExternalStreamRef.current = false;
    setStream(null);
    setIsScreenActive(false);
    setSourceType(SCREEN_SOURCE_TYPES.UNKNOWN);
    setIsLoading(false);
  }, []);

  // Handle pre-opened initialStream
  useEffect(() => {
    if (initialStream && initialStream.active) {
      activeStreamRef.current = initialStream;
      isExternalStreamRef.current = true;
      setStream(initialStream);
      setIsScreenActive(true);

      const videoTrack = initialStream.getVideoTracks()[0];
      if (videoTrack) {
        setSourceType(getSourceTypeFromTrack(videoTrack));
        videoTrack.onended = () => {
          console.warn('[Screen] external video track ended');
          activeStreamRef.current = null;
          setStream(null);
          setIsScreenActive(false);
          setError({
            type: 'STOPPED_EXTERNALLY',
            message: 'Screen monitoring stopped.'
          });
        };
      }
    }
  }, [initialStream]);

  /**
   * Requests screen sharing permission and starts display MediaStream.
   */
  const startScreenShare = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    // 1. Check browser compatibility
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      setIsLoading(false);
      const errObj = {
        type: 'UNSUPPORTED',
        message: 'Your browser does not support Screen Capture (getDisplayMedia API).'
      };
      setError(errObj);
      return false;
    }

    try {
      // 2. Request video stream ONLY (audio set to false)
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Stop any prior stream
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      const derivedSourceType = videoTrack ? getSourceTypeFromTrack(videoTrack) : SCREEN_SOURCE_TYPES.UNKNOWN;

      // 3. Listen for track ending externally (user clicks native browser "Stop sharing" bar)
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
          setError({
            type: 'STOPPED_EXTERNALLY',
            message: 'Screen monitoring stopped.'
          });
        };
      }

      activeStreamRef.current = mediaStream;
      isExternalStreamRef.current = false; // We created this stream — we own it
      setStream(mediaStream);
      setIsScreenActive(true);
      setSourceType(derivedSourceType);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Screen share error:', err);
      setIsLoading(false);
      setIsScreenActive(false);

      let errorType = 'UNKNOWN';
      let errorMessage = 'An unexpected error occurred while setting up screen monitoring.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'AbortError') {
        errorType = 'CANCELED';
        errorMessage = 'Screen monitoring was canceled or denied.';
      } else if (err.name === 'NotFoundError') {
        errorType = 'NO_DISPLAY';
        errorMessage = 'Selected display or window is no longer available.';
      }

      setError({ type: errorType, message: errorMessage });
      return false;
    }
  }, [stopScreenShare]);

  // Clean up on component unmount — skip track.stop() for externally owned streams
  useEffect(() => {
    return () => {
      if (isExternalStreamRef.current) {
        console.log('[Screen] cleanup: external stream — skipping track.stop()');
        stopScreenShare({ skipTrackStop: true });
      } else {
        stopScreenShare();
      }
    };
  }, [stopScreenShare]);

  return {
    stream,
    isScreenActive,
    sourceType,
    isLoading,
    error,
    startScreenShare,
    stopScreenShare: () => stopScreenShare(), // Public API always stops tracks (user-initiated)
    observation: createScreenObservation(isScreenActive, stream?.getVideoTracks()[0] || null),
  };
}
