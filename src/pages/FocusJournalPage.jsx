import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, Award, Target, Flame, ChevronRight, RefreshCw, AlertCircle, Edit3, X, CheckCircle2, HardDrive, Database } from 'lucide-react';
import { apiFetch } from '../api/client';
import { BackButton } from '../components/BackButton.jsx';

export function FocusJournalPage({ onSelectSession, onNewSession, onNavigate }) {
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0, hasMore: false });
  const [filter, setFilter] = useState('all'); // 'all' | 'goals' | 'reflections'
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editing state
  const [editingSession, setEditingSession] = useState(null);
  const [editIntention, setEditIntention] = useState('');
  const [editWorkedWell, setEditWorkedWell] = useState('');
  const [editGotInTheWay, setEditGotInTheWay] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  const fetchJournal = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/journal?page=${page}&limit=10&filter=${filter}`);
      setEntries(res.entries || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load Focus Journal:', err);
      setError('Could not load Focus Journal entries.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
  }, [page, filter]);

  const handleOpenEdit = (session) => {
    setEditingSession(session);
    setEditIntention(session.intention || '');
    setEditWorkedWell(session.workedWell || '');
    setEditGotInTheWay(session.gotInTheWay || '');
    setEditNotes(session.notes || '');
    setSaveSuccessMsg(null);
  };

  const handleSaveJournalEdit = async (e) => {
    e.preventDefault();
    if (!editingSession) return;

    setIsSavingEdit(true);
    try {
      const res = await apiFetch(`/api/sessions/${editingSession.id}/journal`, {
        method: 'PATCH',
        body: JSON.stringify({
          intention: editIntention,
          workedWell: editWorkedWell,
          gotInTheWay: editGotInTheWay,
          notes: editNotes,
        }),
      });

      if (res.success) {
        setSaveSuccessMsg('Session journal updated successfully!');
        setTimeout(() => {
          setEditingSession(null);
          fetchJournal();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to update session journal:', err);
      setError('Failed to update session journal notes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sec`;
    return `${mins} min ${secs > 0 ? `${secs}s` : ''}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Top Contextual Navigation */}
      <div className="flex items-center justify-between">
        <BackButton
          label="Back to Dashboard"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Focus Journal</h1>
          </div>
          <p className="text-sm text-slate-400">
            "Your sessions, your reflections." Human context alongside session telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onNewSession}
            className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
          >
            Start Focus Session
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 mt-6 pb-4">
        <button
          onClick={() => { setFilter('all'); setPage(1); }}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-lg border transition-colors ${
            filter === 'all'
              ? 'bg-brand-600 text-white border-brand-500'
              : 'text-slate-400 hover:text-white border-slate-800 hover:bg-slate-900'
          }`}
        >
          All Sessions ({pagination.totalCount || 0})
        </button>

        <button
          onClick={() => { setFilter('goals'); setPage(1); }}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-lg border transition-colors ${
            filter === 'goals'
              ? 'bg-brand-600 text-white border-brand-500'
              : 'text-slate-400 hover:text-white border-slate-800 hover:bg-slate-900'
          }`}
        >
          With Goals
        </button>

        <button
          onClick={() => { setFilter('reflections'); setPage(1); }}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-lg border transition-colors ${
            filter === 'reflections'
              ? 'bg-brand-600 text-white border-brand-500'
              : 'text-slate-400 hover:text-white border-slate-800 hover:bg-slate-900'
          }`}
        >
          With Reflections
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Main Content List */}
      <div className="mt-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400 mb-3" />
            <p className="text-sm font-medium">Loading Focus Journal...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300">No Reflections Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Add reflections and session intentions to build your personal Focus Journal log.
            </p>
            <button
              onClick={onNewSession}
              className="text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg shadow-md shadow-brand-600/20 transition-all hover:scale-105"
            >
              Start Focus Session
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {entries.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 transition-all shadow-lg flex flex-col space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(item.startedAt)}</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs font-medium text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDuration(item.durationSeconds)}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      +{item.focusPoints} pts
                    </span>
                    {item.longestDeepWorkSec > 0 && (
                      <span className="text-[11px] font-mono text-slate-300 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                        {Math.round(item.longestDeepWorkSec / 60)}m deep
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-2 text-xs">
                  {item.goalText && (
                    <div>
                      <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">Goal</span>
                      <p className="text-slate-200 font-medium">{item.goalText}</p>
                    </div>
                  )}

                  {item.intention && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Session Intention</span>
                      <p className="text-slate-200 italic mt-0.5">"{item.intention}"</p>
                    </div>
                  )}

                  {(item.workedWell || item.gotInTheWay || item.notes) ? (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-900 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Reflection</span>
                      {item.workedWell && (
                        <div>
                          <strong className="text-emerald-400 font-semibold block text-[11px]">Worked Well:</strong>
                          <p className="text-slate-300">{item.workedWell}</p>
                        </div>
                      )}
                      {item.gotInTheWay && (
                        <div>
                          <strong className="text-rose-400 font-semibold block text-[11px]">Got In The Way:</strong>
                          <p className="text-slate-300">{item.gotInTheWay}</p>
                        </div>
                      )}
                      {item.notes && (
                        <div>
                          <strong className="text-brand-300 font-semibold block text-[11px]">Notes:</strong>
                          <p className="text-slate-300">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No reflection written for this session yet.</p>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                    <span>Edit Reflection</span>
                  </button>

                  <button
                    onClick={() => onSelectSession && onSelectSession(item)}
                    className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <span>View Session</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous Page
            </button>

            <span className="text-slate-400">
              Page <strong className="text-white">{page}</strong> of <strong className="text-white">{pagination.totalPages}</strong>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasMore}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Page
            </button>
          </div>
        )}
      </div>

      {/* Edit Reflection Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Session Reflection</h3>
              <button
                onClick={() => setEditingSession(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveJournalEdit} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
                  <label htmlFor="editIntention">Session Intention</label>
                  <span className="text-[10px] font-mono text-slate-500">{editIntention.length} / 300</span>
                </div>
                <textarea
                  id="editIntention"
                  value={editIntention}
                  onChange={(e) => setEditIntention(e.target.value.slice(0, 300))}
                  placeholder="What did you plan to accomplish?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
                  <label htmlFor="editWorkedWell">What went well?</label>
                  <span className="text-[10px] font-mono text-slate-500">{editWorkedWell.length} / 500</span>
                </div>
                <textarea
                  id="editWorkedWell"
                  value={editWorkedWell}
                  onChange={(e) => setEditWorkedWell(e.target.value.slice(0, 500))}
                  placeholder="What helped you stay focused?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
                  <label htmlFor="editGotInTheWay">What got in the way?</label>
                  <span className="text-[10px] font-mono text-slate-500">{editGotInTheWay.length} / 500</span>
                </div>
                <textarea
                  id="editGotInTheWay"
                  value={editGotInTheWay}
                  onChange={(e) => setEditGotInTheWay(e.target.value.slice(0, 500))}
                  placeholder="What distracted or interrupted you?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
                  <label htmlFor="editNotes">Notes</label>
                  <span className="text-[10px] font-mono text-slate-500">{editNotes.length} / 1000</span>
                </div>
                <textarea
                  id="editNotes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value.slice(0, 1000))}
                  placeholder="Additional personal notes or thoughts..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-600/20 transition-all disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Reflection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
