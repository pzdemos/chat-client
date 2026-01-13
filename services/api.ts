import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// Updated to include trailing slash as requested
export const API_BASE_URL = 'https://www.haoaiganfan.top/ms/';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to handle errors gracefully
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An unknown error occurred';
    return Promise.reject(new Error(message));
  }
);

let socket: Socket | null = null;

export const getSocket = (userId: string): Socket => {
  if (!socket) {
    socket = io('https://www.haoaiganfan.top', {
        path: '/ms/socket.io',
        transports: ['websocket', 'polling'],
        query: { userId },
        reconnectionAttempts: 5,
        timeout: 20000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const normalizeImageUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    
    // Remove leading slash if present to avoid double slashes when appending to base
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    
    // Check if it already has the /ms prefix from the server relative path
    if (cleanUrl.startsWith('ms/')) {
        return `https://www.haoaiganfan.top/${cleanUrl}`;
    }
    
    return `${API_BASE_URL}${cleanUrl}`;
};
