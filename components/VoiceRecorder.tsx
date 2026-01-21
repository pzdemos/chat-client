import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onClose: () => void;
}

// --- WAV Encoding Utilities ---
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

const encodeWAV = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count (Mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
};

const flattenArray = (channelBuffer: Float32Array[], recordingLength: number) => {
  const result = new Float32Array(recordingLength);
  let offset = 0;
  for (let i = 0; i < channelBuffer.length; i++) {
    const buffer = channelBuffer[i];
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
};

// Downsample buffer to target rate (e.g. 16kHz) to reduce file size
const downsampleBuffer = (buffer: Float32Array, inputRate: number, outputRate: number) => {
    if (outputRate >= inputRate) return buffer;
    
    const sampleRateRatio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    
    while (offsetResult < newLength) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        // Use simple averaging to prevent aliasing
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onClose }) => {
  const { t } = useLanguage();
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  
  // Custom Recorder State
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioInputRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataRef = useRef<Float32Array[]>([]);
  const recordingLengthRef = useRef<number>(0);
  
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Stop Tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Disconnect Nodes
    if (processorRef.current) {
        processorRef.current.disconnect();
    }
    if (audioInputRef.current) {
        audioInputRef.current.disconnect();
    }
    
    // Close Context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      // 1. Setup Analyser for Visuals
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioCtx.createMediaStreamSource(stream);
      audioInputRef.current = source;
      source.connect(analyser);

      const updateLevel = () => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // 2. Setup Recorder (ScriptProcessor)
      // bufferSize 4096 gives a good balance between latency and performance
      const bufferSize = 4096; 
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;
      
      audioDataRef.current = [];
      recordingLengthRef.current = 0;

      processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          // Clone data because inputBuffer is reused
          const bufferCopy = new Float32Array(inputData);
          audioDataRef.current.push(bufferCopy);
          recordingLengthRef.current += bufferCopy.length;
      };

      // Connect source -> processor -> destination (needed for process to run)
      source.connect(processor);
      processor.connect(audioCtx.destination);

      // 3. Start Timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
      onClose();
    }
  };

  const handleStop = (shouldSend: boolean) => {
    if (shouldSend && audioContextRef.current) {
        const inputSampleRate = audioContextRef.current.sampleRate;
        const targetSampleRate = 16000; // Downsample to 16kHz (Voice Quality, 3x smaller file)

        // Flatten the recorded buffers
        const recordedBuffer = flattenArray(audioDataRef.current, recordingLengthRef.current);
        
        // Downsample
        const downsampledBuffer = downsampleBuffer(recordedBuffer, inputSampleRate, targetSampleRate);
        
        // Encode to WAV
        const wavView = encodeWAV(downsampledBuffer, targetSampleRate);
        const audioBlob = new Blob([wavView], { type: 'audio/wav' });
        
        if (audioBlob.size > 0) {
            onSend(audioBlob, duration || 1);
        }
    }
    
    setIsClosing(true);
    setTimeout(onClose, 300);
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
                
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/50 z-20">
                    <i className="fas fa-microphone text-4xl text-white"></i>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 px-12 flex justify-between items-center max-w-md mx-auto w-full z-20">
            <button 
                onClick={() => handleStop(false)}
                className="group flex flex-col items-center justify-center space-y-2 text-slate-400 hover:text-red-500 transition-colors"
            >
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 group-hover:border-red-500/50 group-hover:bg-red-500/10 flex items-center justify-center transition-all duration-300 transform group-active:scale-95">
                    <i className="fas fa-times text-xl"></i>
                </div>
                <span className="text-xs font-medium">{t('action.cancel')}</span>
            </button>

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