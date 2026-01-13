import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageViewerProps {
  src: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsVisible(true);
        document.body.style.overflow = 'hidden';
    } else {
        const timer = setTimeout(() => setIsVisible(false), 300);
        document.body.style.overflow = 'unset';
        return () => clearTimeout(timer);
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isVisible && !isOpen) return null;

  return createPortal(
    <div 
        className={`fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
    >
      <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[101]">
        <i className="fas fa-times text-lg"></i>
      </button>
      <img 
        src={src} 
        alt="Full view" 
        className={`max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()} 
      />
    </div>,
    document.body
  );
};