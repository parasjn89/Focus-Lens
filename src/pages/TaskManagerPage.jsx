import React, { useState, useEffect, useRef } from 'react';
import {
  CheckSquare, Search, Plus, Filter, Check, Trash2, Edit3,
  Calendar, Clock, X, ChevronDown, Sparkles, Play, SlidersHorizontal,
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { fetchTasks, createTask, updateTask, deleteTask } from '../api/taskApi';

const CATEGORIES = ['All Work', 'Study', 'Coding', 'Other'];

export function TaskManagerPage({ onStartSession }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Work');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  
  // Modal state (for create and edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    category: 'Study',
    description: '',
    dueDate: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active swiped row ID
  const [swipedTaskId, setSwipedTaskId] = useState(null);

  // Touch tracking references
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);
  const dropdownRef = useRef(null);

  // Load tasks on mount and when category changes
  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTasks({
        category: selectedCategory === 'All Work' ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
      });
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [selectedCategory]);

  // Click outside to close filter dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter tasks client-side for immediate responsive search
  const filteredTasks = tasks.filter((task) => {
    const matchesCategory =
      selectedCategory === 'All Work' || task.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    return matchesCategory && matchesSearch;
  });

  const completedCount = filteredTasks.filter((t) => t.completed).length;
  const totalCount = filteredTasks.length;

  // Toggle task completion
  const handleToggleComplete = async (task, e) => {
    e?.stopPropagation();
    const nextCompleted = !task.completed;
    
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t))
    );

    try {
      await updateTask(task.id, { completed: nextCompleted });
    } catch (err) {
      console.error('Failed to toggle task completion:', err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t))
      );
    }
  };

  // Open modal for new task
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      category: selectedCategory !== 'All Work' ? selectedCategory : 'Study',
      description: '',
      dueDate: '',
    });
    setFormError('');
    setIsModalOpen(true);
    setSwipedTaskId(null);
  };

  // Open modal for edit task
  const handleOpenEditModal = (task, e) => {
    e?.stopPropagation();
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      category: task.category || 'Other',
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
    });
    setFormError('');
    setIsModalOpen(true);
    setSwipedTaskId(null);
  };

  // Delete task
  const handleDeleteTask = async (taskId, e) => {
    e?.stopPropagation();
    // Optimistic UI update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSwipedTaskId(null);

    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadTasks();
    }
  };

  // Save task (create or edit)
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      setFormError('Task title is required');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingTask) {
        const res = await updateTask(editingTask.id, {
          title: taskForm.title.trim(),
          category: taskForm.category,
          description: taskForm.description.trim() || null,
          dueDate: taskForm.dueDate || null,
        });
        if (res?.task) {
          setTasks((prev) =>
            prev.map((t) => (t.id === editingTask.id ? res.task : t))
          );
        }
      } else {
        const res = await createTask({
          title: taskForm.title.trim(),
          category: taskForm.category,
          description: taskForm.description.trim() || null,
          dueDate: taskForm.dueDate || null,
        });
        if (res?.task) {
          setTasks((prev) => [res.task, ...prev]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (taskId, e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (taskId, e) => {
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = (taskId) => {
    const delta = touchDeltaXRef.current;
    if (delta < -40) {
      // Swiped left: reveal actions
      setSwipedTaskId(taskId);
    } else if (delta > 40) {
      // Swiped right: hide actions
      if (swipedTaskId === taskId) {
        setSwipedTaskId(null);
      }
    }
  };

  // Toggle slide on desktop via handle
  const handleToggleSlide = (taskId, e) => {
    e.stopPropagation();
    setSwipedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Study':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Coding':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    }
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Home</span>
            <span>/</span>
            <span className="text-cyan-400 font-medium">Tasks</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              My Tasks
            </h1>
            {totalCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 ml-1">
                {completedCount}/{totalCount} completed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Organize, prioritize, and track your focus targets across study, coding, and projects.
          </p>
        </div>

        {/* NEW TASK BUTTON */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 text-xs font-semibold bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white px-4 py-2 rounded-xl shadow-md shadow-cyan-950/30 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* 2. CONTROLS BAR: SEARCH + ALL WORK FILTER + FILTER DROPDOWN */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or notes..."
            className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
          {/* Quick "All Work" Pill */}
          <button
            type="button"
            onClick={() => setSelectedCategory('All Work')}
            className={`text-xs font-medium px-3 py-2 rounded-xl border transition cursor-pointer ${
              selectedCategory === 'All Work'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/20'
                : 'bg-slate-900/60 text-slate-400 border-slate-800/80 hover:text-white hover:border-slate-700'
            }`}
          >
            All Work
          </button>

          {/* Filter Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
              className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition cursor-pointer ${
                selectedCategory !== 'All Work'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800/80 hover:text-white hover:border-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{selectedCategory !== 'All Work' ? selectedCategory : 'Filter'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180 text-cyan-400' : 'text-slate-500'}`} />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-navy-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/60 mb-1">
                  Filter by Category
                </div>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition ${
                        isSelected
                          ? 'bg-cyan-500/10 text-cyan-300 font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <span>{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TASK LIST WITH SWIPE / SLIDE INTERACTION */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-500">Loading your tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl border border-dashed border-slate-800 bg-navy-950/40 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-300">
              {searchQuery || selectedCategory !== 'All Work' ? 'No matching tasks found' : 'No tasks created yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchQuery || selectedCategory !== 'All Work'
                ? 'Try adjusting your search query or category filter.'
                : 'Create your first task to start planning focus sessions and tracking milestones.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition cursor-pointer mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isMenuOpen = swipedTaskId === task.id;
            const dueDateFormatted = formatDueDate(task.dueDate);

            return (
              <div
                key={task.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-md shadow-sm hover:border-slate-700/80 transition-all duration-200 p-3.5 sm:p-4 flex items-center justify-between gap-3 relative"
              >
                {/* LEFT: Checkbox + Title + Description + Badges */}
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleComplete(task, e)}
                    className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                        : 'border-slate-700 hover:border-cyan-500/60 bg-slate-800/60 text-transparent'
                    }`}
                    title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${task.completed ? 'block' : 'hidden'}`} />
                  </button>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4
                        className={`text-sm font-semibold transition-colors truncate ${
                          task.completed
                            ? 'line-through text-slate-500'
                            : 'text-white hover:text-cyan-300'
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Category badge */}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${getCategoryBadgeClass(
                          task.category
                        )}`}
                      >
                        {task.category || 'Other'}
                      </span>

                      {/* Optional Due Date */}
                      {dueDateFormatted && (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 shrink-0">
                          <Clock className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{dueDateFormatted}</span>
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className={`text-xs truncate max-w-xl ${task.completed ? 'text-slate-600' : 'text-slate-400'}`}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* RIGHT-SIDE ACTIONS: [Edit] [▶ Focus] [settings] */}
                <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                  {/* 1. Edit Button */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditModal(task, e)}
                    className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/70 hover:border-cyan-500/40 transition cursor-pointer shadow-sm"
                    title="Edit Task"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-400/80" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>

                  {/* 2. Focus Button */}
                  {onStartSession && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSession(task);
                      }}
                      className="flex items-center space-x-1.5 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 transition cursor-pointer shadow-sm shadow-emerald-950/20"
                      title="Focus on this task in a session"
                    >
                      <Play className="w-3 h-3 fill-emerald-400 shrink-0" />
                      <span>Focus</span>
                    </button>
                  )}

                  {/* 3. Settings / Options Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSlide(task.id, e)}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        isMenuOpen
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
                      }`}
                      title={isMenuOpen ? 'Hide Actions' : 'Task Actions / Options'}
                      aria-expanded={isMenuOpen}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover Action Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[120px] rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="w-full flex items-center space-x-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. TASK CREATION & EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  {editingTask ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTask} className="space-y-4">
              {formError && (
                <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Task Title <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Read Chapter 4 of Algorithm Design"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition"
                />
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Study', 'Coding', 'Other'].map((cat) => {
                    const isSelected = taskForm.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTaskForm({ ...taskForm, category: cat })}
                        className={`py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-950/20'
                            : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Description <span className="text-slate-500 text-[10px] font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Add details, notes, or objectives for this task..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition resize-none"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Due Date & Time <span className="text-slate-500 text-[10px] font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-xs font-medium px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white shadow-md shadow-cyan-950/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTask ? 'Save Changes' : 'Save Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
