import React from 'react';
import { LayoutDashboard, Calendar, MessageSquare, Activity, Settings, LogOut, CheckSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FocusLensLogo } from './FocusLensLogo.jsx';

export function Sidebar({ currentView, onNavigate }) {
  const { logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'history', label: 'Activity', icon: Activity },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'options', label: 'Options', icon: Settings },
  ];

  const bottomItems = [
    { id: 'profile', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    if (logout) {
      logout();
    }
    onNavigate('landing');
  };

  return (
    <aside className="w-64 bg-navy-950/80 border-r border-slate-800/50 hidden md:flex flex-col h-screen shrink-0 relative backdrop-blur-2xl">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-900/10 to-transparent pointer-events-none" />

      <div className="p-6 flex items-center cursor-pointer relative z-10" onClick={() => onNavigate('dashboard')}>
        <FocusLensLogo
          variant="horizontal"
          size="md"
          ariaLabel="FocusLens dashboard"
          className="hover:opacity-90 transition-opacity"
        />
      </div>

      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto relative z-10">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-1 relative z-10">
        {bottomItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all mt-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
    </aside>
  );
}
