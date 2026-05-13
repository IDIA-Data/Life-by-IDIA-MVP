
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface FriendAssistantProps {
  isVisible: boolean;
  onClose: () => void;
  trigger?: 'social' | 'wallet' | 'data' | 'achievement';
}

export type FriendState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface OrbStyling {
  background: string;
  animation: string;
  glow: string;
  scale: string;
}
