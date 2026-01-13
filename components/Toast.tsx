import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
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

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

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
            <div className="fixed top-4 right-4 z-[100] flex flex-col space-y-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto min-w-[300px] max-w-sm w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-4 flex items-start transform transition-all duration-300 animate-slide-up
                        `}
                    >
                        <div className={`flex-shrink-0 mt-0.5 mr-3 ${getIconColor(toast.type)}`}>
                            <i className={`fas ${getIconClass(toast.type)}`}></i>
                        </div>
                        <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                            {toast.message}
                        </div>
                        <button onClick={() => removeToast(toast.id)} className="ml-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
