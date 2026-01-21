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
                {/* Premium Logo Design */}
                <div className="relative w-28 h-28 mx-auto mb-8 group cursor-default">
                    {/* Ambient Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    {/* Main Card */}
                    <div className="relative w-full h-full bg-gradient-to-tr from-primary-600 via-primary-500 to-emerald-400 rounded-[2rem] shadow-2xl shadow-primary-500/20 flex items-center justify-center transform transition-all duration-500 hover:scale-105 hover:rotate-2 border border-white/10 overflow-hidden">
                        
                        {/* Shine/Gloss Effects */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/5 pointer-events-none"></div>
                        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
                        
                        {/* Icon */}
                        <div className="relative z-10 drop-shadow-xl transform transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110">
                             <i className="fas fa-comment-dots text-[3.5rem] text-white"></i>
                        </div>
                    </div>

                    {/* Floating Badge */}
                    <div className="absolute -top-2 -right-2">
                         <div className="relative flex items-center justify-center w-10 h-10">
                             <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/30 animate-ping duration-1000"></span>
                             <div className="relative w-9 h-9 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center ring-4 ring-slate-50 dark:ring-slate-900">
                                 <i className="fas fa-heart text-rose-500 text-xs animate-pulse"></i>
                             </div>
                         </div>
                    </div>
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
                    placeholder="zhaojiuya"
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
    </div>
  );
};

export default Auth;