import axiosInstance, { handleAxiosError } from '../lib/axios';
import type { ChatSession, SessionsResponse, Message, ChatSessionWithMessages } from '../types/chat';

const SESSIONS_BASE_URL = '/api/chat/sessions';
const CHAT_BASE_URL = '/api/chat';

// Re-exporting ChatRequest and ChatResponse for message sending
export interface ChatRequest {
  query: string;
  provider?: 'openai' | 'gemini';
  model?: string;
  mode?: 'search' | 'generate';
  session_id?: string;
  key_id?: string;
}

export interface ChatResponse {
  query: string;
  response: string;
  model: string;
  provider: string;
  session_id: string; // Assuming backend returns session_id
  responseId?: string; // Backend response ID for feedback
}

// Fetch paginated chat sessions
export const getChatSessions = async (page: number = 1, limit: number = 100): Promise<SessionsResponse> => {
  try {
    const response = await axiosInstance.get<SessionsResponse>(`${SESSIONS_BASE_URL}/`, {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    handleAxiosError(error, 'Sessions');
    throw error;
  }
};

// Get a single session with all its messages
export const getSessionMessages = async (sessionId: string): Promise<Message[]> => {
  try {
    const response = await axiosInstance.get<ChatSessionWithMessages>(`${SESSIONS_BASE_URL}/${sessionId}`);
    return response.data.messages || [];
  } catch (error) {
    handleAxiosError(error, 'Sessions');
    throw error;
  }
};

// Delete a chat session
export const deleteChatSession = async (sessionId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${SESSIONS_BASE_URL}/${sessionId}`);
  } catch (error) {
    handleAxiosError(error, 'Sessions');
    throw error;
  }
};

// Send a chat message
export const sendMessage = async (data: ChatRequest): Promise<ChatResponse> => {
  try {
    const response = await axiosInstance.post<ChatResponse>(`${CHAT_BASE_URL}/`, data);
    return response.data;
  } catch (error) {
    handleAxiosError(error, 'Chat');
    throw error;
  }
};

// Feedback submission
export interface FeedbackRequest {
  responseId: string;
  sessionId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  comment?: string;
}

export const submitFeedback = async (data: FeedbackRequest): Promise<any> => {
  console.log('[chatService] Submitting feedback:', data);
  try {
    const response = await axiosInstance.post('/api/feedback/submit', data);
    console.log('[chatService] Feedback response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[chatService] Feedback submission error:', error);
    handleAxiosError(error, 'Feedback Error');
    throw error;
  }
};
