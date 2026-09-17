import React, { useState, useEffect } from 'react';
import { Eye, ShieldCheck, LayoutDashboard, User, LogIn, Compass, Flame, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar.jsx';

export function Navbar({ currentView, onNavigate, activeSession }) {
  const { user, isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`fixed inset-x-0 z-50 transition-all duration-500 flex justify-center px-4 pointer-events-none ${isScrolled ? 'top-4' : 'top-6'}`}>
      <header className={`w-full max-w-5xl transition-all duration-500 rounded-full pointer-events-auto ${
        isScrolled 
          ? 'border border-white/10 bg-navy-950/60 backdrop-blur-2xl shadow-xl shadow-black/30' 
          : 'bg-transparent border border-transparent'
      }`}>
        <div className="flex items-center justify-between h-16 px-6">
          {/* Logo and Brand */}
          <div 
            onClick={() => onNavigate('landing')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-200">
                FocusLens
              </span>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center space-x-2.5">
            {currentView === 'active' && activeSession && (
              <span className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Session Active</span>
              </span>
            )}
            
            {currentView !== 'landing' && currentView !== 'active' && (
              <button
                onClick={() => onNavigate('landing')}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors"
              >
                Home
              </button>
            )}

            {isAuthenticated ? (
              <>
                {currentView !== 'active' && (
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      currentView === 'dashboard'
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>
                )}

                {currentView !== 'active' && (
                  <button
                    onClick={() => onNavigate('recommendations')}
                    className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      currentView === 'recommendations'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recommend</span>
                  </button>
                )}

                {currentView !== 'active' && (
                  <button
                    onClick={() => onNavigate('consistency')}
                    className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      currentView === 'consistency'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Consistency</span>
                  </button>
                )}

                {currentView !== 'active' && (
                  <button
                    onClick={() => onNavigate('coach')}
                    className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      currentView === 'coach'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-brand-400" />
                    <span>Focus Coach</span>
                  </button>
                )}

                {currentView !== 'active' && (
                  <button
                    onClick={() => onNavigate('history')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      currentView === 'history'
                        ? 'bg-slate-800 text-white border-slate-700'
                        : 'text-slate-400 hover:text-white border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    History
                  </button>
                )}

                <button
                  onClick={() => onNavigate('profile')}
                  className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    currentView === 'profile'
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'text-slate-300 hover:text-white border-slate-800 hover:bg-slate-900'
                  }`}
                  title={user?.email}
                >
                  <UserAvatar user={user} size="xs" roundedFull className="w-4 h-4 text-[9px] mr-0.5" />
                  <span className="max-w-[120px] truncate">
                    {user?.name || (user?.username ? `@${user.username}` : 'Profile')}
                  </span>
                  {user?.username && (
                    <span className="hidden lg:inline text-[10px] font-mono text-brand-400">
                      @{user.username}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('login')}
                  className="flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => onNavigate('register')}
                  className="text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-1.5 rounded-lg shadow-md shadow-brand-600/20 transition-all"
                >
                  Register
                </button>
              </>
            )}

            {currentView === 'landing' && (
              <button
                onClick={() => onNavigate('setup')}
                className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg shadow-md shadow-indigo-600/20 transition-all hover:scale-105 ml-1"
              >
                Start Session
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
