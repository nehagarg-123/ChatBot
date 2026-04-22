import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);

  // Check if the current URL is a password-reset link
  // e.g.  http://localhost:5173/reset-password/<token>
  const path = window.location.pathname;
  const resetMatch = path.match(/^\/reset-password\/([^/]+)$/);
  const resetToken = resetMatch ? resetMatch[1] : null;

  // Persist session across page reloads
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser  = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogin(data) {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // ── If the URL is /reset-password/:token, show that page ──────────────────
  if (resetToken) {
    return (
      <ResetPasswordPage
        token={resetToken}
        onDone={() => {
          // Redirect to home (login) after password reset
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  if (!user || !token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <ChatPage user={user} token={token} onLogout={handleLogout} />;
}
