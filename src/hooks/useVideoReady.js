import { useState, useEffect, useRef } from 'react';

/**
 * Custom React hook to monitor an HTMLVideoElement and expose an explicit `isVideoReady` state and video telemetry.
 * 
 * isVideoReady is true ONLY when:
 * 1. video element exists
 * 2. video.srcObject exists
 * 3. video.readyState >= 2 (HAVE_CURRENT_DATA)
 * 4. video.videoWidth > 0
 * 5. video.videoHeight > 0
 * 6. video.paused === false
 * 7. video.ended === false
 * 
 * @param {React.RefObject<HTMLVideoElement>} videoRef - Ref to the target HTMLVideoElement
 * @param {MediaStream|null} stream - Active MediaStream instance
 * @param {boolean} isCameraActive - Flag indicating if camera capture is enabled
 * @returns {{ isVideoReady: boolean, videoStats: { videoWidth: number, videoHeight: number, readyState: number, paused: boolean, hasSrcObject: boolean } }}
 */
export function useVideoReady(videoRef, stream, isCameraActive) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoStats, setVideoStats] = useState({
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    paused: true,
    hasSrcObject: false,
  });

  const missingVideoCountRef = useRef(0);
  const prevTimeRef = useRef(-1);
  const isAdvancingRef = useRef(false);

  useEffect(() => {
    let checkInterval = null;
    let attachedVideo = null;

    if (!isCameraActive || !stream) {
      setIsVideoReady(false);
      setVideoStats({
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
        paused: true,
        hasSrcObject: false,
      });
      missingVideoCountRef.current = 0;
      prevTimeRef.current = -1;
      isAdvancingRef.current = false;
      return;
    }

    const checkReadiness = () => {
      const video = videoRef?.current;
      if (!video) {
        missingVideoCountRef.current += 1;
        // Only mark unready if absent for more than 3 consecutive checks (600ms), to prevent brief re-render glitches
        if (missingVideoCountRef.current > 3) {
          setIsVideoReady(false);
        }
        return;
      }

      missingVideoCountRef.current = 0;

      // Attach DOM event listeners dynamically once video element mounts
      if (attachedVideo !== video) {
        if (attachedVideo) {
          detachListeners(attachedVideo);
        }
        attachListeners(video);
        attachedVideo = video;
      }

      const hasSrcObject = Boolean(video.srcObject);
      const readyState = video.readyState;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const paused = video.paused;
      const ended = video.ended;
      const currentTime = video.currentTime || 0;

      if (currentTime > prevTimeRef.current || (currentTime > 0 && !paused)) {
        isAdvancingRef.current = true;
      }
      prevTimeRef.current = currentTime;

      const ready = Boolean(
        hasSrcObject &&
        readyState >= 2 &&
        videoWidth > 0 &&
        videoHeight > 0 &&
        !paused &&
        !ended &&
        (currentTime > 0 || isAdvancingRef.current)
      );

      setVideoStats({
        videoWidth: videoWidth || 0,
        videoHeight: videoHeight || 0,
        readyState: readyState || 0,
        paused,
        hasSrcObject,
      });

      setIsVideoReady((prevReady) => {
        if (!prevReady && ready) {
          console.log(`[Video] readyState=${readyState}`);
          console.log(`[Video] dimensions=${videoWidth}x${videoHeight}`);
          console.log('[Video] video is NOW READY for CV inference');
        }
        return ready;
      });

      // Explicitly call play() if srcObject is assigned but video is currently paused
      if (hasSrcObject && paused && !ended) {
        video.play().then(() => {
          console.log('[Video] play() resolved');
        }).catch((err) => {
          console.error('[Video] play() rejected:', err);
        });
      }
    };

    const handleLoadedMetadata = () => {
      const video = videoRef?.current;
      if (video) {
        console.log(`[Video] loadedmetadata (${video.videoWidth}x${video.videoHeight})`);
      }
      checkReadiness();
    };

    const handleCanPlay = () => {
      console.log('[Video] canplay');
      checkReadiness();
    };

    const handlePlaying = () => {
      console.log('[Video] playing');
      checkReadiness();
    };

    const attachListeners = (node) => {
      node.addEventListener('loadedmetadata', handleLoadedMetadata);
      node.addEventListener('canplay', handleCanPlay);
      node.addEventListener('playing', handlePlaying);
      node.addEventListener('timeupdate', checkReadiness);
      node.addEventListener('pause', checkReadiness);
      node.addEventListener('ended', checkReadiness);
      node.addEventListener('resize', checkReadiness);
    };

    const detachListeners = (node) => {
      node.removeEventListener('loadedmetadata', handleLoadedMetadata);
      node.removeEventListener('canplay', handleCanPlay);
      node.removeEventListener('playing', handlePlaying);
      node.removeEventListener('timeupdate', checkReadiness);
      node.removeEventListener('pause', checkReadiness);
      node.removeEventListener('ended', checkReadiness);
      node.removeEventListener('resize', checkReadiness);
    };

    // Immediate check
    checkReadiness();

    // Periodic check interval
    checkInterval = setInterval(checkReadiness, 200);

    return () => {
      if (attachedVideo) {
        detachListeners(attachedVideo);
        attachedVideo = null;
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [videoRef, stream, isCameraActive]);

  return { isVideoReady, videoStats };
}
