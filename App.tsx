import React, { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Chat from './pages/Chat';
import { User } from './types';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent login
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('chatUser');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatUser');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <LanguageProvider>
        <ThemeProvider>
          <ToastProvider>
              {user ? (
                  <Chat user={user} onLogout={handleLogout} />
              ) : (
                  <Auth onLogin={handleLogin} />
              )}
          </ToastProvider>
        </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;