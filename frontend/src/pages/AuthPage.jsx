import React, { useState } from 'react';
import { api } from '../lib/api';

// ── Small inline components ──────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-neutral-900 inline-block"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 10h-2a8 8 0 01-8-8z"
      />
    </svg>
  );
}

// ── Forgot Password Modal ────────────────────────────────────────────────────

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail]       = useState('');
  const [status, setStatus]     = useState('idle'); // idle | loading | success | error
  const [message, setMessage]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const data = await api.forgotPassword(email);
      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-semibold text-lg">Forgot password?</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-neutral-400 text-sm mb-6">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {status === 'success' ? (
          <div className="text-center space-y-4">
            {/* Success icon */}
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400 text-sm">{message}</p>
            <p className="text-neutral-500 text-xs">Check your spam folder if you don't see it.</p>
            <button
              onClick={onClose}
              className="w-full bg-white text-neutral-900 font-semibold py-2.5 rounded-xl hover:bg-neutral-200 transition-colors text-sm"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setMessage(''); }}
                placeholder="you@example.com"
                required
                className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm bg-red-950/40 rounded-lg px-3 py-2">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-white text-neutral-900 font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-neutral-500 hover:text-white text-sm py-1 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main Auth Page ───────────────────────────────────────────────────────────

export default function AuthPage({ onLogin }) {
  const [mode, setMode]               = useState('login'); // 'login' | 'register'
  const [form, setForm]               = useState({ name: '', email: '', password: '' });
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showForgot, setShowForgot]   = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Forgot Password Modal ── */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">ChatGPT</h1>
            <p className="text-neutral-400 mt-2 text-sm">Your AI-powered assistant</p>
          </div>

          <div className="bg-neutral-900 rounded-2xl p-8 shadow-xl border border-neutral-800">
            {/* Tabs */}
            <div className="flex rounded-xl bg-neutral-800 p-1 mb-6">
              {['login', 'register'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                    mode === m
                      ? 'bg-white text-neutral-900'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    required
                    className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
                />
              </div>

              <div>
                {/* Password label row with "Forgot password?" link */}
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-neutral-400">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-neutral-900 font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
