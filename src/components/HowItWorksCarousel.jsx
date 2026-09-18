import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Camera, BarChart3, Clock, Target, ArrowLeft, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    id: '01',
    title: 'Start',
    desc: 'Choose your study duration and start a focus session.',
    icon: Play
  },
  {
    id: '02',
    title: 'Focus',
    desc: 'Optionally enable camera or screen sharing for AI-based activity detection.',
    icon: Camera
  },
  {
    id: '03',
    title: 'Understand',
    desc: 'Get a detailed timeline, activity breakdown, and insights to improve over time.',
    icon: BarChart3
  },
  {
    id: '04',
    title: 'Track',
    desc: 'View your session history and see your progress over time.',
    icon: Clock
  },
  {
    id: '05',
    title: 'Improve',
    desc: 'Build better habits and become a more focused you.',
    icon: Target
  }
];

export function HowItWorksCarousel() {
  const [activeIndex, setActiveIndex] = useState(2); // Center card (Understand) default
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(CARDS.length - 1, prev + 1));
  }, []);

  // Swipe handlers
  const minSwipeDistance = 50;
  
  const onTouchStart = (e) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches ? e.targetTouches[0].clientX : e.clientX);
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    setTouchEndX(e.targetTouches ? e.targetTouches[0].clientX : e.clientX);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  return (
    <div className="w-full bg-[#10232A] py-12 flex flex-col items-center relative overflow-hidden">
      
      {/* Headings */}
      <div className="text-center mb-8 px-4 z-10">
        <p className="text-brand-sand text-xs font-semibold tracking-[0.2em] uppercase mb-4">
          Simple Steps. A Bigger Impact.
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          How FocusLens <span className="text-brand-sand">Works</span>
        </h2>
        <p className="text-brand-gray text-lg max-w-2xl mx-auto">
          From starting a session to seeing real progress — it's simple, seamless, and built for you.
        </p>
      </div>

      {/* Carousel Container */}
      <div 
        className="relative w-full max-w-6xl h-[450px] md:h-[400px] flex items-center justify-center select-none"
        style={{ perspective: '1200px' }}
        onMouseDown={onTouchStart}
        onMouseMove={onTouchMove}
        onMouseUp={onTouchEnd}
        onMouseLeave={onTouchEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Floor reflection effect */}
        <div className="absolute bottom-[-10%] w-3/4 h-[20%] bg-brand-sand/5 blur-[80px] rounded-full pointer-events-none"></div>

        {CARDS.map((card, idx) => {
          // Calculate offset from center
          const offset = idx - activeIndex;
          const absOffset = Math.abs(offset);
          
          // Is this card currently active?
          const isActive = offset === 0;

          // Compute transform and styles based on distance from active center
          let translateX = offset * 180; // px spread horizontally
          let translateZ = absOffset * -120; // push background cards back
          let rotateY = offset * -25; // tilt background cards toward center
          let scale = isActive ? 1 : 1 - (absOffset * 0.1);
          let opacity = isActive ? 1 : Math.max(0, 1 - (absOffset * 0.4));
          let zIndex = CARDS.length - absOffset;
          
          // Adjust for mobile screens (stack tighter)
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          if (isMobile) {
            translateX = offset * 100;
            rotateY = offset * -35;
          }

          // If offset is greater than 2 (on desktop) or 1 (on mobile), hide fully
          if (absOffset > 2 || (isMobile && absOffset > 1)) {
            opacity = 0;
            scale = 0.5;
          }

          const Icon = card.icon;

          return (
            <div
              key={card.id}
              onClick={() => setActiveIndex(idx)}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] md:w-[320px] h-[350px] md:h-[350px] rounded-3xl p-8 flex flex-col justify-center transition-all cursor-pointer`}
              style={{
                transform: `translateX(-50%) translateY(-50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex,
                transitionDuration: '600ms',
                transitionTimingFunction: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                background: isActive 
                  ? 'linear-gradient(145deg, #161616, #10232A)' 
                  : 'linear-gradient(145deg, #10151A, #0A0D11)',
                border: isActive 
                  ? '1px solid rgba(181, 136, 99, 0.4)' // brand-sand border
                  : '1px solid rgba(61, 77, 85, 0.3)', // brand-slate border
                boxShadow: isActive 
                  ? '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 30px -5px rgba(181, 136, 99, 0.15)'
                  : '0 10px 30px -10px rgba(0,0,0,0.8)'
              }}
            >
              <div className="flex items-center space-x-4 mb-8">
                <span className={`font-mono text-sm ${isActive ? 'text-brand-sand' : 'text-brand-gray'}`}>
                  {card.id}
                </span>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isActive ? 'bg-brand-sand/10 text-brand-sand' : 'bg-[#161616] text-brand-gray border border-brand-slate/20'}`}>
                  <Icon strokeWidth={isActive ? 2 : 1.5} className="w-5 h-5" />
                </div>
              </div>
              
              <h3 className={`text-2xl font-bold mb-4 transition-colors duration-500 ${isActive ? 'text-white' : 'text-brand-gray/80'}`}>
                {card.title}
              </h3>
              
              <p className={`text-sm leading-relaxed transition-colors duration-500 ${isActive ? 'text-brand-beige' : 'text-brand-gray/60'}`}>
                {card.desc}
              </p>

              {/* <div className={`mt-auto w-10 h-0.5 rounded-full transition-colors duration-500 ${isActive ? 'bg-brand-sand' : 'bg-brand-slate/30'}`}></div> */}
            </div>
          );
        })}

        {/* Navigation Arrows */}
        <button 
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          disabled={activeIndex === 0}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center bg-[#10232A]/80 backdrop-blur-sm border border-brand-slate/50 text-brand-gray hover:text-brand-beige hover:border-brand-sand hover:bg-brand-sand/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50 hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          disabled={activeIndex === CARDS.length - 1}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center bg-[#10232A]/80 backdrop-blur-sm border border-brand-slate/50 text-brand-gray hover:text-brand-beige hover:border-brand-sand hover:bg-brand-sand/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-50 hover:scale-105 active:scale-95"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Indicators */}
      <div className="flex flex-col items-center mt-8 z-10 space-y-4">
        <div className="flex space-x-2">
          {CARDS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`h-1 rounded-full transition-all duration-500 ${
                idx === activeIndex 
                  ? 'w-8 bg-brand-sand' 
                  : 'w-2 bg-brand-slate/40 hover:bg-brand-slate/80'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
        <div className="flex items-center text-xs text-brand-gray font-medium tracking-widest uppercase space-x-3 opacity-60">
          <ArrowLeft className="w-3 h-3" />
          <span>Slide to explore</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
