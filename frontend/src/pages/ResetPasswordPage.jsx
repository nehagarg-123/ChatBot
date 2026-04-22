import React, { useState } from 'react';
import { api } from '../lib/api';

export default function ResetPasswordPage({ token, onDone }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [status, setStatus]       = useState('idle'); // idle | loading | success | error
  const [message, setMessage]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const data = await api.resetPassword(token, password);
      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
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
          {status === 'success' ? (
            <div className="text-center space-y-5">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white font-semibold text-lg">Password updated!</h2>
              <p className="text-neutral-400 text-sm">{message}</p>
              <button
                onClick={onDone}
                className="w-full bg-white text-neutral-900 font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-white font-semibold text-lg mb-1">Set a new password</h2>
                <p className="text-neutral-400 text-sm">Choose a strong password with at least 6 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setMessage(''); }}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setMessage(''); }}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-neutral-800 text-white rounded-xl px-4 py-3 text-sm outline-none border border-neutral-700 focus:border-neutral-500 transition-colors placeholder-neutral-600"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-red-400 text-sm bg-red-950/40 rounded-lg px-3 py-2">{message}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-white text-neutral-900 font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'Updating…' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={onDone}
                  className="w-full text-neutral-500 hover:text-white text-sm py-1 transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
