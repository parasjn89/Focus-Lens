import React, { useState, useEffect, useRef } from 'react';
import { Pause, Play, Square, Settings, Camera, Monitor, Brain, RefreshCw } from 'lucide-react';
import { formatSecondsToTime } from '../utils/formatters';
import { formatPauseTime } from '../utils/sessionTimer';

export function FuturisticTimer({
  remainingSeconds,
  progressPercent,
  isPaused,
  pauseStartedAt = null,
  activity,
  onPause,
  onResume,
  onEndSession,
  isCameraActive = false,
  isScreenActive = false,
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [pauseRemainingSecs, setPauseRemainingSecs] = useState(null);

  useEffect(() => {
    if (!isPaused || !pauseStartedAt) {
      setPauseRemainingSecs(null);
      return;
    }
    const updatePauseInfo = () => {
      const remainingMs = 5 * 60 * 1000 - (Date.now() - pauseStartedAt);
      setPauseRemainingSecs(Math.max(0, Math.ceil(remainingMs / 1000)));
    };
    updatePauseInfo();
    const interval = setInterval(updatePauseInfo, 500);
    return () => clearInterval(interval);
  }, [isPaused, pauseStartedAt]);

  useEffect(() => {
    // Entrance animation trigger
    const t = setTimeout(() => setHasStarted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // 3D subtle tilts
  const rotateY = mousePos.x * 2; // max 2deg
  const rotateX = mousePos.y * -1.5; // max 1.5deg

  const isCompleted = remainingSeconds <= 0;

  return (
    <div 
      className="relative w-full min-h-[800px] flex flex-col items-center justify-center overflow-hidden bg-[#10232A] rounded-3xl border border-[#3D4D55]/20 shadow-2xl transition-all duration-1000"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* =========================================
          BACKGROUND & ATMOSPHERE
      ========================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl perspective-[1200px]">
        {/* Soft radial glow in center back */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#B58863]/10 blur-[150px] rounded-full" />
        
        {/* 3D Perspective Floor Grid */}
        <div 
          className="absolute bottom-0 left-[-50%] w-[200%] h-[60%] origin-bottom"
          style={{ 
            transform: 'rotateX(75deg) translateY(100px) translateZ(-200px)',
            backgroundImage: `linear-gradient(rgba(181, 136, 99, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(181, 136, 99, 0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)'
          }}
        />

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#10232A_100%)] opacity-80" />
      </div>

      {/* =========================================
          SIDE DECORATIONS (Subtle)
      ========================================= */}
      <div className="absolute top-12 left-12 hidden lg:flex flex-col space-y-1 opacity-30 text-[9px] uppercase tracking-[0.3em] text-[#D3C3B9] pointer-events-none">
        <span>Disconnect</span>
        <span>Distractions</span>
        <span className="mt-2">Build a better you</span>
        <div className="w-6 h-px bg-[#B58863] mt-3" />
      </div>

      <div className="absolute top-12 right-12 hidden lg:flex flex-col space-y-1 opacity-30 text-[9px] uppercase tracking-[0.3em] text-[#D3C3B9] text-right pointer-events-none">
        <span>"Small steps.</span>
        <span>Big progress."</span>
        <div className="w-6 h-px bg-[#B58863] mt-3 self-end" />
      </div>

      {/* =========================================
          MAIN CONTENT WRAPPER (Entrance Anim)
      ========================================= */}
      <div 
        className={`relative z-10 flex flex-col items-center transition-all duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] w-full ${
          hasStarted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.92] translate-y-12'
        }`}
      >
        
        {/* =========================================
            HEADER LABELS
        ========================================= */}
        <div className="flex flex-col items-center mb-16 space-y-5">
          <div className="text-[10px] uppercase tracking-[0.5em] text-[#A79E9C] font-semibold opacity-60">
            &mdash; F O C U S L E N S &mdash;
          </div>
          
          <div className="flex items-center space-x-3 px-6 py-2 rounded-full bg-[#161616]/90 border border-[#B58863]/30 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-400 animate-pulse' : 'bg-[#B58863] shadow-[0_0_8px_#B58863] animate-pulse'}`} />
            <span className="text-sm font-bold tracking-[0.25em] uppercase text-[#D3C3B9]">
              {isCompleted ? 'COMPLETE' : isPaused ? 'PAUSED' : activity}
            </span>
          </div>

          {isPaused && (
            <div className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>
                {pauseRemainingSecs !== null
                  ? `Auto-resumes in ${formatPauseTime(pauseRemainingSecs)}`
                  : 'Auto-resumes in 5:00'}
              </span>
              <span className="text-[10px] text-amber-400/70 font-normal">
                (Max 5 min)
              </span>
            </div>
          )}

          <div className="text-[11px] uppercase tracking-[0.3em] text-[#A79E9C] opacity-50 font-medium">
            {isPaused ? 'Session Paused · Timer Suspended' : 'Deep Work Mode · Stay Focused'}
          </div>
        </div>

        {/* =========================================
            3D CAPSULE TIMER
        ========================================= */}
        <div 
          className="relative group cursor-default mb-16"
          style={{ 
            perspective: '1500px',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Floating & Tilting Container */}
          <div 
            className="relative animate-[float_6s_ease-in-out_infinite] flex justify-center items-center"
            style={{
              transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            
            {/* Outer Bronze Rim (Layer 1) */}
            <div 
              className="absolute w-[102%] h-[115%] rounded-[150px] border-[2px] border-[#B58863]/30 shadow-[0_0_40px_rgba(181,136,99,0.2),inset_0_0_20px_rgba(181,136,99,0.3)] bg-[#10232A]/40 backdrop-blur-md transition-all duration-700"
              style={{ transform: 'translateZ(-10px)' }}
            />

            {/* Glass Shell (Layer 2) & Display Panel (Layer 3) */}
            <div 
              className={`relative w-[340px] md:w-[600px] lg:w-[800px] h-[160px] md:h-[240px] lg:h-[280px] rounded-[140px] bg-[#05070A] border border-[#3D4D55]/30 flex items-center justify-between overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8),inset_0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl transition-all duration-700 ${isPaused ? 'opacity-80' : 'opacity-100'}`}
              style={{ transform: 'translateZ(20px)' }}
            >
              {/* Internal Glass Partitions */}
              <div className="absolute left-[20%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#3D4D55]/30 to-transparent" />
              <div className="absolute right-[20%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#3D4D55]/30 to-transparent" />
              
              {/* Ambient backlight inside the capsule */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-[#B58863]/10 blur-[80px] rounded-full pointer-events-none" />

              {/* Running Animation / Scanning Light */}
              {!isPaused && !isCompleted && (
                <div className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden rounded-[140px]">
                  <div className="w-[150%] h-full bg-gradient-to-r from-transparent via-[#B58863]/50 to-transparent -translate-x-full animate-[scan_4s_ease-in-out_infinite]" />
                </div>
              )}

              {/* Left Side Detail */}
              <div className="hidden md:flex w-[20%] h-full flex-col items-center justify-center text-center opacity-70">
                <span className="text-[9px] uppercase tracking-[0.3em] text-[#D3C3B9] leading-loose drop-shadow-[0_0_8px_rgba(211,195,185,0.4)]">
                  Focus<br/>Session
                </span>
                <div className="w-4 h-px bg-[#B58863] mt-4 shadow-[0_0_5px_#B58863]" />
              </div>

              {/* Center Display (Layer 4) */}
              <div 
                className="flex-1 h-full flex flex-col items-center justify-center relative"
                style={{ transform: 'translateZ(30px)' }}
              >
                {isCompleted ? (
                  <div className="flex flex-col items-center animate-[fade-in_1s_ease-out]">
                    <div className="text-4xl md:text-5xl font-bold text-[#D3C3B9] tracking-[0.2em] font-sans drop-shadow-[0_0_25px_rgba(211,195,185,0.8)] uppercase mb-4">
                      Session Complete
                    </div>
                    <button 
                      onClick={onEndSession}
                      className="text-sm font-medium tracking-[0.1em] text-[#B58863] hover:text-[#D3C3B9] transition-colors uppercase border-b border-[#B58863]/30 hover:border-[#D3C3B9]/50 pb-1"
                    >
                      View Session Insights &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-7xl md:text-[130px] font-mono text-[#D3C3B9] tracking-widest font-light drop-shadow-[0_0_30px_rgba(211,195,185,0.6)] transition-all duration-500 leading-none flex items-center justify-center w-full z-10">
                      {formatSecondsToTime(remainingSeconds).split('').map((char, i) => (
                        <span key={i} className={char === ':' ? 'opacity-50 mx-2 md:mx-4 animate-pulse' : 'w-[0.8em] text-center inline-block'}>
                          {char}
                        </span>
                      ))}
                    </div>
                    
                    {/* Horizontal Progress Bar */}
                    <div className="absolute bottom-10 w-[60%] h-1 bg-[#3D4D55]/30 rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] z-10">
                      <div 
                        className="h-full bg-gradient-to-r from-[#B58863] to-[#D3C3B9] rounded-full transition-all duration-1000 ease-linear shadow-[0_0_15px_#B58863]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Right Side Detail */}
              <div className="hidden md:flex w-[20%] h-full flex-col items-center justify-center text-center opacity-70">
                <span className="text-[9px] uppercase tracking-[0.3em] text-[#D3C3B9] leading-loose drop-shadow-[0_0_8px_rgba(211,195,185,0.4)]">
                  Stay<br/>Consistent
                </span>
                <div className="w-4 h-px bg-[#B58863] mt-4 shadow-[0_0_5px_#B58863]" />
              </div>

              {/* =========================================
                  ULTRA-SHINY GLASS ENCLOSURE (Layer 5)
              ========================================= */}
              <div 
                className="absolute inset-0 rounded-[140px] pointer-events-none" 
                style={{ transform: 'translateZ(50px)' }}
              >
                {/* Thick glass border reflecting environment */}
                <div className="absolute inset-0 rounded-[140px] border-[3px] border-white/10 mix-blend-overlay" />
                
                {/* Main curved top highlight (Soft window reflection) */}
                <div className="absolute top-2 left-[5%] w-[90%] h-[25%] bg-gradient-to-b from-white/15 to-transparent rounded-[140px] blur-[3px]" />
                
                {/* Sharp specular highlight (Fluorescent tube glare) */}
                <div className="absolute top-5 left-[15%] w-[70%] h-[3px] bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full blur-[1px] opacity-80" />
                
                {/* Secondary bottom curve highlight (Bounce light) */}
                <div className="absolute bottom-2 left-[10%] w-[80%] h-[20%] bg-gradient-to-t from-[#B58863]/20 via-white/5 to-transparent rounded-[140px] blur-[4px]" />
                
                {/* Left and Right edge Fresnel reflections */}
                <div className="absolute inset-0 rounded-[140px] shadow-[inset_15px_0_30px_rgba(255,255,255,0.06),inset_-15px_0_30px_rgba(255,255,255,0.06)]" />

                {/* Diagonal glare (Classic shiny glass streak) */}
                <div className="absolute -top-[50%] -left-[20%] w-[150%] h-[200%] bg-gradient-to-tr from-transparent via-white/5 to-transparent -rotate-45 pointer-events-none" />
              </div>
            </div>

            {/* Floor Reflection / Soft Shadow (Layer 6) */}
            <div 
              className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[80%] h-[40px] bg-black/80 blur-[30px] rounded-[100%]"
              style={{ transform: 'translateZ(-40px)' }}
            />
            {/* Bronze floor bounce light */}
            <div 
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[50%] h-[20px] bg-[#B58863]/20 blur-[40px] rounded-[100%]"
              style={{ transform: 'translateZ(-30px)' }}
            />
          </div>
        </div>

        {/* =========================================
            CONTROLS
        ========================================= */}
        {!isCompleted && (
          <div className="flex items-center space-x-12 mb-14 relative z-20">
            {/* Pause/Resume Button */}
            <button
              onClick={isPaused ? onResume : onPause}
              className="group flex flex-col items-center space-y-4 text-[#A79E9C] hover:text-[#B58863] transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full border border-[#3D4D55]/60 group-hover:border-[#B58863]/80 flex items-center justify-center bg-[#161616]/90 shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_25px_rgba(181,136,99,0.3)] transition-all transform group-hover:-translate-y-1 group-hover:scale-105 backdrop-blur-md">
                {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
              </div>
              <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            
            {/* End / Reset Button */}
            <button
              onClick={onEndSession}
              className="group flex flex-col items-center space-y-4 text-[#A79E9C] hover:text-[#D3C3B9] transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full border border-[#3D4D55]/60 group-hover:border-[#D3C3B9]/80 flex items-center justify-center bg-[#161616]/90 shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_10px_25px_rgba(211,195,185,0.2)] transition-all transform group-hover:-translate-y-1 group-hover:scale-105 backdrop-blur-md">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">End</span>
            </button>

            {/* Settings Button */}
            
          </div>
        )}

        {/* =========================================
            AI MONITORING STATUS BAR
        ========================================= */}
        <div className="flex flex-wrap items-center justify-center gap-6 px-8 py-3 rounded-full bg-[#161616]/80 border border-[#3D4D55]/40 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md text-[10px] uppercase tracking-[0.2em] font-semibold text-[#A79E9C] relative z-20">
          <div className="flex items-center space-x-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isCameraActive ? 'bg-[#B58863] shadow-[0_0_6px_#B58863]' : 'bg-[#3D4D55]'}`} />
            <Camera className="w-3.5 h-3.5 opacity-60" />
            <span>Camera</span>
          </div>
          
          <div className="w-px h-3 bg-[#3D4D55]/50" />
          
          <div className="flex items-center space-x-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isScreenActive ? 'bg-[#B58863] shadow-[0_0_6px_#B58863]' : 'bg-[#3D4D55]'}`} />
            <Monitor className="w-3.5 h-3.5 opacity-60" />
            <span>Screen</span>
          </div>

          <div className="w-px h-3 bg-[#3D4D55]/50" />
          
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B58863] shadow-[0_0_6px_#B58863]" />
            <Brain className="w-3.5 h-3.5 opacity-60" />
            <span>AI Monitoring</span>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
