import React, { useState, useEffect, useRef } from 'react';
import { Play, Eye, Shield, BarChart3, Activity, Users, Monitor, Lock, ArrowRight, Video, Mic, CheckCircle2, Cpu } from 'lucide-react';
import { HowItWorksCarousel } from '../components/HowItWorksCarousel';
import { PremiumFeatures } from '../components/PremiumFeatures';
import { ScrollStackSection } from '../components/ScrollStackSection';

// Custom hook for scroll animations
function useScrollReveal(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
}

export function LandingPage({ onStartSetup }) {
  const [heroRef, heroVisible] = useScrollReveal(0.1);
  const [worksRef, worksVisible] = useScrollReveal(0.1);
  const [aiRef, aiVisible] = useScrollReveal(0.1);
  const [analyticsRef, analyticsVisible] = useScrollReveal(0.1);
  const [privacyRef, privacyVisible] = useScrollReveal(0.1);
  const [ctaRef, ctaVisible] = useScrollReveal(0.1);

  return (
    <div className="font-sans pb-0">

      {/* 1. HERO SECTION */}
      <ScrollStackSection zIndex={10} bgClass="bg-[#10151A]">
        <section id="product" className="relative pt-24 pb-12 px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-8">
          {/* Left Content */}
          <div
            ref={heroRef}
            className={`flex-1 transition-all duration-1000 ease-out transform ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="inline-block px-3 py-1 mb-6 rounded-full border border-brand-sand/30 bg-brand-sand/10 text-brand-sand text-xs font-semibold tracking-wider uppercase">
              Focus Today. A Brighter Tomorrow.
            </div>
            <h1 className="text-5xl lg:text-7xl font-serif font-medium tracking-tight text-white mb-6 leading-[1.1]">
              Understand <span className="text-brand-sand italic">Your Focus.</span>
              <br />
              Improve Your Productivity.
            </h1>
            <p className="text-lg text-brand-beige/80 max-w-xl mb-10 leading-relaxed font-light">
              FocusLens uses AI to help you understand what happens during your study sessions — turning everyday focus patterns into clear, actionable insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={onStartSetup}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-brand-sand hover:bg-[#A37856] text-brand-navy font-semibold text-base transition-all hover:shadow-xl hover:shadow-brand-sand/20 hover:-translate-y-0.5 flex items-center justify-center space-x-2"
              >
                <span>Start a Focus Session</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="w-full sm:w-auto px-8 py-3.5 rounded-full border border-brand-slate hover:bg-brand-slate/50 text-white font-medium text-base transition-all flex items-center justify-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Watch Demo</span>
              </button>
            </div>
          </div>

          {/* Right Content - Dashboard Preview */}
          <div className={`flex-1 w-full transition-all duration-1000 delay-300 ease-out transform ${heroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <div className="relative rounded-2xl border border-brand-slate bg-[#161616] p-6 shadow-2xl shadow-brand-black/50 overflow-hidden">
              {/* Window controls */}
              <div className="flex space-x-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400/80"></div>
              </div>

              {/* Mock Dashboard */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Focus Session</p>
                    <p className="text-4xl font-light text-white font-mono">50:00</p>
                  </div>
                  <div className="text-right">
                    <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Focus Score</p>
                    <p className="text-4xl font-semibold text-brand-sand">86%</p>
                  </div>
                </div>

                {/* Activity Breakdown */}
                <div className="p-4 rounded-xl bg-brand-navy/50 border border-brand-slate/50">
                  <p className="text-sm font-medium text-brand-beige mb-3">Activity Breakdown</p>
                  <div className="space-y-2 text-xs text-brand-gray">
                    <div className="flex justify-between"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-purple-600 mr-2"></span>Studying</span><span className="text-white">42 min</span></div>
                    <div className="flex justify-between"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Looking Away</span><span className="text-white">4 min</span></div>
                    <div className="flex justify-between"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-300/60 mr-2"></span>Phone Detected</span><span className="text-white">2 min</span></div>
                    <div className="flex justify-between"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-400/60 mr-2"></span>Away From Desk</span><span className="text-white">2 min</span></div>
                  </div>
                </div>

                {/* Live Detection */}
                <div>
                  <p className="text-sm font-medium text-brand-beige mb-3">Live Detection</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-brand-slate/30 border border-brand-slate/40 flex items-center space-x-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-sand" /> <span>Person Detected</span>
                    </div>
                    <div className="p-2 rounded-lg bg-brand-slate/30 border border-brand-slate/40 flex items-center space-x-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-sand" /> <span>Looking at Screen</span>
                    </div>
                    <div className="p-2 rounded-lg bg-brand-slate/30 border border-brand-slate/40 flex items-center space-x-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-sand" /> <span>No Phone Detected</span>
                    </div>
                    <div className="p-2 rounded-lg bg-brand-slate/30 border border-brand-slate/40 flex items-center space-x-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-sand" /> <span>At Desk</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="h-2 w-full bg-brand-slate/30 rounded-full overflow-hidden flex">
                  <div className="h-full bg-purple-500" style={{ width: '75%' }}></div>
                  <div className="h-full bg-yellow-600" style={{ width: '10%' }}></div>
                  <div className="h-full bg-red-400/60" style={{ width: '5%' }}></div>
                  <div className="h-full bg-pink-700" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollStackSection>

      {/* 2. PREMIUM FEATURES SHOWCASE */}
      <ScrollStackSection zIndex={20} bgClass="bg-[#10232A]">
        <PremiumFeatures />
      </ScrollStackSection>

      {/* 3. HOW IT WORKS (3D Carousel) */}
      <ScrollStackSection zIndex={30} bgClass="bg-[#10232A]">
        <section id="how-it-works" ref={worksRef} className={`transition-all duration-1000 ease-out ${worksVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <HowItWorksCarousel />
        </section>
      </ScrollStackSection>

      {/* 4. AI DETECTION SECTION */}
      <ScrollStackSection zIndex={40} bgClass="bg-[#10151A]">
        <section id="features" ref={aiRef} className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row items-center gap-10">
          <div className={`flex-1 transition-all duration-1000 transform ${aiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
              AI That Understands <br /> Your Study Sessions
            </h2>
            <p className="text-brand-gray text-lg leading-relaxed mb-8">
              FocusLens detects observable activities like studying, phone presence, multiple people, being away from the desk, head direction, and speech-like activity — all processed locally on your device.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center space-x-3 text-brand-beige text-sm"><Video className="w-5 h-5 text-brand-sand" /> <span>Camera observation</span></li>
              <li className="flex items-center space-x-3 text-brand-beige text-sm"><Mic className="w-5 h-5 text-brand-sand" /> <span>Microphone observation</span></li>
              <li className="flex items-center space-x-3 text-brand-beige text-sm"><Monitor className="w-5 h-5 text-brand-sand" /> <span>Screen share tracking</span></li>
            </ul>
          </div>

          <div className={`flex-1 w-full relative transition-all duration-1000 delay-300 transform ${aiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            {/* Abstract representation of student studying */}
            <div className="aspect-square max-h-[500px] w-full rounded-3xl bg-[#10232A] border border-brand-slate/40 relative overflow-hidden flex items-center justify-center shadow-2xl group">
              {/* Background Image of Boy Studying */}
              <div className="absolute inset-0 bg-[url('/boy-studying.png')] bg-cover bg-center bg-no-repeat opacity-60 mix-blend-screen transition-transform duration-1000 group-hover:scale-105"></div>

              {/* Vignette/Shadow Overlay for contrast */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#161616]/90 via-[#10232A]/40 to-transparent pointer-events-none"></div>

              {/* Floating Labels */}
              <div className="absolute top-[20%] left-[10%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite] transition-all duration-300 hover:shadow-[0_0_15px_#B58863] hover:border-brand-sand hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-brand-sand mr-2"></span>Studying</span>
              </div>

              <div className="absolute bottom-[25%] right-[10%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite_1s] transition-all duration-300 hover:shadow-[0_0_15px_#B58863] hover:border-brand-sand hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-brand-sand mr-2"></span>At Desk</span>
              </div>

              <div className="absolute top-[45%] left-[30%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite_2s] transition-all duration-300 hover:shadow-[0_0_15px_#60a5fa] hover:border-blue-400 hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-400 mr-2"></span>No Phone Detected</span>
              </div>

              <div className="absolute bottom-[15%] left-[40%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite_3s] transition-all duration-300 hover:shadow-[0_0_15px_#B58863] hover:border-brand-sand hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-brand-sand mr-2"></span>Looking at Screen</span>
              </div>

              <div className="absolute top-[35%] right-[20%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite_1.5s] transition-all duration-300 hover:shadow-[0_0_15px_#A79E9C] hover:border-brand-gray hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-brand-gray mr-2"></span>Posture: Upright</span>
              </div>

              <div className="absolute top-[65%] right-[30%] px-4 py-2 bg-[#161616]/80 backdrop-blur-md border border-brand-slate rounded-lg text-xs text-white shadow-xl animate-[pulse_4s_ease-in-out_infinite_2.5s] transition-all duration-300 hover:shadow-[0_0_15px_#A79E9C] hover:border-brand-gray hover:scale-105 hover:z-10 cursor-default">
                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-brand-gray mr-2"></span>Single Person</span>
              </div>
            </div>
          </div>
        </section>
      </ScrollStackSection>

      {/* 5. ANALYTICS SECTION */}
      <ScrollStackSection zIndex={50} bgClass="bg-[#10151A]">
        <section ref={analyticsRef} className="max-w-5xl mx-auto px-6 py-10">
          <div className={`text-center mb-16 transition-all duration-1000 transform ${analyticsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl font-bold text-white mb-4">Actionable Analytics</h2>
            <p className="text-brand-gray text-lg max-w-2xl mx-auto">Turn your focus into measurable progress with minimal, easy-to-understand reports.</p>
          </div>

          <div className={`p-8 rounded-3xl bg-[#161616] border border-brand-slate/50 shadow-2xl transition-all duration-1000 delay-200 transform ${analyticsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="p-4 rounded-xl bg-brand-navy border border-brand-slate/30">
                <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Weekly Focus</p>
                <p className="text-2xl font-light text-white">12h 45m</p>
              </div>
              <div className="p-4 rounded-xl bg-brand-navy border border-brand-slate/30">
                <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Avg Score</p>
                <p className="text-2xl font-light text-brand-sand">88%</p>
              </div>
              <div className="p-4 rounded-xl bg-brand-navy border border-brand-slate/30">
                <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Deep Study</p>
                <p className="text-2xl font-light text-white">8h 20m</p>
              </div>
              <div className="p-4 rounded-xl bg-brand-navy border border-brand-slate/30">
                <p className="text-brand-gray text-xs uppercase tracking-wider mb-1">Distractions</p>
                <p className="text-2xl font-light text-white">4h 25m</p>
              </div>
            </div>

            {/* Mock Chart Area */}
            <div className="h-48 w-full border-b border-l border-brand-slate/40 relative flex items-end justify-between px-4 pb-4 pt-10 gap-2">
              {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
                <div key={i} className="w-full bg-brand-slate hover:bg-brand-sand transition-colors rounded-t-sm relative group" style={{ height: `${height}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#161616] border border-brand-slate text-xs px-2 py-1 rounded text-white">{height}%</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-brand-gray mt-2 px-4">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
        </section>
      </ScrollStackSection>

      {/* 6. PRIVACY SECTION - BENTO GRID */}
      <ScrollStackSection zIndex={60} bgClass="bg-[#10151A]">
        <section id="privacy" ref={privacyRef} className="py-14 relative overflow-hidden">
          {/* Background glow for depth */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-sand/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

          <div className="max-w-6xl mx-auto px-6">
            <div className={`text-center mb-16 transition-all duration-1000 transform ${privacyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Your Focus. <span className="text-brand-sand">Your Data.</span></h2>
              <p className="text-brand-gray text-lg max-w-2xl mx-auto">We built FocusLens with a fundamental belief: your study habits are yours alone. Zero cloud tracking, zero compromises.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Main Feature - Large Card */}
              <div className={`col-span-1 md:col-span-7 p-10 rounded-3xl bg-[#161616] border border-brand-slate/40 hover:border-brand-sand/50 transition-colors duration-500 relative overflow-hidden group transform ${privacyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-sand/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 group-hover:bg-brand-sand/20 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-brand-navy border border-brand-slate flex items-center justify-center mb-8 shadow-lg">
                      <Lock className="w-6 h-6 text-brand-sand" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">100% Local Processing</h3>
                    <p className="text-brand-beige/70 leading-relaxed text-sm max-w-md">
                      Video and audio frames never leave your browser. All AI models run locally on your device's hardware. We literally cannot see what you are doing.
                    </p>
                  </div>
                  {/* Decorative element: Mock Terminal / Processing Visual */}
                  <div className="mt-10 h-36 rounded-xl bg-[#090D10] border border-brand-slate/20 relative overflow-hidden flex flex-col justify-end p-4 font-mono text-[11px] text-brand-gray/50 leading-relaxed shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
                    {/* Top fade for scrolling effect illusion */}
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#090D10] to-transparent z-10 pointer-events-none"></div>

                    <div className="z-0 space-y-1.5 animate-[pulse_4s_ease-in-out_infinite]">
                      <p className="text-brand-gray/40">{`[system] Activating privacy-preserving core...`}</p>
                      <p>{`[module] Presence detection running locally.`}</p>
                      <p>{`[module] Gaze & head pose estimation active.`}</p>
                      <p className="text-brand-beige/80">{`[stream] Analyzing browser video feed...`}</p>
                      <p className="text-brand-sand font-medium flex items-center mt-2">{`[status] Zero data transmitted. 100% SECURE `} <span className="inline-block w-1.5 h-1.5 ml-2 bg-brand-sand rounded-full animate-pulse shadow-[0_0_8px_#B58863]"></span></p>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-px bg-brand-sand/30 shadow-[0_0_15px_#B58863]"></div>
                  </div>
                </div>
              </div>

              {/* Side Features - Stacked Cards */}
              <div className="col-span-1 md:col-span-5 flex flex-col gap-6">

                {/* Top Right Card */}
                <div className={`flex-1 p-8 rounded-3xl bg-brand-slate/10 border border-brand-slate/30 hover:bg-brand-slate/20 transition-all duration-500 transform ${privacyVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 delay-100'}`}>
                  <Shield className="w-8 h-8 text-white mb-6" />
                  <h3 className="text-xl font-bold text-white mb-3">Isolated Storage</h3>
                  <p className="text-brand-gray text-sm leading-relaxed">
                    Your session history is encrypted and isolated. It's stored securely and can be wiped instantly at any time.
                  </p>
                </div>

                {/* Bottom Right Card */}
                <div className={`flex-1 p-8 rounded-3xl bg-gradient-to-br from-brand-navy to-[#161616] border border-brand-slate/30 hover:border-brand-slate/60 transition-all duration-500 transform ${privacyVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 delay-200'}`}>
                  <Activity className="w-8 h-8 text-brand-beige mb-6" />
                  <h3 className="text-xl font-bold text-white mb-3">You Stay In Control</h3>
                  <p className="text-brand-gray text-sm leading-relaxed">
                    Opt-in to which sensors you want to use. Toggle camera or screen tracking independently.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </ScrollStackSection>

      {/* 7. FINAL CTA */}
      <ScrollStackSection zIndex={70} bgClass="bg-[#10151A]" isLast={true}>
        <section ref={ctaRef} className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className={`transition-all duration-1000 transform ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-4xl font-bold text-white mb-6">Ready to understand your focus?</h2>
            <p className="text-brand-beige/80 text-lg mb-10 max-w-xl mx-auto">Start your first session and turn your focus into measurable progress.</p>
            <button
              onClick={onStartSetup}
              className="px-10 py-4 rounded-full bg-brand-sand hover:bg-[#A37856] text-brand-navy font-bold text-base transition-all hover:shadow-xl hover:shadow-brand-sand/20 hover:-translate-y-1 flex items-center justify-center space-x-2 mx-auto"
            >
              <span>Start Focusing</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      </ScrollStackSection>

    </div>
  );
}
