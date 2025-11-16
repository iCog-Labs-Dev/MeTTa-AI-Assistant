export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLoading?: boolean;
  feedback?: 'up' | 'down' | null;
}

export interface ChatSession {
  sessionId: string;
  userId?: string;
  createdAt: string;
  title?: string; // Title from first message
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

