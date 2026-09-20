import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Plus,
  Send,
  UserPlus,
  Clock,
  Check,
  CheckCheck,
  Flame,
  Trophy,
  Target,
  Sparkles,
  Coffee,
  ThumbsUp,
  AlertCircle,
  Loader2,
  ChevronLeft,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { AddBuddyModal } from '../components/AddBuddyModal';
import {
  fetchConversations,
  fetchConversation,
  sendMessage,
  markConversationRead,
  fetchBuddies,
  respondToBuddyRequest,
} from '../api/messageApi';

export function MessagesPage({ onNavigate }) {
  const { user: currentUser } = useAuth();

  // Conversations & Buddies State
  const [conversations, setConversations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversationData, setActiveConversationData] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);

  // Loading & Error States
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Composer State
  const [inputText, setInputText] = useState('');

  // Add Buddy Modal
  const [isAddBuddyOpen, setIsAddBuddyOpen] = useState(false);

  // Mobile navigation state
  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // 1. Initial Load: Conversations and Pending Requests
  const loadConversationsAndBuddies = async (selectedIdToKeep = null) => {
    setError(null);
    try {
      const [convRes, buddyRes] = await Promise.all([
        fetchConversations(),
        fetchBuddies(),
      ]);

      const convList = convRes?.conversations || [];
      const pending = buddyRes?.pendingRequests || [];

      setConversations(convList);
      setPendingRequests(pending);

      // Determine active conversation
      const targetId = selectedIdToKeep || activeConversationId || (convList.length > 0 ? convList[0].id : null);
      if (targetId && convList.some((c) => c.id === targetId)) {
        setActiveConversationId(targetId);
      } else if (convList.length > 0) {
        setActiveConversationId(convList[0].id);
      } else {
        setActiveConversationId(null);
        setActiveConversationData(null);
        setActiveMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Could not load messages. Please check your connection.');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversationsAndBuddies();
  }, []);

  // 2. Load Messages when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversationData(null);
      setActiveMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    async function loadActiveMessages() {
      try {
        const res = await fetchConversation(activeConversationId);
        if (!isMounted) return;

        setActiveConversationData(res);
        setActiveMessages(res?.messages || []);

        // Mark as read
        await markConversationRead(activeConversationId).catch(() => {});

        // Update local unreadCount for this conversation in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
          )
        );

        setTimeout(() => scrollToBottom('auto'), 50);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load messages for conversation:', err);
          setError('Failed to load conversation history.');
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    }

    loadActiveMessages();
    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // 3. Send Message Handler
  const handleSendMessage = async (textToSend = null, messageType = 'TEXT', activityMetadata = {}) => {
    const content = (textToSend !== null ? textToSend : inputText).trim();
    if (!content || !activeConversationId || isSending) return;

    setIsSending(true);
    if (textToSend === null) {
      setInputText('');
    }

    try {
      const res = await sendMessage(activeConversationId, content, messageType, activityMetadata);
      if (res?.message) {
        setActiveMessages((prev) => [...prev, res.message]);

        // Update latest snippet in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  lastMessageContent: content,
                  lastMessageAt: res.message.createdAt,
                }
              : c
          )
        );

        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Quick Action Cheer Click
  const handleQuickAction = (quickText) => {
    handleSendMessage(quickText, 'TEXT');
  };

  // Respond to Pending Buddy Request (Accept / Decline)
  const handleRespondRequest = async (requestId, action) => {
    try {
      await respondToBuddyRequest(requestId, action);
      // Reload conversations and buddies
      await loadConversationsAndBuddies();
    } catch (err) {
      console.error('Failed to respond to buddy request:', err);
      setError(err.message || 'Failed to process request.');
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.buddy?.name?.toLowerCase().includes(q);
    const userMatch = c.buddy?.username?.toLowerCase().includes(q);
    const contentMatch = c.lastMessageContent?.toLowerCase().includes(q);
    return nameMatch || userMatch || contentMatch;
  });

  // Relative Time Formatter
  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const activeBuddy = activeConversationData?.buddy;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-6rem)] flex flex-col space-y-4 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-sm shadow-cyan-950/40">
              <MessageSquare className="w-5 h-5" />
            </span>
            <span>Messages</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Stay connected. Stay focused.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsAddBuddyOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-semibold shadow-md shadow-cyan-950/30 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Focus Buddy</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Two-Column Hub Container */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-5 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl overflow-hidden shadow-2xl">
        
        {/* =========================================================
            LEFT COLUMN: CONVERSATION LIST & PENDING REQUESTS
        ========================================================= */}
        <div
          className={`md:col-span-5 lg:col-span-4 border-r border-slate-800/80 flex flex-col h-full bg-slate-950/60 ${
            showMobileChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search Box */}
          <div className="p-3.5 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search messages or buddies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          {/* Pending Requests Banner / Card */}
          {pendingRequests.length > 0 && (
            <div className="p-3 bg-cyan-950/20 border-b border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-3 h-3" />
                  <span>Pending Buddy Requests ({pendingRequests.length})</span>
                </span>
              </div>
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        {req.senderName}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        @{req.senderUsername} wants to connect
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.id, 'ACCEPT')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.id, 'DECLINE')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] font-semibold transition cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation List Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {isLoadingConversations ? (
              <div className="p-8 text-center space-y-3">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                <span className="text-xs text-slate-400 block">Loading buddies & conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">No Focus Buddies yet</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Add a Focus Buddy to stay accountable and keep each other focused.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBuddyOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-brand-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Focus Buddy</span>
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === activeConversationId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveConversationId(c.id);
                      setShowMobileChat(true);
                    }}
                    className={`w-full p-3.5 text-left flex items-start space-x-3 transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <UserAvatar user={c.buddy} size="md" roundedFull />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {c.buddy?.name || c.buddy?.username}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                          {formatMessageTime(c.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-slate-400 truncate pr-2">
                          {c.lastMessageContent || 'Started accountability channel'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold shrink-0">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================
            RIGHT COLUMN: ACTIVE CONVERSATION
        ========================================================= */}
        <div
          className={`md:col-span-7 lg:col-span-8 flex flex-col h-full bg-slate-950/40 ${
            showMobileChat ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeBuddy ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40 shrink-0">
                <div className="flex items-center space-x-3">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <UserAvatar user={activeBuddy} size="md" roundedFull />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-bold text-white">
                        {activeBuddy.name || activeBuddy.username}
                      </h2>
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>Focus Buddy</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      @{activeBuddy.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message History Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {isLoadingMessages ? (
                  <div className="p-8 text-center space-y-2">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
                    <span className="text-xs text-slate-500">Loading messages...</span>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Accountability Channel Ready</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Say hi to {activeBuddy.name || activeBuddy.username}! Coordinate focus sessions, celebrate milestones, and encourage each other.
                      </p>
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMe = msg.senderUserId === currentUser?.id;
                    const isActivity = msg.messageType === 'ACTIVITY';

                    if (isActivity) {
                      const meta = msg.activityMetadata || {};
                      const type = meta.type || 'SESSION_COMPLETED';
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-xs text-slate-200 shadow-lg space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-cyan-400 font-mono border-b border-slate-800 pb-1">
                              <span className="flex items-center space-x-1.5">
                                {type === 'SESSION_STARTED' && <Target className="w-3.5 h-3.5 text-cyan-400" />}
                                {type === 'SESSION_COMPLETED' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                {type === 'STREAK_MILESTONE' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                                {type === 'POINTS_MILESTONE' && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                                <span>{meta.title || 'Focus Activity'}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 lowercase font-mono">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                            isMe
                              ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-xs'
                              : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions Toolbar */}
              <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/30 flex items-center space-x-2 overflow-x-auto scrollbar-none shrink-0">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 shrink-0 mr-1">
                  Quick Cheer:
                </span>
                {[
                  { text: '🔥 Keep going!', icon: Flame },
                  { text: '🎯 Starting a session', icon: Target },
                  { text: '☕ Taking a break', icon: Coffee },
                  { text: '👏 Nice work!', icon: ThumbsUp },
                ].map((act, idx) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickAction(act.text)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0"
                    >
                      <Icon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{act.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Message Composer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/80 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end space-x-2"
                >
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type an accountability message... (Enter to send)"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none max-h-32 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="p-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white shadow-md shadow-cyan-950/30 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Select a Focus Buddy</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                  Choose a conversation on the left or add a new Focus Buddy to start exchanging encouragement and session updates.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Add Focus Buddy Modal */}
      <AddBuddyModal
        isOpen={isAddBuddyOpen}
        onClose={() => setIsAddBuddyOpen(false)}
        onBuddyAdded={() => loadConversationsAndBuddies()}
      />
    </div>
  );
}
