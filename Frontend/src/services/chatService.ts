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

export interface PaginatedMessagesResponse {
  messages: Message[];
  pagination: {
    limit: number;
    total: number;
    hasOlder: boolean;
    hasNewer: boolean;
    cursors: {
      oldest: string | null;
      newest: string | null;
    };
  };
}

// export const getSessionMessagesPaginated = async (
//   sessionId: string,
//   limit: number = 50,
//   before?: string,  // Load messages older than this messageId
//   after?: string    // Load messages newer than this messageId
// ): Promise<PaginatedMessagesResponse> => {
//   try {
//     const params: any = { limit };
//     if (before) params.before = before;
//     if (after) params.after = after;

//     const response = await axiosInstance.get<PaginatedMessagesResponse>(
//       `${SESSIONS_BASE_URL}/${sessionId}/messages/paginated`,
//       { params }
//     );
//     return response.data;
//   } catch (error) {
//     handleAxiosError(error, 'Sessions Paginated');
//     throw error;
//   }
// };

// TEMPORARY MOCK - Add this BEFORE the real function, or comment out the real one temporarily
// TEMPORARY MOCK - Add this at the end of chatService.ts (or replace temporarily)
// SIMPLE WORKING MOCK - No messageId
export const getSessionMessagesPaginated = async (
  sessionId: string,
  limit: number = 50,
  before?: string
): Promise<PaginatedMessagesResponse> => {
  console.log('🎯 [MOCK] getSessionMessagesPaginated - no messageId');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const messages: Message[] = [];
  const isOlderLoad = !!before;
  
  for (let i = 0; i < Math.min(limit, 20); i++) { // Load 20 for testing
    const messageNum = isOlderLoad ? i : i + 50;
    
    // Minimal Message object - adjust based on your actual type
    const message: any = {
      id: `test_msg_${messageNum}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: isOlderLoad 
        ? `Older test message ${messageNum}`
        : `Test message ${messageNum}`,
    };
    
    // Add timestamp if your Message type has it
    if (Math.random() > 0.5) {
      message.timestamp = Date.now() - messageNum * 1000;
    }
    
    messages.push(message as Message);
  }
  
  return {
    messages,
    pagination: {
      limit,
      total: 200,
      hasOlder: true,
      hasNewer: false,
      cursors: {
        oldest: messages.length > 0 ? messages[messages.length-1].id : null,
        newest: messages.length > 0 ? messages[0].id : null,
      }
    }
  };
};