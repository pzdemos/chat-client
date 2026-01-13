import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { normalizeImageUrl } from '../services/api';
import { ImageViewer } from './ImageViewer';
import { useLanguage } from '../contexts/LanguageContext';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onImageLoad?: () => void;
  onRecall: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onImageLoad, onRecall, onDelete }) => {
  const { t } = useLanguage();
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  // Audio Source - Add timestamp to prevent aggressive caching of partial files
  const rawAudioSrc = message.blobUrl || (message.voiceUrl ? normalizeImageUrl(message.voiceUrl) : '');
  const audioSrc = rawAudioSrc && !message.blobUrl ? `${rawAudioSrc}?t=${new Date(message.timestamp).getTime()}` : rawAudioSrc;

  const toggleAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    
    try {
        if (isPlaying) {
            audio.pause();
        } else {
            // Android often needs a "nudge" if the metadata is at the end of the file
            if (audio.readyState === 0 || audio.error) {
                setIsAudioLoading(true);
                audio.load();
            }
            
            // Reset if ended
            if (audio.ended) {
                audio.currentTime = 0;
            }
            
            await audio.play();
        }
    } catch (error) {
        console.error("Playback failed:", error);
        setIsPlaying(false);
        setIsAudioLoading(false);
        // Retry logic: if play fails, force reload and try once more
        if (audio.readyState === 0) {
            audio.load(); 
        }
    }
  };

  // Interaction Handlers (Long Press & Context Menu)
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMenu(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  // 1. Handle Recalled Message Display
  if (message.isRecalled) {
      return (
          <div className="flex w-full justify-center mb-4 animate-fade-in">
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  {isMe ? t('chat.youRecalled') : t('chat.recalled')}
              </span>
          </div>
      );
  }

  // 2. Normal Message Display
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isImage = message.messageType === 'image';
  const isVoice = message.messageType === 'voice';
  
  const bubblePadding = isImage ? 'p-0' : 'px-3 py-2';
  const bubbleClasses = isImage 
    ? 'bg-transparent shadow-none' 
    : `${bubblePadding} shadow-sm text-[15px] ${
        isMe 
        ? 'bg-primary-500 text-white rounded-2xl rounded-tr-none' 
        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700'
      }`;

  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-3 animate-slide-up select-none`}>
      <div 
        className={`max-w-[80%] sm:max-w-[70%] relative group`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd} // Cancel on scroll
        onContextMenu={handleContextMenu}
      >
        
        {/* Context Menu */}
        {showMenu && (
            <div 
                ref={menuRef}
                className={`absolute z-50 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden min-w-[120px] animate-fade-in ${isMe ? 'right-0 origin-top-right' : 'left-0 origin-top-left'} -top-2 transform -translate-y-full mb-2`}
                style={{ top: 0, marginTop: '-10px' }}
            >
                <div className="flex flex-col py-1">
                    {/* Recall only if it's my message and not sending/error */}
                    {isMe && message.status === 'sent' && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onRecall(message._id!);
                                setShowMenu(false);
                            }}
                            className="px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3 active:bg-slate-100 transition-colors"
                        >
                            <i className="fas fa-undo text-xs w-4"></i>
                            <span>{t('action.recall')}</span>
                        </button>
                    )}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(message._id!);
                            setShowMenu(false);
                        }}
                        className="px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 active:bg-red-50 transition-colors"
                    >
                        <i className="fas fa-trash-alt text-xs w-4"></i>
                        <span>{t('action.delete')}</span>
                    </button>
                </div>
            </div>
        )}

        {/* Message Content */}
        <div className={`${bubbleClasses} transition-opacity ${message.status === 'sending' ? 'opacity-70' : 'opacity-100'} cursor-pointer`}>
          
          {/* Text */}
          {message.messageType === 'text' && (
             <p className="whitespace-pre-wrap break-words leading-relaxed font-sans">{message.content}</p>
          )}
          
          {/* Image */}
          {isImage && (
            <>
                <div className="relative rounded-xl overflow-hidden cursor-zoom-in inline-block align-bottom min-h-[150px] min-w-[150px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    {(isImageLoading || message.status === 'sending') && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-100 dark:bg-slate-800">
                            <i className="fas fa-spinner fa-spin text-slate-400"></i>
                        </div>
                    )}
                    <img 
                        src={normalizeImageUrl(message.imageUrl)} 
                        alt="Image" 
                        className={`max-w-[240px] sm:max-w-[280px] max-h-[320px] w-auto h-auto rounded-xl object-contain transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                        onClick={() => setIsViewerOpen(true)}
                        onLoad={() => {
                            setIsImageLoading(false);
                            onImageLoad?.();
                        }}
                        onError={() => setIsImageLoading(false)}
                    />
                </div>
                <ImageViewer 
                    src={normalizeImageUrl(message.imageUrl)} 
                    isOpen={isViewerOpen} 
                    onClose={() => setIsViewerOpen(false)} 
                />
            </>
          )}
          
          {/* Voice */}
          {isVoice && (
            <div className="flex items-center space-x-3 pr-1 min-w-[100px]" onClick={toggleAudio}>
              <button 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none flex-shrink-0
                  ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 dark:bg-slate-700 text-primary-600 dark:text-primary-400 hover:bg-slate-200 dark:hover:bg-slate-600'}
                `} 
              >
                {isAudioLoading ? (
                    <i className="fas fa-circle-notch fa-spin text-xs"></i>
                ) : (
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs pl-[1px]`}></i>
                )}
              </button>
              
              <div className="flex flex-col justify-center space-y-0.5 cursor-pointer">
                 {/* Wave Animation */}
                 <div className="flex items-end space-x-0.5 h-4 mb-0.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div 
                            key={i} 
                            className={`w-0.5 rounded-full ${isMe ? 'bg-white/80' : 'bg-primary-500'} ${isPlaying ? 'animate-wave' : 'h-1'}`}
                            style={{ 
                                animationDelay: `${i * 0.1}s`,
                                height: isPlaying ? '100%' : '30%',
                                opacity: isPlaying ? 1 : 0.6
                            }}
                        ></div>
                    ))}
                 </div>
                 <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-medium leading-none ${isMe ? 'text-green-50' : 'text-slate-400'}`}>
                        {message.voiceDuration || 0}s
                    </span>
                 </div>
                 
                 {/* Declarative Audio Element */}
                 {/* Key ensures React recreates the element if src changes, fixing stale state */}
                 <audio 
                    key={audioSrc}
                    ref={audioRef} 
                    src={audioSrc}
                    preload="metadata" 
                    playsInline
                    className="hidden"
                    onPlay={() => {
                        setIsPlaying(true);
                        setIsAudioLoading(false);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                        setIsPlaying(false);
                        setIsAudioLoading(false);
                    }}
                    onWaiting={() => setIsAudioLoading(true)}
                    onPlaying={() => setIsAudioLoading(false)}
                    onError={(e) => {
                        console.error("Audio error event:", e);
                        setIsPlaying(false);
                        setIsAudioLoading(false);
                    }}
                 />
              </div>
            </div>
          )}
        </div>

        {/* Timestamp & Status */}
        <div className={`text-[10px] mt-1 flex items-center space-x-1 ${isMe ? 'justify-end text-slate-400' : 'text-slate-400'}`}>
          {message.status === 'sending' && isMe && <i className="fas fa-spinner fa-spin text-[10px] mr-1"></i>}
          {message.status === 'error' && isMe && <i className="fas fa-exclamation-circle text-red-500 mr-1"></i>}
          <span>{timestamp}</span>
        </div>

      </div>
    </div>
  );
};