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
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // For Visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }

    // Stop all tracks (turns off microphone light)
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close AudioContext (visualizer)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
  };

  // Helper to find best supported mimeType
  const getBestMimeType = () => {
    const types = [
      'audio/mp4',             // iOS (Best for Apple)
      'audio/webm;codecs=opus',// Android (Standard, high quality)
      'audio/webm',            // Android Fallback
      'audio/ogg',             // Older Android
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Let browser use default
  };

  const startRecording = async () => {
    try {
      // 1. Get Stream
      // Using 'ideal' constraints allows the browser to pick the hardware-optimized path
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
          } 
      });
      streamRef.current = stream;

      // 2. Setup MediaRecorder
      const mimeType = getBestMimeType();
      const options = mimeType ? { mimeType } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
          }
      };

      // CRITICAL FIX FOR ANDROID STUTTER:
      // Removed the timeslice argument (e.g., start(1000)).
      // Passing a timeslice forces the browser to slice the buffer repeatedly, 
      // which causes CPU spikes and "robotic" audio gaps on low-end Androids.
      // Calling start() without arguments records one smooth continuous buffer.
      mediaRecorder.start(); 

      // 3. Setup Visualizer (Safely)
      try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
              const audioCtx = new AudioContext();
              audioContextRef.current = audioCtx;
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 128; // Reduced FFT size for performance
              analyser.smoothingTimeConstant = 0.5;
              analyserRef.current = analyser;

              // Use a clone of the stream to avoid interfering with the recorder track
              const source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);

              // Throttle Visualizer to 10 FPS (100ms) to save CPU for Recording
              let lastDraw = 0;
              const updateLevel = (now: number) => {
                  if (!analyserRef.current) return;
                  
                  if (now - lastDraw > 100) { 
                      const dataArray = new Uint8Array(analyser.frequencyBinCount);
                      analyser.getByteFrequencyData(dataArray);
                      const sum = dataArray.reduce((a, b) => a + b, 0);
                      const avg = sum / dataArray.length;
                      setAudioLevel(avg);
                      lastDraw = now;
                  }
                  animationFrameRef.current = requestAnimationFrame(updateLevel);
              };
              animationFrameRef.current = requestAnimationFrame(updateLevel);
          }
      } catch (e) {
          console.warn('Visualizer init failed (non-fatal)', e);
      }

      // 4. Start Timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone error:", err);
      onClose();
    }
  };

  const handleStop = (shouldSend: boolean) => {
    const recorder = mediaRecorderRef.current;
    
    if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
             if (shouldSend) {
                 const mimeType = recorder.mimeType || 'audio/webm';
                 const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                 if (audioBlob.size > 0) {
                     onSend(audioBlob, duration || 1);
                 }
             }
             finalizeClose();
        };
        recorder.stop();
    } else {
        finalizeClose();
    }
  };

  const finalizeClose = () => {
      setIsClosing(true);
      setTimeout(onClose, 300);
  };

  // Visual scale
  const scale = 1 + (audioLevel / 256) * 0.4;

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl transition-transform duration-200"
                style={{ transform: `translate(-50%, -50%) scale(${scale * 1.5})` }}
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

        {/* Visualizer Icon */}
        <div className="relative z-10 mb-20">
            <div className="relative w-32 h-32 flex items-center justify-center">
                <div 
                    className="absolute inset-0 rounded-full border-2 border-primary-500/30"
                    style={{ transform: `scale(${scale})`, transition: 'transform 0.1s' }}
                ></div>
                <div 
                    className="absolute inset-0 rounded-full border border-primary-500/20"
                    style={{ transform: `scale(${scale * 1.2})`, transition: 'transform 0.1s' }}
                ></div>
                
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/50 z-20">
                    <i className="fas fa-microphone text-4xl text-white"></i>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 px-12 flex justify-between items-center max-w-md mx-auto w-full z-20">
            <button 
                onClick={() => handleStop(false)}
                className="flex flex-col items-center space-y-2 text-slate-400 hover:text-red-500 transition-colors"
            >
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <i className="fas fa-times text-xl"></i>
                </div>
                <span className="text-xs font-medium">{t('action.cancel')}</span>
            </button>

            <button 
                onClick={() => handleStop(true)}
                className="flex flex-col items-center space-y-2 text-white hover:text-green-400 transition-colors"
            >
                <div className="w-20 h-20 rounded-full bg-white text-primary-600 shadow-xl flex items-center justify-center transform active:scale-95 transition-transform">
                    <i className="fas fa-paper-plane text-3xl ml-1 mt-1"></i>
                </div>
                <span className="text-xs font-medium">{t('action.send')}</span>
            </button>
        </div>
    </div>
  );
};