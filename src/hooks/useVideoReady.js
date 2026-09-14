import { useState, useEffect } from 'react';

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

  useEffect(() => {
    let checkInterval = null;

    if (!isCameraActive || !stream) {
      setIsVideoReady(false);
      setVideoStats({
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
        paused: true,
        hasSrcObject: false,
      });
      return;
    }

    const checkReadiness = () => {
      const video = videoRef?.current;
      if (!video) {
        setIsVideoReady(false);
        return;
      }

      const hasSrcObject = Boolean(video.srcObject);
      const readyState = video.readyState;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const paused = video.paused;
      const ended = video.ended;

      const ready = Boolean(
        hasSrcObject &&
        readyState >= 2 &&
        videoWidth > 0 &&
        videoHeight > 0 &&
        !paused &&
        !ended
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

    // Immediate check
    checkReadiness();

    const videoNode = videoRef?.current;

    const handleLoadedMetadata = () => {
      if (videoNode) {
        console.log(`[Video] loadedmetadata (${videoNode.videoWidth}x${videoNode.videoHeight})`);
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

    if (videoNode) {
      videoNode.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoNode.addEventListener('canplay', handleCanPlay);
      videoNode.addEventListener('playing', handlePlaying);
      videoNode.addEventListener('pause', checkReadiness);
      videoNode.addEventListener('ended', checkReadiness);
      videoNode.addEventListener('resize', checkReadiness);

      // Periodic check interval to ensure ready state updates promptly
      checkInterval = setInterval(checkReadiness, 200);

      return () => {
        videoNode.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoNode.removeEventListener('canplay', handleCanPlay);
        videoNode.removeEventListener('playing', handlePlaying);
        videoNode.removeEventListener('pause', checkReadiness);
        videoNode.removeEventListener('ended', checkReadiness);
        videoNode.removeEventListener('resize', checkReadiness);
        if (checkInterval) clearInterval(checkInterval);
      };
    } else {
      // Poll until video ref mounts
      checkInterval = setInterval(checkReadiness, 200);
      return () => {
        if (checkInterval) clearInterval(checkInterval);
      };
    }
  }, [videoRef, stream, isCameraActive]);

  return { isVideoReady, videoStats };
}
