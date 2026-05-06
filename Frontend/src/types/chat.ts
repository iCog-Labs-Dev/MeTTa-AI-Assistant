export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLoading?: boolean;
  feedback?: 'positive' | 'neutral' | 'negative' | null;
  responseId?: string; // Backend response ID for feedback submission
}

export interface ChatSession {
  sessionId: string;
  chatId?: string; // Unique chat id for learning mode
  userId?: string;
  createdAt: string;
  title?: string; // Title from first message
  isLearning?: boolean; // Flag for learning mode sessions
  moduleId?: string; // Current module for learning mode
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
}

export interface SessionsResponse {
  sessions: ChatSession[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CursorMessagesResponse {
  messages: Message[];
  nextCursor: string | null;
  hasNext: boolean;
}
