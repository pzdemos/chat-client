
export interface User {
  userId: string;
  username: string;
  avatar?: string;
  token?: string;
}

export interface Friend {
  userId: string;
  username: string;
  avatar?: string;
  unreadCount?: number;
  lastMessage?: Message;
}

export interface FriendRequest {
  _id: string;
  fromUserId: string;
  fromUsername: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Message {
  _id?: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  messageType: 'text' | 'image' | 'voice';
  imageUrl?: string;
  voiceUrl?: string;
  blobUrl?: string; // For immediate local playback
  voiceDuration?: number;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error'; // For UI feedback
  isRead?: boolean;
  isRecalled?: boolean;
  deletedBy?: { userId: string; deletedAt: string }[];
}

export interface AuthResponse {
  userId: string;
  username: string;
  avatar?: string;
}

export interface ApiError {
  error: string;
}
