import React, { useState, useEffect } from 'react';
import { FocusLensLogo } from './FocusLensLogo.jsx';

export function LandingNavbar({ onNavigate }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`fixed inset-x-0 z-50 flex justify-center px-4 transition-all duration-500 pointer-events-none ${isScrolled ? 'top-4' : 'top-6'}`}>
      <header className={`w-full max-w-5xl rounded-full transition-all duration-500 pointer-events-auto ${
        isScrolled 
          ? 'bg-brand-navy/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-brand-black/40 py-2.5 px-4' 
          : 'bg-transparent border border-transparent py-4 px-4'
      }`}>
        <div className="flex items-center justify-between">
          
          {/* Left: Logo */}
          <div 
            onClick={() => onNavigate('landing')}
            className="flex items-center cursor-pointer group"
          >
            <FocusLensLogo
              variant="horizontal"
              size="md"
              ariaLabel="FocusLens home"
              className="group-hover:opacity-90 transition-opacity"
            />
          </div>

          {/* Center: Links (Hidden on mobile) */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#product" className="text-sm font-medium text-brand-gray hover:text-white transition-colors">Product</a>
            <a href="#how-it-works" className="text-sm font-medium text-brand-gray hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="text-sm font-medium text-brand-gray hover:text-white transition-colors">Features</a>
            <a href="#privacy" className="text-sm font-medium text-brand-gray hover:text-white transition-colors">Privacy</a>
          </nav>

          {/* Right: CTA */}
          <div className="flex items-center space-x-6">
            <button
              onClick={() => onNavigate('login')}
              className="hidden sm:block text-sm font-medium text-brand-gray hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('setup')}
              className="text-sm font-semibold bg-brand-sand hover:bg-[#A37856] text-brand-navy px-5 py-2 rounded-full transition-all hover:shadow-lg hover:shadow-brand-sand/20 hover:-translate-y-0.5"
            >
              Start for Free &rarr;
            </button>
          </div>

        </div>
      </header>
    </div>
  );
}
