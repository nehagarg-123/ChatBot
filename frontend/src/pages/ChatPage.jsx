import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

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
  const [activePDF, setActivePDF] = useState(null);
  const [pendingPDF, setPendingPDF] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // ✅ Upload PDF to backend
  async function handlePDFUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      setPdfError('Only PDF files allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPdfError('File too large. Max 10MB.');
      return;
    }

    setPdfError('');
    setPdfUploading(true);

    // Show uploading message in chat
    setMessages((prev) => [...prev, {
      role: 'user',
      content: `📄 ${file.name}`
    }]);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/pdf/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setActivePDF(file.name);

      // AI acknowledges PDF
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `I've read your PDF "${file.name}" ✅. You can now ask me anything about it!`
      }]);

    } catch (err) {
      setPdfError(err.message);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `❌ Failed to upload PDF: ${err.message}`
      }]);
    } finally {
      setPdfUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ✅ File input click
  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) {
      setInput(`📄 ${file.name} — press Enter to upload`);
      setPendingPDF(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ✅ Drop on textarea only — don't upload immediately
  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || file.type !== 'application/pdf') {
      setPdfError('Only PDF files allowed.');
      return;
    }
    setInput(`📄 ${file.name} — press Enter to upload`);
    setPendingPDF(file);
  }

  // ✅ Send message or upload PDF on Enter
  async function sendMessage() {
    // If there's a pending PDF — upload it
    if (pendingPDF) {
      setInput('');
      const file = pendingPDF;
      setPendingPDF(null);
      await handlePDFUpload(file);
      return;
    }

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
        className={`${sidebarOpen ? 'w-64' : 'w-0'
          } transition-all duration-300 overflow-hidden flex flex-col bg-neutral-900 border-r border-neutral-800 flex-shrink-0`}
      >
        <div className="flex flex-col h-full p-4">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-medium transition-colors mb-4"
          >
            <span className="text-lg leading-none">+</span> New Chat
          </button>

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

          {/* User info */}
          <div className="mt-4 pt-4 border-t border-neutral-800">
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

          {/* Active PDF badge */}
          {activePDF && (
            <div className="ml-auto flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-full px-3 py-1">
              <span className="text-green-400 text-xs">📄</span>
              <span className="text-green-400 text-xs truncate max-w-[150px]">{activePDF}</span>
              <button
                onClick={async () => {
                  await fetch(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/pdf/clear`,
                    {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );
                  setActivePDF(null);
                  setPendingPDF(null);
                  setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: '🗑️ PDF removed. Upload a new one anytime.'
                  }]);
                }}
                className="text-green-600 hover:text-red-400 transition-colors text-xs ml-1"
              >
                ✕
              </button>
            </div>
          )}
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-neutral-300">
                Welcome to Neha's ChatGPT! 
              </h2>
              <h2 className="text-xl font-semibold text-neutral-300">
                How can I help you today?
              </h2>

              <p className="text-neutral-600 text-sm mt-2">
                Ask anything or upload a PDF using the 📎 button below
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

        {/* ── Input box ── */}
        <div className="px-4 pb-4 max-w-3xl mx-auto w-full">

          {pdfError && (
            <p className="text-red-400 text-xs mb-2 text-center">{pdfError}</p>
          )}

          <div className="bg-neutral-800 rounded-2xl border border-neutral-700 focus-within:border-neutral-500 transition-colors">

            {/* PDF uploading indicator */}
            {pdfUploading && (
              <div className="flex items-center gap-2 px-4 pt-3">
                <div className="w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">Uploading PDF...</span>
              </div>
            )}

            {/* ✅ Textarea with drag support */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // If user clears input manually — cancel pending PDF
                if (!e.target.value.trim()) setPendingPDF(null);
              }}
              onKeyDown={handleKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              placeholder={
                activePDF
                  ? `Ask about "${activePDF}" or anything else...`
                  : 'Message ChatGPT... (📎 to upload PDF or drag & drop here)'
              }
              rows={2}
              className="w-full resize-none bg-transparent outline-none text-sm text-white placeholder-neutral-600 px-4 pt-3 pb-1"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-3 pb-3 pt-1">

              {/* Left — PDF button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pdfUploading}
                  title="Upload PDF"
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors text-sm px-2 py-1 rounded-lg hover:bg-neutral-700 disabled:opacity-40"
                >
                  <span className="text-base">📎</span>
                  <span className="text-xs">PDF</span>
                </button>

                {/* Pending PDF indicator */}
                {pendingPDF && (
                  <span className="text-xs text-yellow-400">
                    ⏳ Press Enter to upload
                  </span>
                )}

                {/* Active PDF name */}
                {activePDF && !pendingPDF && (
                  <span className="text-xs text-green-400 truncate max-w-[120px]">
                    📄 {activePDF}
                  </span>
                )}
              </div>

              {/* Right — Send/Upload button */}
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && !pendingPDF) || loading || pdfUploading}
                className="bg-white text-neutral-900 font-semibold text-sm px-4 py-1.5 rounded-full hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {pdfUploading ? '...' : pendingPDF ? 'Upload' : loading ? '...' : 'Ask'}
              </button>
            </div>
          </div>

          <p className="text-center text-neutral-700 text-xs mt-2">
            Enter to send · Shift+Enter for new line · 📎 or drag PDF here | NEHA GARG
          </p>
        </div>
      </div>
    </div>
  );
}
