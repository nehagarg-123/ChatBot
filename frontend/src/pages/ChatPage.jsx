import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import PDFUpload from '../components/PDFUpload';

function generateThreadId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-3`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-neutral-700 text-white rounded-br-sm'
            : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function ThreadItem({ thread, active, onSelect, onDelete }) {
  return (
    <div
      onClick={() => onSelect(thread.threadId)}
      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
        active ? 'bg-neutral-700' : 'hover:bg-neutral-800'
      }`}
    >
      <span className="text-sm text-neutral-300 truncate flex-1">{thread.title || 'New Chat'}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(thread.threadId); }}
        className="opacity-0 group-hover:opacity-100 ml-2 text-neutral-500 hover:text-red-400 transition-all text-xs"
      >
        ✕
      </button>
    </div>
  );
}

export default function ChatPage({ user, token, onLogout }) {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePDF, setActivePDF] = useState(null); // ✅ track uploaded PDF
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { loadThreads(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function loadThreads() {
    try {
      const data = await api.getThreads(token);
      setThreads(data.threads);
    } catch { }
  }

  async function selectThread(threadId) {
    setActiveThreadId(threadId);
    try {
      const data = await api.getThread(token, threadId);
      setMessages(data.thread.messages);
    } catch {
      setMessages([]);
    }
  }

  function newChat() {
    setActiveThreadId(generateThreadId());
    setMessages([]);
  }

  async function deleteThread(threadId) {
    try {
      await api.deleteThread(token, threadId);
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch { }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    let threadId = activeThreadId;
    if (!threadId) {
      threadId = generateThreadId();
      setActiveThreadId(threadId);
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const data = await api.sendMessage(token, { message: text, threadId });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      loadThreads();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 overflow-hidden flex flex-col bg-neutral-900 border-r border-neutral-800 flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 flex flex-col flex-1 overflow-hidden">
            {/* New Chat */}
            <button
              onClick={newChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-medium transition-colors mb-4"
            >
              <span className="text-lg leading-none">+</span> New Chat
            </button>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {threads.length === 0 ? (
                <p className="text-neutral-600 text-xs text-center mt-6">No conversations yet</p>
              ) : (
                threads.map((t) => (
                  <ThreadItem
                    key={t.threadId}
                    thread={t}
                    active={activeThreadId === t.threadId}
                    onSelect={selectThread}
                    onDelete={deleteThread}
                  />
                ))
              )}
            </div>
          </div>

          {/* ✅ PDF Upload section */}
          <PDFUpload
            token={token}
            onUploadSuccess={(filename) => {
              setActivePDF(filename);
            }}
          />

          {/* User info + logout */}
          <div className="px-4 py-4 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-neutral-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="text-xs text-neutral-500 hover:text-red-400 transition-colors ml-2"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-neutral-400 hover:text-white transition-colors p-1"
          >
            ☰
          </button>
          <h1 className="font-semibold text-base">ChatGPT</h1>
          {/* ✅ Show PDF badge in header if PDF is uploaded */}
          {activePDF && (
            <span className="ml-auto text-xs bg-green-900/40 text-green-400 border border-green-800 px-2 py-1 rounded-full truncate max-w-[200px]">
              📄 {activePDF}
            </span>
          )}
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-neutral-300">How can I help you today?</h2>
              <p className="text-neutral-600 text-sm mt-2">
                {activePDF
                  ? `Ask me anything about "${activePDF}" or any other question.`
                  : 'Ask me anything — I can search the web or chat with your PDF.'}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex justify-start my-3">
              <div className="bg-neutral-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </main>

        {/* Input */}
        <div className="px-4 pb-4 max-w-3xl mx-auto w-full">
          <div className="bg-neutral-800 rounded-2xl p-2 border border-neutral-700 focus-within:border-neutral-500 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activePDF ? `Ask about "${activePDF}" or anything else...` : 'Message ChatGPT...'}
              rows={2}
              className="w-full resize-none bg-transparent outline-none text-sm text-white placeholder-neutral-600 px-2 py-1"
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-white text-neutral-900 font-semibold text-sm px-4 py-1.5 rounded-full hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? '...' : 'Ask'}
              </button>
            </div>
          </div>
          <p className="text-center text-neutral-700 text-xs mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}