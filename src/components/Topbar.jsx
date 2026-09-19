import React from 'react';
import { Search, Bell, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar.jsx';

export function Topbar({ currentView }) {
  const { user } = useAuth();

  const getBreadcrumbs = () => {
    switch (currentView) {
      case 'dashboard': return 'Home / Dashboard';
      case 'tasks': return 'Home / Tasks';
      case 'setup': return 'Home / Focus Setup';
      case 'history': return 'Home / Activity';
      case 'profile': return 'Home / Settings';
      case 'recommendations': return 'Home / Recommendations';
      case 'coach': return 'Home / Focus Coach';
      case 'consistency': return 'Home / Consistency';
      case 'weekly-review': return 'Home / Weekly Review';
      case 'journal': return 'Home / Focus Journal';
      case 'report': return 'Home / Session Report';
      case 'messages': return 'Home / Messages';
      case 'calendar': return 'Home / Calendar';
      case 'options': return 'Home / Options';
      default: return `Home / ${currentView}`;
    }
  };

  const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <header className="h-20 px-8 flex items-center justify-between z-10 relative">
      <div className="flex items-center space-x-4 text-sm text-slate-400">
        <span className="font-medium">{getBreadcrumbs()}</span>
        <span>/</span>
        <span className="flex items-center space-x-1 font-medium text-white">
          <CalendarIcon className="w-4 h-4" />
          <span>{currentDate}</span>
        </span>
      </div>

      <div className="flex items-center space-x-4">
        {/* Placeholder Team Members */}
        <div className="hidden md:flex items-center space-x-2 bg-navy-800/50 rounded-full p-1 pr-4 border border-slate-700/50">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-navy-950 flex items-center justify-center text-[10px] font-bold text-white z-10">JD</div>
            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-navy-950 flex items-center justify-center text-[10px] font-bold text-white z-20">AL</div>
            <button className="w-8 h-8 rounded-full bg-brand-500 border-2 border-navy-950 flex items-center justify-center text-white hover:bg-brand-400 transition z-30">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs text-slate-300 font-medium">Add member</span>
        </div>

        <button className="w-10 h-10 rounded-full bg-navy-800/80 border border-slate-700/50 flex items-center justify-center text-slate-300 hover:text-white transition">
          <Search className="w-4 h-4" />
        </button>
        <button className="w-10 h-10 rounded-full bg-navy-800/80 border border-slate-700/50 flex items-center justify-center text-slate-300 hover:text-white transition relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full"></span>
        </button>
        
        {/* User Profile */}
        <UserAvatar user={user} size="md" roundedFull className="ml-2 border-2 border-slate-700/50" />
      </div>
    </header>
  );
}
