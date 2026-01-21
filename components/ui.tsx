import React, { useState } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const variants = {
    // Updated to use primary (Green)
    primary: "bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 focus:ring-primary-500",
    secondary: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-400",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 border border-transparent focus:ring-red-500",
    ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <i className="fas fa-circle-notch fa-spin mr-2"></i>
      ) : null}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, icon, error, className = '', type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
            <i className={`fas ${icon}`}></i>
          </div>
        )}
        <input
          type={inputType}
          className={`w-full bg-white dark:bg-slate-800 border-2 rounded-xl py-2.5 ${icon ? 'pl-10' : 'pl-4'} ${isPassword ? 'pr-10' : 'pr-4'} text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all duration-200 ${
            error 
            ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
            : 'border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'
          } ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-primary-500 transition-colors focus:outline-none"
            tabIndex={-1}
          >
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 ml-1 text-xs font-medium text-red-500 animate-fade-in">{error}</p>}
    </div>
  );
};

export const Avatar: React.FC<{ src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string; status?: 'online' | 'offline' }> = ({ src, name, size = 'md', className = '', status }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-24 h-24 text-xl"
  };

  // Fixed to Theme Green Gradient
  const bgGradient = 'bg-gradient-to-br from-primary-400 to-primary-600';

  return (
    <div className={`relative inline-block ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-white dark:ring-slate-900 shadow-sm ${!src ? bgGradient : 'bg-slate-200'}`}>
        {src ? (
            <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
            <span className="font-bold text-white select-none text-shadow-sm">{name.charAt(0).toUpperCase()}</span>
        )}
        </div>
        {status && (
            <span className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-slate-900 ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} ${status === 'online' ? 'bg-primary-500' : 'bg-slate-400'}`} />
        )}
    </div>
  );
};