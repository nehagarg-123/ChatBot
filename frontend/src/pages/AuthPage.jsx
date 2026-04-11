import React, { useState } from 'react';
import { api } from '../lib/api';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
              <label className="block text-sm text-neutral-400 mb-1">Password</label>
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
  );
}