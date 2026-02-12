import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Sparkles, Loader2, Plus, MessageSquare, ChevronLeft, ChevronRight, Pencil, X, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';
import { format, parseISO } from 'date-fns';
import { sendMessage } from '../services/api';

const SUGGESTED_PROMPTS = [
  'Create a 4-day upper/lower split for hypertrophy',
  'How should I warm up before heavy squats?',
  'What are the best exercises for building bigger shoulders?',
  'How do I break through a bench press plateau?',
  'Explain progressive overload and how to implement it',
  'Design a deload week for my current program',
];

export default function Coach() {
  const {
    chatMessages,
    addChatMessage,
    clearChatHistory,
    activeProgram,
    workoutLogs,
    getStats,
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
  } = useStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = async (message: string = input) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    addChatMessage('user', message);
    setInput('');
    setIsLoading(true);

    try {
      // Build context from user's data
      const stats = getStats();
      const context = {
        stats: {
          totalWorkouts: stats.totalWorkouts,
          currentStreak: stats.currentStreak,
          weeklyWorkouts: stats.weeklyWorkouts,
          personalRecords: stats.personalRecords.slice(0, 5),
        },
        activeProgram: activeProgram?.name,
        recentWorkouts: workoutLogs.slice(-3).map((w) => ({
          date: w.date,
          setsCompleted: w.sets.filter((s) => s.completed).length,
          duration: w.duration,
        })),
      };

      // Send to API
      const response = await sendMessage(message, context, chatMessages.slice(-10));
      addChatMessage('assistant', response);
    } catch (error) {
      console.error('Error sending message:', error);
      addChatMessage(
        'assistant',
        'I apologize, but I encountered an error. Please make sure your OpenAI API key is configured in the .env file, then restart the server.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex animate-fadeIn">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 overflow-hidden flex-shrink-0`}
      >
        <div className="w-64 h-full flex flex-col glass rounded-l-2xl border-r border-gray-800">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-gray-800">
            <button
              onClick={() => createConversation()}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative rounded-lg transition-colors ${
                    activeConversationId === conv.id
                      ? 'bg-primary-500/20 border border-primary-500/30'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  {editingId === conv.id ? (
                    <div className="flex items-center gap-1 p-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-primary-500"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-gray-400 hover:bg-gray-700 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => switchConversation(conv.id)}
                      className="w-full flex items-center gap-2 p-2 text-left"
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title}</p>
                        <p className="text-xs text-gray-500">
                          {format(parseISO(conv.updatedAt), 'MMM d')}
                        </p>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(conv.id, conv.title);
                          }}
                          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this conversation?')) {
                              deleteConversation(conv.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-gray-800 border border-gray-700 rounded-r-lg hover:bg-gray-700 transition-colors lg:hidden"
        style={{ left: sidebarOpen ? '256px' : '0' }}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors hidden lg:block"
            >
              {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Coach</h1>
              <p className="text-sm text-gray-400">Your personal fitness assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chatMessages.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear this conversation?')) {
                    clearChatHistory();
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Clear conversation"
                aria-label="Clear chat history"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 glass rounded-2xl p-4 mx-2">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ask me anything!</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              I can help you with workout programming, exercise technique, nutrition advice,
              and answer any fitness-related questions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="p-3 text-left text-sm bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors text-gray-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary-500/20 text-white'
                      : 'bg-gray-800/50'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-300 prose-strong:text-white prose-li:text-gray-300 prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {format(parseISO(message.timestamp), 'h:mm a')}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-gray-800/50 p-4 rounded-2xl">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

        {/* Input */}
        <div className="mt-4 flex gap-2 px-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about fitness..."
            rows={1}
            aria-label="Message input"
            className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors resize-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
