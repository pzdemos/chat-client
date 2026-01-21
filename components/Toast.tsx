import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    isExiting?: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        // Trigger exit animation first
        setToasts(prev => prev.map(t => t.id === id ? { ...t, isExiting: true } : t));
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 250); // Matches the toast-out animation duration
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, [removeToast]);

    const getIconColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'text-green-500';
            case 'error': return 'text-red-500';
            default: return 'text-slate-500 dark:text-slate-400';
        }
    };

    const getIconClass = (type: ToastType) => {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            default: return 'fa-info-circle';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Top Center Container */}
            <div className="fixed top-4 left-1/2 z-[100] flex flex-col items-center space-y-3 pointer-events-none -translate-x-1/2 w-full px-4 sm:top-8">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto 
                            w-auto max-w-[85vw] sm:max-w-sm 
                            bg-white dark:bg-slate-800 
                            rounded-xl shadow-lg shadow-slate-200/50 dark:shadow-black/20
                            border border-slate-100 dark:border-slate-700 
                            p-3 sm:px-4 sm:py-3 
                            flex items-start gap-3
                            transform transition-all duration-300
                            ${toast.isExiting ? 'animate-toast-out' : 'animate-toast-in'}
                        `}
                    >
                        <div className={`flex-shrink-0 mt-0.5 ${getIconColor(toast.type)}`}>
                            <i className={`fas ${getIconClass(toast.type)}`}></i>
                        </div>
                        <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 break-words leading-tight">
                            {toast.message}
                        </div>
                        <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors -mr-1">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};