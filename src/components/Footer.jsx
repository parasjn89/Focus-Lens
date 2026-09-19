import React from 'react';
import { Heart } from 'lucide-react';
import { FocusLensLogo } from './FocusLensLogo.jsx';

export function Footer() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/60 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-slate-400 text-xs">
        <div className="flex items-center space-x-2.5">
          <FocusLensLogo variant="icon" size="sm" isDecorative />
          <span>
            <strong className="text-white font-semibold">Focus<span className="text-cyan-400">Lens</span></strong> — Privacy-First Focus Monitoring. Raw video signals will strictly remain on-device.
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <span>Built for open-source focus & productivity</span>
        </div>
      </div>
    </footer>
  );
}
