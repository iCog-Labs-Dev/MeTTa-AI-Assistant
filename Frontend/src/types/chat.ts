/**
 * Chat related types
 */

export interface CreateSessionResponse {
  session_id: string;
}

/**
 * Request parameters for a chat API call
 */
export interface ChatRequest {
  /** The user's query text */
  query: string;
  /** Provider ID (e.g., 'openai', 'gemini') */
  provider?: string;
  /** Optional session ID for continuing conversations */
  session_id?: string;
}

export interface ChatResponse {
  query: string;
  response: string;
  sources?: Array<{
    content: string;
    metadata?: Record<string, any>;
    score?: number;
  }>;
  session_id?: string;
}

export interface ChatError {
  detail: string;
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  feedback?: 'up' | 'down';
}
