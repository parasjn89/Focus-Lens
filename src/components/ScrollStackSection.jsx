import React, { useRef, useEffect, useState } from 'react';

export function ScrollStackSection({ children, zIndex, bgClass = 'bg-[#0A0D11]', isLast = false }) {
  const containerRef = useRef(null);
  const stickyRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLast) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const startScroll = 0; 
            // The extra scroll distance before the next section fully covers it
            const scrollDistance = window.innerHeight * 0.4; // 40vh of overlap transition
            const endScroll = -scrollDistance; 

            if (containerRect.top > startScroll) {
              setProgress(0);
            } else if (containerRect.top <= startScroll && containerRect.top > endScroll) {
              const p = Math.abs(containerRect.top) / scrollDistance;
              setProgress(p);
            } else {
              setProgress(1);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isLast]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxScaleDown = isMobile ? 0.98 : 0.94;
  
  const scale = 1 - (progress * (1 - maxScaleDown));
  const opacity = 1 - (progress * 0.15);
  const blur = progress * 2;

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full ${isLast ? 'h-auto' : 'h-[140vh]'}`}
      style={{ zIndex }}
    >
      <div 
        className={`${isLast ? 'relative' : 'sticky top-0 h-screen'} w-full ${bgClass} overflow-y-auto no-scrollbar`}
      >
        <div 
          ref={stickyRef}
          className="w-full min-h-full origin-top transition-transform duration-75 ease-out flex flex-col justify-center will-change-transform"
          style={{
            transform: `scale(${isLast ? 1 : scale}) translateZ(0)`, // Force GPU
            opacity: isLast ? 1 : opacity,
            filter: isLast ? 'none' : `blur(${blur}px)`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
