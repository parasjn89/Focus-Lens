import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Shield, GraduationCap } from 'lucide-react';

const FEATURES = [
  {
    id: '01',
    label: 'AI-POWERED',
    title: 'AI-powered insights',
    desc: 'Turn your focus patterns into meaningful data and actionable insights.',
    icon: Cpu
  },
  {
    id: '02',
    label: 'PRIVACY',
    title: 'Privacy first',
    desc: 'Your sessions stay secure and your data remains under your control.',
    icon: Shield
  },
  {
    id: '03',
    label: 'STUDENT-FIRST',
    title: 'Built for students',
    desc: 'Designed around real study routines, focus sessions, and student goals.',
    icon: GraduationCap
  }
];

export function PremiumFeatures() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-[#10232A] py-16 overflow-hidden border-y border-brand-slate/20">
      
      {/* Subtle Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand-sand/5 blur-[120px] rounded-full transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}></div>

      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-2 h-2 rounded-full border border-brand-sand/30 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
        <div className="absolute bottom-[20%] right-[15%] w-3 h-3 rounded-full bg-brand-slate/20 animate-[pulse_6s_ease-in-out_infinite]"></div>
        <div className="absolute top-[60%] right-[25%] w-16 h-16 border border-brand-slate/10 rounded-full animate-[spin_10s_linear_infinite]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        
        {/* Headings */}
        <div className={`text-center mb-12 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-brand-gray text-[10px] tracking-[0.3em] font-semibold uppercase mb-4">Why FocusLens</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Built for a <span className="text-brand-sand">Better You</span>
          </h2>
          <p className="text-brand-beige/70 text-base md:text-lg max-w-xl mx-auto font-light">
            Powerful insights. Thoughtful privacy. A better way to stay focused.
          </p>
        </div>

        {/* 3D Features Area */}
        <div className="relative flex flex-col md:flex-row items-center justify-center gap-16 md:gap-8 lg:gap-16">
          
          {/* Connecting Line (Desktop Only) */}
          <div className={`hidden md:block absolute top-[120px] left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-brand-sand/30 to-transparent -z-10 transition-all duration-1500 delay-500 ${isVisible ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-1 h-1 rounded-full bg-brand-sand shadow-[0_0_8px_#B58863] animate-pulse"></div>
            <div className="absolute top-1/2 right-1/3 -translate-y-1/2 w-1 h-1 rounded-full bg-brand-sand shadow-[0_0_8px_#B58863] animate-[pulse_2s_ease-in-out_infinite_1s]"></div>
          </div>

          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div 
                key={feature.id}
                className={`relative flex-1 flex flex-col items-center group transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{ transitionDelay: `${idx * 200 + 300}ms` }}
              >
                {/* 3D Object Container */}
                <div 
                  className="relative w-48 h-56 mb-8 perspective-[1000px] flex items-center justify-center cursor-default"
                >
                  {/* Floating Glass Panel (The Object) */}
                  <div className="relative z-10 w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1F2E36]/80 to-[#10232A]/90 border border-brand-slate/50 backdrop-blur-md flex items-center justify-center transform transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] group-hover:-translate-y-4 group-hover:scale-110 group-hover:rotate-x-12 group-hover:-rotate-y-12 group-hover:border-brand-sand/60 group-hover:shadow-[20px_20px_50px_rgba(0,0,0,0.5),_0_0_20px_rgba(181,136,99,0.2)]">
                    
                    {/* Glowing Core Edge */}
                    <div className="absolute inset-0 rounded-2xl border border-brand-sand/0 group-hover:border-brand-sand/30 transition-all duration-700"></div>
                    
                    <Icon strokeWidth={1} className="w-10 h-10 text-brand-sand transition-all duration-700 group-hover:drop-shadow-[0_0_8px_rgba(181,136,99,0.8)]" />
                  </div>
                </div>

                {/* Text Content */}
                <div className="text-center px-4">
                  <p className="font-mono text-[10px] text-brand-gray tracking-widest mb-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    {feature.id} <span className="ml-1">{feature.label}</span>
                  </p>
                  <h3 className="text-lg font-bold text-white mb-3 group-hover:text-brand-sand transition-colors">
                    {feature.title}
                  </h3>
                  <div className="w-6 h-[1px] bg-brand-sand/0 group-hover:bg-brand-sand/50 mx-auto mb-3 transition-colors duration-500"></div>
                  <p className="text-sm text-brand-beige/60 leading-relaxed font-light">
                    {feature.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Message */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h4 className="text-xl font-serif italic text-white mb-2">Small sessions. Big progress.</h4>
          <p className="text-sm text-brand-gray/60 font-light">FocusLens turns everyday study time into meaningful progress.</p>
        </div>

      </div>
    </section>
  );
}
