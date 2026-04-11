import React,{ useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Persist session across page reloads
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
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

  if (!user || !token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <ChatPage user={user} token={token} onLogout={handleLogout} />;
}