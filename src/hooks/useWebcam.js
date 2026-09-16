import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom React Hook to safely manage browser camera streams via navigator.mediaDevices.getUserMedia().
 * Handles camera startup, user permission denial, device errors, and track cleanup on unmount.
 */
export function useWebcam({ initialStream = null } = {}) {
  const [stream, setStream] = useState(initialStream);
  const [isCameraActive, setIsCameraActive] = useState(!!(initialStream && initialStream.active));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null); // { type: string, message: string }

  // Use a ref to hold current stream reference so unmount cleanup always gets latest stream
  const activeStreamRef = useRef(initialStream);

  // Ownership flag: true = stream was passed externally (caller owns lifecycle), false = we created it
  const isExternalStreamRef = useRef(!!(initialStream && initialStream.active));

  useEffect(() => {
    if (initialStream && initialStream.active) {
      activeStreamRef.current = initialStream;
      isExternalStreamRef.current = true;
      setStream(initialStream);
      setIsCameraActive(true);

      // Monitor for external track death (hardware unplug, OS revocation)
      const videoTrack = initialStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn('[Camera] external video track ended (hardware disconnect or OS revocation)');
          activeStreamRef.current = null;
          setStream(null);
          setIsCameraActive(false);
        };
      }
    }
  }, [initialStream]);

  /**
   * Stops all active MediaStreamTracks and resets camera state.
   * If the stream was externally provided, only resets internal state without stopping tracks.
   */
  const stopCamera = useCallback(({ skipTrackStop = false } = {}) => {
    if (activeStreamRef.current && !skipTrackStop) {
      const tracks = activeStreamRef.current.getTracks();
      tracks.forEach((track) => {
        track.stop(); // Stops physical camera hardware capture
      });
    }
    activeStreamRef.current = null;
    isExternalStreamRef.current = false;
    setStream(null);
    setIsCameraActive(false);
    setIsLoading(false);
  }, []);

  /**
   * Requests camera permission and starts live video stream.
   * STRICT: Audio is set to false (no microphone access).
   */
  const startCamera = useCallback(async () => {
    // Reset previous errors
    setError(null);
    setIsLoading(true);

    // 1. Check browser compatibility
    if (!navigator?.mediaDevices?.getUserMedia) {
      setIsLoading(false);
      const errObj = {
        type: 'UNSUPPORTED',
        message: 'Your web browser does not support webcam access (getUserMedia API).'
      };
      setError(errObj);
      return false;
    }

    try {
      // 2. Request video stream ONLY (audio set to false)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      // Stop any prior existing stream before assigning new one
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      activeStreamRef.current = mediaStream;
      isExternalStreamRef.current = false; // We created this stream — we own it
      console.log('[Camera] stream acquired');
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      setIsLoading(false);
      setIsCameraActive(false);
      
      let errorType = 'UNKNOWN';
      let errorMessage = 'An unexpected error occurred while accessing the camera.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorType = 'PERMISSION_DENIED';
        errorMessage = 'Camera access was denied by user or browser policy.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorType = 'NO_CAMERA';
        errorMessage = 'No camera hardware device found on this computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorType = 'CAMERA_IN_USE';
        errorMessage = 'Camera is currently in use by another application or tab.';
      } else if (err.name === 'OverconstrainedError') {
        errorType = 'CONSTRAINT_ERROR';
        errorMessage = 'The requested video resolution is not supported by your camera.';
      }

      setError({ type: errorType, message: errorMessage });
      return false;
    }
  }, []);

  // Cleanup on component unmount — skip track.stop() for externally owned streams
  useEffect(() => {
    return () => {
      if (isExternalStreamRef.current) {
        // External stream: reset internal state only, do NOT stop hardware tracks
        console.log('[Camera] cleanup: external stream — skipping track.stop()');
        stopCamera({ skipTrackStop: true });
      } else {
        stopCamera();
      }
    };
  }, [stopCamera]);

  return {
    stream,
    isCameraActive,
    isLoading,
    error,
    startCamera,
    stopCamera: () => stopCamera(), // Public API always stops tracks (user-initiated)
  };
}
