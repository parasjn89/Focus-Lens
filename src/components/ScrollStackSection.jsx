import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ScrollStackSection — Premium scroll-stacking with ZERO scroll interference.
 *
 * Structure:
 *   Outer wrapper: position: relative, height: 110vh
 *   Inner section: position: sticky, top: 0, height: 100vh
 *
 * The 10vh "extra" gives the next section just enough runway to begin
 * overlapping before the sticky element releases. This is intentionally
 * small so the user NEVER feels stuck.
 *
 * The previous section subtly scales down (1 → 0.97) and fades (1 → 0.92)
 * as the next section slides up. No blur. No snap. No scroll control.
 */
export function ScrollStackSection({ children, zIndex, bgClass = 'bg-[#10151A]', isLast = false }) {
  const outerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);

  const updateStyles = useCallback(() => {
    if (!outerRef.current || isLast) return;

    const rect = outerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    // The sticky element is pinned at top:0. Once the outer wrapper's top
    // goes negative, the sticky element is "active" and the next section
    // is starting to overlap. We measure how far into the overlap we are.
    //
    // rect.top goes from 0 → -extraHeight as the user scrolls.
    // extraHeight = outerHeight - vh = 110vh - 100vh = ~10vh
    //
    // We want the scale/opacity to kick in only during this overlap window.
    const extraHeight = outerRef.current.offsetHeight - vh;

    if (extraHeight <= 0 || rect.top >= 0) {
      // Section hasn't started overlapping yet — full size
      setScale(1);
      setOpacity(1);
      return;
    }

    if (rect.top < -extraHeight) {
      // Section fully covered by the next — keep at minimum values
      setScale(0.97);
      setOpacity(0.92);
      return;
    }

    // In the active overlap window: interpolate
    const progress = Math.abs(rect.top) / extraHeight; // 0 → 1
    const clampedProgress = Math.min(1, Math.max(0, progress));

    const isMobile = window.innerWidth < 768;
    const minScale = isMobile ? 0.98 : 0.97;
    const minOpacity = isMobile ? 0.96 : 0.92;

    setScale(1 - clampedProgress * (1 - minScale));
    setOpacity(1 - clampedProgress * (1 - minOpacity));
  }, [isLast]);

  useEffect(() => {
    if (isLast) return;

    let rafId = null;

    const onScroll = () => {
      // Cancel any pending frame to avoid queuing up multiple updates
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateStyles);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateStyles(); // run once on mount

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isLast, updateStyles]);

  if (isLast) {
    // Last section: normal document flow, no sticky magic needed
    return (
      <div className={`relative w-full ${bgClass}`} style={{ zIndex }}>
        {children}
      </div>
    );
  }

  return (
    // Outer wrapper: slightly taller than 100vh to create the overlap window.
    // 110vh = 100vh (visible) + 10vh (overlap scroll distance).
    // Keep this small — the user should NOT feel stuck here.
    <div
      ref={outerRef}
      className="relative w-full"
      style={{
        height: '110vh',
        zIndex,
      }}
    >
      {/* Sticky inner: locks to the top of the viewport */}
      <div
        className={`sticky top-0 w-full overflow-hidden ${bgClass}`}
        style={{
          height: '100vh',
          // No transition here — transforms are driven directly by scroll position.
          // Adding CSS transitions to scroll-driven values causes the "rubber band" lag.
        }}
      >
        <div
          className="w-full h-full will-change-transform"
          style={{
            transform: `scale(${scale}) translateZ(0)`,
            opacity,
            transformOrigin: 'center top',
          }}
        >
          {/* Content wrapper — NO overflow-y-auto here.
               A nested scroller inside a sticky element creates two competing
               scroll contexts, causing the "stuck" feel on trackpads & mobile.
               Content must fit within 100vh. */}
          <div className="w-full h-full flex flex-col justify-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
