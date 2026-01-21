import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { User, Friend, Message, FriendRequest } from '../types';
import { apiClient, getSocket, normalizeImageUrl } from '../services/api';
import { Avatar, Button, Input } from '../components/ui';
import { Modal } from '../components/Modal';
import { MessageBubble } from '../components/MessageBubble';
import { useToast } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { VoiceRecorder } from '../components/VoiceRecorder';

interface ChatProps {
  user: User;
  onLogout: () => void;
}

const Chat: React.FC<ChatProps> = ({ user, onLogout }) => {
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  
  // Socket & Data
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeChat, setActiveChat] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI Inputs & States
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  
  // Dynamic Viewport Height for iOS Keyboard
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  
  // Voice Recording (New Overlay State)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Typing Logic Refs
  const senderTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 发送端：用于检测停止输入
  const receiverTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 接收端：用于防止状态卡死

  // --- iOS Viewport Fix ---
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        // 直接使用 visualViewport 的高度，这在键盘弹出时会自动减去键盘高度
        setViewportHeight(`${window.visualViewport.height}px`);
        
        // 关键修复：强制将页面滚动回顶部，防止 iOS 键盘把整个 body 往上推导致 header 消失
        window.scrollTo(0, 0);
      } else {
        // Fallback for browsers without visualViewport API (rare nowadays)
        setViewportHeight(`${window.innerHeight}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize); // 有时 iOS 会触发 scroll 而不是 resize
    }
    window.addEventListener('resize', handleVisualViewportResize);

    // Initial calculation
    handleVisualViewportResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      window.removeEventListener('resize', handleVisualViewportResize);
    };
  }, []);

  // --- Initial Setup ---
  useEffect(() => {
    const newSocket = getSocket(user.userId);
    setSocket(newSocket);

    const handleConnect = () => {
        newSocket.emit('join', user.userId);
        refreshData();
    };

    const handleReceiveMessage = (msg: Message) => {
        if (activeChat && (msg.fromUserId === activeChat.userId || msg.toUserId === activeChat.userId)) {
            // 收到消息时，立即停止显示正在输入
            setIsTyping(false);
            if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);

            setMessages(prev => {
                if (prev.some(m => m._id === msg._id)) return prev;

                if (msg.fromUserId === user.userId) {
                    const optimisticIndex = prev.findIndex(m => 
                        m.content === msg.content && 
                        m.messageType === msg.messageType &&
                        (m._id?.length || 0) < 20 
                    );

                    if (optimisticIndex !== -1) {
                        const optimisticMsg = prev[optimisticIndex];
                        const t1 = new Date(optimisticMsg.timestamp).getTime();
                        const t2 = new Date(msg.timestamp).getTime();
                        if (Math.abs(t1 - t2) < 5000) {
                             const newMessages = [...prev];
                             newMessages[optimisticIndex] = { ...optimisticMsg, ...msg, status: 'sent', _id: msg._id };
                             return newMessages;
                        }
                    }
                }
                return [...prev, msg];
            });
            
            if (msg.fromUserId === activeChat.userId) {
                newSocket.emit('markAsRead', { userId: user.userId, friendUserId: activeChat.userId });
            }
        }
        refreshFriends(); 
    };

    const handleMessageSent = (data: Message) => {
        setMessages(prev => prev.map(msg => {
            if (msg.fromUserId === user.userId && msg.content === data.content && (msg._id?.length || 0) < 20) {
                const timeDiff = Math.abs(new Date(data.timestamp).getTime() - new Date(msg.timestamp).getTime());
                if (timeDiff < 5000) {
                    return { ...msg, _id: data._id, timestamp: data.timestamp, status: 'sent' };
                }
            }
            return msg;
        }));
    };

    const handleMessageRecalled = (data: { messageId: string }) => {
        setMessages(prev => prev.map(msg => 
            msg._id === data.messageId ? { ...msg, isRecalled: true } : msg
        ));
        refreshFriends(); 
    };

    const handleMessageDeleted = (data: { messageId: string; deletedBy: string; deletedAt: string }) => {
        setMessages(prev => prev.map(msg => 
            msg._id === data.messageId 
            ? { ...msg, deletedBy: [...(msg.deletedBy || []), { userId: data.deletedBy, deletedAt: data.deletedAt }] }
            : msg
        ));
    };

    const handleRecallError = (data: { message: string }) => {
        showToast(data.message || t('action.failed'), 'error');
    };

    const handleNewRequest = () => {
        showToast(t('modal.friendRequests'), 'info');
        refreshRequests();
    };

    const handleRequestAccepted = () => {
        showToast(t('action.accepted'), 'success');
        refreshRequests();
        refreshFriends();
    };
    
    const handleMessagesRead = (data: { byUserId: string }) => {
        if (activeChat && activeChat.userId === data.byUserId) {
             setMessages(prev => prev.map(m => m.fromUserId === user.userId ? { ...m, isRead: true } : m));
        }
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('receiveMessage', handleReceiveMessage);
    newSocket.on('messageSent', handleMessageSent);
    newSocket.on('messageRecalled', handleMessageRecalled);
    newSocket.on('recallError', handleRecallError);
    newSocket.on('messageDeleted', handleMessageDeleted);
    newSocket.on('messagesRead', handleMessagesRead);
    newSocket.on('newFriendRequest', handleNewRequest);
    newSocket.on('friendRequestAccepted', handleRequestAccepted);
    
    // --- Typing Logic (Receiver Side) ---
    newSocket.on('userTyping', ({ fromUserId }) => {
        if (activeChat?.userId === fromUserId) {
            setIsTyping(true);
            
            // 安全机制：清除旧的接收端定时器，设置新的定时器
            // 如果 5 秒内没有收到新的 typing 事件或 stopTyping 事件，自动隐藏
            if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
            receiverTypingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
            }, 5000);
        }
    });

    newSocket.on('userStopTyping', ({ fromUserId }) => {
        if (activeChat?.userId === fromUserId) {
            setIsTyping(false);
            if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
        }
    });

    if (newSocket.connected) handleConnect();

    return () => {
        newSocket.off('connect', handleConnect);
        newSocket.off('receiveMessage', handleReceiveMessage);
        newSocket.off('messageSent', handleMessageSent);
        newSocket.off('messageRecalled', handleMessageRecalled);
        newSocket.off('recallError', handleRecallError);
        newSocket.off('messageDeleted', handleMessageDeleted);
        newSocket.off('messagesRead', handleMessagesRead);
        newSocket.off('newFriendRequest', handleNewRequest);
        newSocket.off('friendRequestAccepted', handleRequestAccepted);
        newSocket.off('userTyping');
        newSocket.off('userStopTyping');
    };
  }, [user.userId, activeChat]); 

  // --- Restore Chat from URL ---
  useEffect(() => {
    if (friends.length > 0 && !activeChat) {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chatId');
        
        if (chatId) {
            const friend = friends.find(f => f.userId === chatId);
            if (friend) {
                // Determine if we should replace URL or push (on first load usually replace is cleaner, but push is fine)
                selectChat(friend, false); 
            }
        }
    }
  }, [friends]); // Only run when friends list loads

  const scrollToBottom = (instant = false) => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ 
              behavior: instant ? 'auto' : 'smooth', 
              block: 'end' 
          });
      }, 50);
  };

  useEffect(() => {
      if (messages.length > 0) {
          scrollToBottom();
      }
  }, [messages.length, activeChat]);

  useEffect(() => {
    const handleResize = () => {
        if (activeChat) scrollToBottom(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeChat]);

  const refreshData = () => {
    refreshFriends();
    refreshRequests();
  };

  const refreshFriends = async () => {
    try {
        const { data } = await apiClient.get<Friend[]>(`friends/list/${user.userId}`);
        setFriends(data);
    } catch (error) { console.error(error); }
    finally { setIsLoadingFriends(false); }
  };

  const refreshRequests = async () => {
    try {
        const { data } = await apiClient.get<FriendRequest[]>(`friends/requests/${user.userId}`);
        setFriendRequests(data);
    } catch (error) { console.error(error); }
  };

  const selectChat = async (friend: Friend, updateUrl = true) => {
      // Update URL logic with Safe Handling
      if (updateUrl) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('chatId', friend.userId);
            window.history.pushState({}, '', '?' + url.searchParams.toString());
        } catch (e) {
            console.warn('URL update restricted in this environment');
        }
      }

      // 切换聊天时，重置所有输入状态
      if (senderTypingTimeoutRef.current) clearTimeout(senderTypingTimeoutRef.current);
      if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
      if (socket && activeChat) {
          // 切换前通知旧的聊天对象停止输入
          socket.emit('stopTyping', { fromUserId: user.userId, toUserId: activeChat.userId });
      }
      setIsTyping(false);
      setInputText('');

      setActiveChat(friend);
      setMessages([]);
      setIsLoading(true);
      
      setFriends(prev => prev.map(f => f.userId === friend.userId ? { ...f, unreadCount: 0 } : f));

      try {
          const { data } = await apiClient.get(`messages/history/${user.userId}/${friend.userId}?limit=50`);
          setMessages(data.messages || []);
          socket?.emit('markAsRead', { userId: user.userId, friendUserId: friend.userId });
          setTimeout(() => scrollToBottom(true), 50);
      } catch (error) {
          showToast('Failed to load messages', 'error');
      } finally {
          setIsLoading(false);
      }
  };

  const handleBackToFriends = () => {
      setActiveChat(null);
      // Clear URL parameter safely
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('chatId');
        window.history.pushState({}, '', '?' + url.searchParams.toString());
      } catch (e) {
        console.warn('URL update restricted in this environment');
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setInputText(text);

      if (!activeChat || !socket) return;

      // 只有当有内容时才发送 typing
      if (text.length > 0) {
          socket.emit('typing', { fromUserId: user.userId, toUserId: activeChat.userId });
          
          // 清除之前的停止计时器
          if (senderTypingTimeoutRef.current) clearTimeout(senderTypingTimeoutRef.current);

          // 设置新的停止计时器 (2秒后如果不继续输入，则发送停止)
          senderTypingTimeoutRef.current = setTimeout(() => {
              socket.emit('stopTyping', { fromUserId: user.userId, toUserId: activeChat.userId });
          }, 2000);
      } else {
          // 内容为空，立即停止
          if (senderTypingTimeoutRef.current) clearTimeout(senderTypingTimeoutRef.current);
          socket.emit('stopTyping', { fromUserId: user.userId, toUserId: activeChat.userId });
      }
  };

  const sendMessage = () => {
      if (!inputText.trim() || !activeChat || !socket) return;
      
      // 发送消息时立即停止 typing 状态
      if (senderTypingTimeoutRef.current) clearTimeout(senderTypingTimeoutRef.current);
      socket.emit('stopTyping', { fromUserId: user.userId, toUserId: activeChat.userId });

      const timestamp = new Date().toISOString();
      const tempId = Math.random().toString(36).substr(2, 9);

      const msgData: Partial<Message> = {
          _id: tempId,
          fromUserId: user.userId,
          toUserId: activeChat.userId,
          content: inputText,
          messageType: 'text',
          timestamp: timestamp,
          status: 'sent'
      };

      socket.emit('sendMessage', msgData);
      
      setMessages(prev => [...prev, msgData as Message]);
      setInputText('');
      refreshFriends(); 
      scrollToBottom(true);
  };

  const handleRecallMessage = (messageId: string) => {
      if (!socket || !messageId) {
          showToast(t('action.failed'), 'error');
          return;
      }
      if (messageId.length < 20) {
          showToast('Syncing message, please try again...', 'info');
          return;
      }
      
      socket.emit('recallMessage', { 
          messageId, 
          userId: user.userId,
          targetUserId: activeChat?.userId
      });
      
      setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, isRecalled: true } : msg));
      showToast(t('chat.youRecalled'), 'success');
  };

  const handleDeleteMessage = (messageId: string) => {
      if (!socket || !messageId) return;

      if (messageId.length < 20) {
          showToast('Syncing message, please try again...', 'info');
          return;
      }
      
      socket.emit('deleteMessage', { 
          messageId, 
          userId: user.userId 
      });

      setMessages(prev => prev.map(msg => {
          if (msg._id === messageId) {
              return { 
                  ...msg, 
                  deletedBy: [...(msg.deletedBy || []), { userId: user.userId, deletedAt: new Date().toISOString() }] 
              };
          }
          return msg;
      }));
      
      showToast(t('action.deleted'), 'success');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeChat || !socket) return;

      const formData = new FormData();
      formData.append('image', file);

      try {
          const { data } = await apiClient.post('upload/image', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          const msgData: Partial<Message> = {
              fromUserId: user.userId,
              toUserId: activeChat.userId,
              content: '[Image]',
              messageType: 'image',
              imageUrl: data.imageUrl,
              timestamp: new Date().toISOString(),
              status: 'sent'
          };
          
          socket.emit('sendMessage', msgData);
          setMessages(prev => [...prev, msgData as Message]);
      } catch (error) {
          showToast('Image upload failed', 'error');
      }
  };

  // --- Voice Logic (New Overlay) ---
  const handleVoiceRecorded = async (audioBlob: Blob, duration: number) => {
      setShowVoiceRecorder(false); // Close overlay immediately
      
      if (!activeChat || !socket) return;
      
      const timestamp = new Date().toISOString();
      const localUrl = URL.createObjectURL(audioBlob);
      const tempId = Math.random().toString(36).substr(2, 9);
      
      const optimisticMsg: Partial<Message> = {
          _id: tempId,
          fromUserId: user.userId,
          toUserId: activeChat.userId,
          content: '[Voice]',
          messageType: 'voice',
          blobUrl: localUrl,
          voiceDuration: duration,
          timestamp: timestamp,
          status: 'sending'
      };
      
      setMessages(prev => [...prev, optimisticMsg as Message]);

      const formData = new FormData();
      
      // Smart extension handling based on mimeType
      const mimeType = audioBlob.type; // Trust the blob type
      let extension = '.webm'; // Default fallback
      
      // Strict checking
      if (mimeType.includes('mp4') || mimeType.includes('aac')) {
          extension = '.m4a';
      } else if (mimeType.includes('ogg')) {
          extension = '.ogg';
      } else if (mimeType.includes('wav')) {
          extension = '.wav';
      }
      
      console.log(`Uploading voice: ${mimeType} -> ${extension}`);

      const fileName = `voice-${Date.now()}${extension}`;
      formData.append('voice', new File([audioBlob], fileName, { type: mimeType }));

      try {
        const { data } = await apiClient.post('upload/voice', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const realMsgData: Partial<Message> = {
            ...optimisticMsg,
            voiceUrl: data.voiceUrl,
            status: 'sent'
        };
        
        socket.emit('sendMessage', {
            fromUserId: user.userId,
            toUserId: activeChat.userId,
            content: '[Voice]',
            messageType: 'voice',
            voiceUrl: data.voiceUrl,
            voiceDuration: duration,
            timestamp: timestamp
        });

        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, ...realMsgData } : m));
        
      } catch(e) {
          showToast('Voice upload failed', 'error');
          setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'error' } : m));
      }
  };

  const openVoiceRecorder = () => {
      // Blur input to close keyboard on mobile
      if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
      }
      setShowVoiceRecorder(true);
  };

  // --- Friend Management ---

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
        // Updated API call to match backend path parameter requirement
        const { data } = await apiClient.get<User[]>(`users/search/${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.filter(u => u.userId !== user.userId));
    } catch (error) {
        setSearchResults([]);
        showToast(t('modal.noResults'), 'info');
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    try {
        await apiClient.post('friends/request', {
            fromUserId: user.userId,
            toUserId
        });
        showToast(t('action.sent'), 'success');
        setShowAddFriend(false);
        setSearchQuery('');
        setSearchResults([]);
    } catch (error: any) {
        showToast(error.message || 'Failed to send request', 'error');
    }
  };

  const respondToRequest = async (requestId: string, status: 'accept' | 'reject') => {
    try {
        await apiClient.post('friends/respond', { requestId, action: status });
        if (status === 'accept') {
            showToast(t('action.accepted'), 'success');
        }
        refreshRequests();
        refreshFriends();
    } catch (error: any) {
        showToast(error.message || 'Failed to respond', 'error');
    }
  };

  // --- Render ---

  return (
    // Changed: Use dynamic viewportHeight and removed h-[100dvh] class to fix iOS keyboard layout
    <div 
        style={{ height: viewportHeight }}
        className="w-full flex bg-white dark:bg-slate-900 overflow-hidden font-sans relative"
    >
        
        {/* LEFT SIDEBAR */}
        <div className={`
            flex-shrink-0 w-full md:w-[320px] lg:w-[360px] bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 absolute md:relative z-20 h-full
            ${activeChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}>
            {/* Sidebar Header */}
            <div className="p-4 bg-white dark:bg-slate-900 shadow-sm z-10 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div 
                        className="flex items-center space-x-3 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 -ml-2 rounded-xl transition cursor-pointer"
                        onClick={() => setShowProfile(true)}
                    >
                        <Avatar name={user.username} src={normalizeImageUrl(user.avatar)} status="online" />
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-white leading-tight">{user.username}</h2>
                            <p className="text-xs text-slate-500">{t('sidebar.myStatus')}</p>
                        </div>
                    </div>
                    <div className="flex space-x-1">
                         <button 
                            onClick={() => setShowRequests(true)} 
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 transition relative"
                        >
                            <i className="fas fa-bell"></i>
                            {friendRequests.length > 0 && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                            )}
                         </button>
                         <button 
                            onClick={() => setShowAddFriend(true)}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 transition"
                        >
                            <i className="fas fa-user-plus"></i>
                         </button>
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="relative">
                    <i className="fas fa-search absolute left-3 top-3 text-slate-400 text-sm"></i>
                    <input 
                        type="text" 
                        placeholder={t('sidebar.searchPlaceholder')}
                        className="w-full bg-slate-100 dark:bg-slate-800 text-sm rounded-xl py-2.5 pl-9 pr-4 outline-none focus:ring-2 focus:ring-primary-500/50 dark:text-white"
                    />
                </div>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {isLoadingFriends ? (
                     Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center p-3 rounded-xl animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0"></div>
                            <div className="ml-3 flex-1 min-w-0 py-1 space-y-2">
                                <div className="flex justify-between">
                                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
                                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-10"></div>
                                </div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                            </div>
                        </div>
                     ))
                ) : friends.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                         <i className="fas fa-user-friends text-3xl mb-2 opacity-20"></i>
                         <p className="text-sm">{t('sidebar.noFriends')}</p>
                         <Button variant="ghost" size="sm" onClick={() => setShowAddFriend(true)} className="mt-2 text-primary-500">{t('sidebar.addSomeone')}</Button>
                     </div>
                ) : (
                    friends.map(friend => (
                        <div 
                            key={friend.userId}
                            onClick={() => selectChat(friend)}
                            className={`
                                flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 group
                                ${activeChat?.userId === friend.userId 
                                    ? 'bg-slate-200 dark:bg-slate-800 shadow-inner' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-900'}
                            `}
                        >
                            <div className="relative">
                                <Avatar name={friend.username} src={normalizeImageUrl(friend.avatar)} />
                                {friend.unreadCount ? (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-slate-50 dark:border-slate-950">
                                        {friend.unreadCount > 9 ? '9+' : friend.unreadCount}
                                    </span>
                                ) : null}
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={`font-semibold truncate text-sm ${activeChat?.userId === friend.userId ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {friend.username}
                                    </h3>
                                    {friend.lastMessage && (
                                        <span className={`text-[10px] ${activeChat?.userId === friend.userId ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>
                                            {new Date(friend.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs truncate ${activeChat?.userId === friend.userId ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {friend.lastMessage ? (
                                        friend.lastMessage.messageType === 'image' ? <span><i className="fas fa-camera mr-1"></i> Photo</span> : 
                                        friend.lastMessage.messageType === 'voice' ? <span><i className="fas fa-microphone mr-1"></i> Voice</span> :
                                        friend.lastMessage.content
                                    ) : <span className="italic opacity-70">{t('sidebar.startConversation')}</span>}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className={`
            absolute inset-0 z-30 md:static md:flex-1 flex flex-col bg-white dark:bg-slate-900 transition-transform duration-300
            ${!activeChat ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}>
            {!activeChat ? (
                <div className="hidden md:flex flex-col items-center justify-center h-full bg-slate-50/50 dark:bg-slate-900 text-slate-400">
                    <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <i className="fas fa-paper-plane text-5xl text-slate-300 dark:text-slate-600 ml-[-5px] mt-[5px]"></i>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">{t('chat.welcomeTitle')}</h2>
                    <p className="max-w-xs text-center text-sm">{t('chat.welcomeDesc')}</p>
                </div>
            ) : (
                <>
                    {/* Header: Use flex-none to ensure it doesn't shrink, add z-index to stay above scrollable content */}
                    <div className="flex-none h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-50 shadow-sm relative">
                        <div className="flex items-center">
                            <button onClick={handleBackToFriends} className="md:hidden mr-3 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                <i className="fas fa-arrow-left"></i>
                            </button>
                            <Avatar name={activeChat.username} src={normalizeImageUrl(activeChat.avatar)} size="sm" />
                            <div className="ml-3">
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">{activeChat.username}</h3>
                                {isTyping && <p className="text-xs text-primary-500 font-medium animate-pulse">{t('chat.typing')}</p>}
                            </div>
                        </div>
                        <div className="w-8"></div>
                    </div>

                    {/* Messages: flex-1 ensures it takes remaining height. overflow-y-auto handles scrolling internally */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950/50 scroll-smooth overscroll-contain">
                        {messages
                            .filter(msg => !msg.deletedBy?.some(d => d.userId === user.userId))
                            .map((msg, idx) => {
                            const isMe = msg.fromUserId === user.userId;
                            return (
                                <MessageBubble 
                                    key={msg._id || idx}
                                    message={msg}
                                    isMe={isMe}
                                    onImageLoad={() => scrollToBottom()}
                                    onRecall={handleRecallMessage}
                                    onDelete={handleDeleteMessage}
                                />
                            );
                        })}
                        {isLoading && <div className="text-center text-xs text-slate-400 py-4"><i className="fas fa-spinner fa-spin mr-2"></i>{t('chat.loadingHistory')}</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area: flex-none ensures it stays at bottom, pb-safe handles iPhone Home bar */}
                    <div className="flex-none p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 z-40 pb-safe">
                        <div className="flex items-end space-x-2 max-w-4xl mx-auto">
                             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                             
                             <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="mb-1 w-10 h-10 rounded-full text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 transition flex items-center justify-center flex-shrink-0"
                            >
                                <i className="fas fa-image text-lg"></i>
                             </button>
                             
                             <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center px-2 py-1 relative">
                                <textarea
                                    rows={1}
                                    value={inputText}
                                    onChange={handleInputChange}
                                    onFocus={() => setTimeout(() => scrollToBottom(true), 100)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder={t('chat.typeMessage')}
                                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-slate-800 dark:text-white placeholder-slate-400 resize-none py-3 px-2 max-h-32 text-sm"
                                />
                                <button 
                                    onClick={openVoiceRecorder}
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-primary-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex-shrink-0 mr-1"
                                    title="Record Voice"
                                >
                                    <i className="fas fa-microphone"></i>
                                </button>
                             </div>

                             <Button 
                                onClick={sendMessage} 
                                disabled={!inputText.trim()} 
                                className="mb-1 !w-10 !h-10 !p-0 !rounded-full flex-shrink-0"
                             >
                                <i className="fas fa-paper-plane text-sm ml-[-2px] mt-[2px]"></i>
                             </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
        
        {/* Voice Recorder Overlay */}
        {showVoiceRecorder && (
            <VoiceRecorder 
                onSend={handleVoiceRecorded}
                onClose={() => setShowVoiceRecorder(false)}
            />
        )}

        {/* MODALS */}
        <Modal 
            isOpen={showAddFriend} 
            onClose={() => setShowAddFriend(false)} 
            title={t('modal.addFriend')}
        >
            <div className="space-y-4">
                <div className="flex space-x-2">
                    <Input 
                        placeholder={t('sidebar.searchPlaceholder')}
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && searchUsers()}
                    />
                    <Button onClick={searchUsers} className="flex-shrink-0"><i className="fas fa-search"></i></Button>
                </div>
                
                <div className="mt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{t('modal.results')}</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {searchResults.map(u => (
                            <div key={u.userId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div className="flex items-center space-x-3">
                                    <Avatar name={u.username} src={normalizeImageUrl(u.avatar)} size="sm" />
                                    <span className="font-semibold text-sm text-slate-700 dark:text-white">{u.username}</span>
                                </div>
                                <Button size="sm" onClick={() => sendFriendRequest(u.userId)} className="!px-3 !py-1 !text-xs">{t('action.add')}</Button>
                            </div>
                        ))}
                        {searchResults.length === 0 && searchQuery && <p className="text-center text-slate-400 text-sm py-4">{t('modal.noResults')}</p>}
                    </div>
                </div>
            </div>
        </Modal>

        {/* Friend Requests */}
        <Modal 
            isOpen={showRequests} 
            onClose={() => setShowRequests(false)} 
            title={t('modal.friendRequests')}
        >
             <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {friendRequests.length === 0 ? (
                    <div className="text-center text-slate-400 py-6">{t('modal.noRequests')}</div>
                ) : (
                    friendRequests.map(req => (
                        <div key={req._id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-full flex items-center justify-center">
                                    <i className="fas fa-user"></i>
                                </div>
                                <div>
                                    <p className="font-semibold text-sm text-slate-800 dark:text-white">{req.fromUsername}</p>
                                    <p className="text-xs text-slate-400">{t('modal.wantsFriend')}</p>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => respondToRequest(req._id, 'accept')} className="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition"><i className="fas fa-check text-xs"></i></button>
                                <button onClick={() => respondToRequest(req._id, 'reject')} className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"><i className="fas fa-times text-xs"></i></button>
                            </div>
                        </div>
                    ))
                )}
             </div>
        </Modal>

        {/* User Profile */}
        <Modal isOpen={showProfile} onClose={() => setShowProfile(false)} title={t('modal.myProfile')}>
             <div className="flex flex-col items-center pt-4 pb-6">
                 <div className="relative group mb-4">
                     <Avatar name={user.username} src={normalizeImageUrl(user.avatar)} size="xl" className="" />
                     <button className="absolute bottom-0 right-0 bg-primary-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                        <i className="fas fa-camera text-xs"></i>
                     </button>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{user.username}</h3>
                 
                 <div className="flex items-center space-x-2 mt-4 mb-6">
                     <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                        {t('modal.online')}
                     </div>
                 </div>
                 
                 <div className="w-full space-y-3">
                     <button 
                         onClick={toggleTheme}
                         className="w-full flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                     >
                         <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
                             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                 <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
                             </div>
                             <span className="text-sm font-medium">{t('modal.darkMode')}</span>
                         </div>
                         <div className={`w-11 h-6 bg-slate-200 dark:bg-primary-600 rounded-full relative transition-colors`}>
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'left-6' : 'left-1'}`}></div>
                         </div>
                     </button>

                     <button 
                         onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                         className="w-full flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                     >
                         <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
                             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                 <i className="fas fa-globe"></i>
                             </div>
                             <span className="text-sm font-medium">{t('modal.language')}</span>
                         </div>
                         <div className="flex items-center space-x-2 bg-slate-200 dark:bg-slate-900 p-1 rounded-lg">
                             <span className={`text-xs px-2 py-1 rounded-md transition-all ${language === 'zh' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-slate-800 dark:text-white' : 'text-slate-500'}`}>中</span>
                             <span className={`text-xs px-2 py-1 rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-slate-800 dark:text-white' : 'text-slate-500'}`}>EN</span>
                         </div>
                     </button>

                     <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span className="text-sm text-slate-500">{t('modal.userId')}</span>
                        <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{user.userId}</span>
                     </div>
                     <Button variant="danger" className="w-full mt-6" onClick={onLogout}>
                        <i className="fas fa-sign-out-alt mr-2"></i> {t('modal.logout')}
                     </Button>
                 </div>
             </div>
        </Modal>

    </div>
  );
};

export default Chat;