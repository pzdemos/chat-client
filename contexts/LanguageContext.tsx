import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Auth
    'auth.welcomeBack': 'Welcome Back',
    'auth.joinUs': 'Join Us',
    'auth.enterCredentials': 'Enter your credentials to continue',
    'auth.createAccount': 'Create an account to get started',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Sign Up',
    'auth.createAccountBtn': 'Create Account',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': "Already have an account?",
    'auth.loginSuccess': 'Login successful',
    'auth.regSuccess': 'Registration successful! Please login.',
    'auth.passMismatch': 'Passwords do not match',
    
    // Sidebar
    'sidebar.myStatus': 'My Status',
    'sidebar.searchPlaceholder': 'Search chats...',
    'sidebar.noFriends': 'No friends yet',
    'sidebar.addSomeone': 'Add someone',
    'sidebar.startConversation': 'Start conversation',
    
    // Chat Area
    'chat.welcomeTitle': 'Welcome to Chat Connect',
    'chat.welcomeDesc': 'Select a friend from the sidebar to start messaging.',
    'chat.typing': 'typing...',
    'chat.loadingHistory': 'Loading history...',
    'chat.typeMessage': 'Type a message...',
    'chat.holdRecord': 'Hold to Record',
    'chat.recording': 'Recording...',
    'chat.recalled': 'Message recalled',
    'chat.youRecalled': 'You recalled a message',
    
    // Modals & Profile
    'modal.addFriend': 'Add New Friend',
    'modal.friendRequests': 'Friend Requests',
    'modal.myProfile': 'My Profile',
    'modal.results': 'Results',
    'modal.noResults': 'No users found.',
    'modal.noRequests': 'No pending requests',
    'modal.wantsFriend': 'Wants to be friends',
    'modal.online': 'Online',
    'modal.offline': 'Offline',
    'modal.darkMode': 'Dark Mode',
    'modal.language': 'Language',
    'modal.userId': 'User ID',
    'modal.logout': 'Log Out',
    'modal.avatarUpdated': 'Avatar updated successfully',
    
    // Actions
    'action.add': 'Add',
    'action.sent': 'Request sent successfully',
    'action.accepted': 'Friend added!',
    'action.recall': 'Recall',
    'action.delete': 'Delete',
    'action.deleted': 'Message deleted',
    'action.deleteFailed': 'Failed to delete message',
    'action.failed': 'Action failed',
    'action.send': 'Send',
    'action.cancel': 'Cancel',
  },
  zh: {
    // Auth
    'auth.welcomeBack': '欢迎回来',
    'auth.joinUs': '加入我们',
    'auth.enterCredentials': '输入您的凭据以继续',
    'auth.createAccount': '创建一个新账户以开始',
    'auth.username': '用户名',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.signIn': '登录',
    'auth.signUp': '注册',
    'auth.createAccountBtn': '创建账户',
    'auth.noAccount': "还没有账户？",
    'auth.hasAccount': "已经有账户了？",
    'auth.loginSuccess': '登录成功',
    'auth.regSuccess': '注册成功！请登录。',
    'auth.passMismatch': '两次输入的密码不一致',
    
    // Sidebar
    'sidebar.myStatus': '我的状态',
    'sidebar.searchPlaceholder': '搜索聊天...',
    'sidebar.noFriends': '暂无好友',
    'sidebar.addSomeone': '添加好友',
    'sidebar.startConversation': '开始对话',
    
    // Chat Area
    'chat.welcomeTitle': '欢迎使用 Chat Connect',
    'chat.welcomeDesc': '从左侧选择好友开始聊天',
    'chat.typing': '正在输入...',
    'chat.loadingHistory': '加载历史消息...',
    'chat.typeMessage': '输入消息...',
    'chat.holdRecord': '按住 录音',
    'chat.recording': '正在录音...',
    'chat.recalled': '撤回了一条消息',
    'chat.youRecalled': '你撤回了一条消息',
    
    // Modals & Profile
    'modal.addFriend': '添加新好友',
    'modal.friendRequests': '好友请求',
    'modal.myProfile': '个人资料',
    'modal.results': '搜索结果',
    'modal.noResults': '未找到用户',
    'modal.noRequests': '暂无好友请求',
    'modal.wantsFriend': '请求添加好友',
    'modal.online': '在线',
    'modal.offline': '离线',
    'modal.darkMode': '暗黑模式',
    'modal.language': '语言设置',
    'modal.userId': '用户 ID',
    'modal.logout': '退出登录',
    'modal.avatarUpdated': '头像更新成功',
    
    // Actions
    'action.add': '添加',
    'action.sent': '请求已发送',
    'action.accepted': '已添加好友！',
    'action.recall': '撤回',
    'action.delete': '删除',
    'action.deleted': '消息已删除',
    'action.deleteFailed': '删除消息失败',
    'action.failed': '操作失败',
    'action.send': '发送',
    'action.cancel': '取消',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('zh'); // Default to Chinese

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
      setLanguageState(savedLang);
    } else {
        // Auto-detect browser language
        const browserLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
        setLanguageState(browserLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    // @ts-ignore
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};