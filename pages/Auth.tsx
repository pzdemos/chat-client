import React, { useState } from 'react';
import { apiClient } from '../services/api';
import { AuthResponse } from '../types';
import { Button, Input } from '../components/ui';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface AuthProps {
  onLogin: (user: AuthResponse) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { showToast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && formData.password !== formData.confirmPassword) {
      showToast(t('auth.passMismatch'), 'error');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data } = await apiClient.post<AuthResponse>('users/login', {
          username: formData.username,
          password: formData.password
        });
        localStorage.setItem('chatUser', JSON.stringify(data));
        showToast(t('auth.loginSuccess'), 'success');
        onLogin(data);
      } else {
        await apiClient.post('users', {
            username: formData.username,
            password: formData.password,
            age: 18 // Default
        });
        setIsLogin(true);
        showToast(t('auth.regSuccess'), 'success');
        setFormData({ username: '', password: '', confirmPassword: '' });
      }
    } catch (err: any) {
      showToast(err.message || "Authentication failed", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-300">
        {/* Top Right Switchers */}
        <div className="absolute top-4 right-4 flex items-center space-x-3 z-30">
            <button 
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
                title="Switch Language"
            >
                <span className="text-xs font-bold">{language === 'zh' ? '中' : 'EN'}</span>
            </button>
            <button 
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
                title="Toggle Theme"
            >
                <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'} text-sm`}></i>
            </button>
        </div>

        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800/20 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-slow" style={{animationDelay: '1s'}}></div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-md relative z-10 animate-slide-up border border-white/20 dark:border-slate-800">
            {/* Header / Logo Animation */}
            <div className="text-center mb-8">
                <div className="relative w-24 h-24 mx-auto mb-4">
                    {/* Main Bubble */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-[28px] shadow-xl shadow-primary-500/30 flex items-center justify-center transform transition-transform hover:scale-105 duration-300" style={{ animation: 'float 6s ease-in-out infinite' }}>
                        <i className="fas fa-comment-alt text-4xl text-white opacity-90"></i>
                    </div>
                    {/* Secondary Bouncing Bubble */}
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
                        <i className="fas fa-heart text-red-500 text-sm"></i>
                    </div>
                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-primary-400 blur-2xl opacity-20 -z-10 animate-pulse"></div>
                </div>
                
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    {isLogin ? t('auth.welcomeBack') : t('auth.joinUs')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    {isLogin ? t('auth.enterCredentials') : t('auth.createAccount')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <Input 
                    label={t('auth.username')} 
                    icon="fa-user" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    placeholder="johndoe"
                    required
                />
                <Input 
                    label={t('auth.password')} 
                    type="password" 
                    icon="fa-lock" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    required
                />
                {!isLogin && (
                    <Input 
                        label={t('auth.confirmPassword')} 
                        type="password" 
                        icon="fa-lock" 
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        placeholder="••••••••"
                        required
                    />
                )}

                <Button type="submit" className="w-full !py-3 !text-base" isLoading={loading}>
                    {isLogin ? t('auth.signIn') : t('auth.createAccountBtn')}
                </Button>
            </form>

            <div className="mt-8 text-center pt-6 border-t border-slate-200 dark:border-slate-800">
                <p className="text-slate-600 dark:text-slate-400">
                    {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
                    <button 
                        onClick={() => { setIsLogin(!isLogin); }}
                        className="ml-2 font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                    >
                        {isLogin ? t('auth.signUp') : t('auth.signIn')}
                    </button>
                </p>
            </div>
        </div>
        
        {/* Inline style for float animation since we can't easily edit index.html for custom keyframes right now without adding global css */}
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
        `}} />
    </div>
  );
};

export default Auth;