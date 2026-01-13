import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onClose: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onClose }) => {
  const { t } = useLanguage();
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mimeTypeRef = useRef<string>('');

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/mp4',              // Prioritize MP4 for iOS/Safari (AAC) - Best for cross-platform
      'audio/webm;codecs=opus', // Preferred for Android & Chrome
      'audio/webm',             // Generic WebM
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio Analysis for Visuals
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Recorder Setup
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType; // Store for stop handling
      
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      onClose();
    }
  };

  const handleStop = (shouldSend: boolean) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = () => {
        if (shouldSend) {
            // Use the actual detected mime type, fallback to webm if empty (though browser default usually has a type)
            const type = mimeTypeRef.current || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type });
            
            if (audioBlob.size > 0) {
                onSend(audioBlob, duration || 1);
            }
        }
        setIsClosing(true);
        setTimeout(onClose, 300); // Allow exit animation
    };

    mediaRecorderRef.current.stop();
  };

  // Calculate scale based on audio level for animation
  const scale = 1 + (audioLevel / 256) * 0.5;

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Animated Background Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl transition-transform duration-100"
                style={{ transform: `translate(-50%, -50%) scale(${scale * 1.5})` }}
            ></div>
             <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary-400/30 rounded-full blur-2xl transition-transform duration-100"
                style={{ transform: `translate(-50%, -50%) scale(${scale * 1.2})` }}
            ></div>
        </div>

        {/* Timer */}
        <div className="relative z-10 mb-12 text-center">
            <div className="text-6xl font-mono font-bold text-white tracking-wider mb-2 drop-shadow-lg">
                00:{duration.toString().padStart(2, '0')}
            </div>
            <div className="text-primary-300 text-sm font-medium tracking-widest uppercase opacity-80 animate-pulse">
                {t('chat.recording')}
            </div>
        </div>

        {/* Visualizer / Main Icon */}
        <div className="relative z-10 mb-20">
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Ripple Rings */}
                {[1, 2, 3].map(i => (
                    <div 
                        key={i}
                        className="absolute inset-0 rounded-full border border-primary-500/30"
                        style={{
                            transform: `scale(${scale * (1 + i * 0.2)})`,
                            opacity: 1 - (i * 0.2),
                            transition: 'transform 0.1s ease-out'
                        }}
                    ></div>
                ))}
                
                {/* Central Mic */}
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/50 z-20">
                    <i className="fas fa-microphone text-4xl text-white"></i>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 px-12 flex justify-between items-center max-w-md mx-auto w-full z-20">
            {/* Cancel Button */}
            <button 
                onClick={() => handleStop(false)}
                className="group flex flex-col items-center justify-center space-y-2 text-slate-400 hover:text-red-500 transition-colors"
            >
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 group-hover:border-red-500/50 group-hover:bg-red-500/10 flex items-center justify-center transition-all duration-300 transform group-active:scale-95">
                    <i className="fas fa-times text-xl"></i>
                </div>
                <span className="text-xs font-medium">{t('action.cancel')}</span>
            </button>

            {/* Send Button */}
            <button 
                onClick={() => handleStop(true)}
                className="group flex flex-col items-center justify-center space-y-2 text-slate-400 hover:text-green-500 transition-colors"
            >
                <div className="w-20 h-20 rounded-full bg-white text-primary-600 shadow-xl shadow-primary-900/50 flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95">
                    <i className="fas fa-paper-plane text-3xl ml-[-2px] mt-[2px]"></i>
                </div>
                <span className="text-xs font-medium text-white">{t('action.send')}</span>
            </button>
        </div>
    </div>
  );
};