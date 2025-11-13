import axiosInstance, { handleAxiosError } from '../lib/axios';
import type { CreateSessionResponse, ChatRequest, ChatResponse } from '../types/chat';

const CHAT_BASE_URL = '/api/chat';

// Use the global error handler with 'Chat' context
const handleError = (error: unknown): void => {
  handleAxiosError(error, 'Chat');
};

// Create a new chat session
export const createSession = async (): Promise<CreateSessionResponse> => {
  try {
    const response = await axiosInstance.post<CreateSessionResponse>(
      `${CHAT_BASE_URL}/session`,
      {}
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};

// Send a chat message to the RAG system
export const chat = async (data: ChatRequest): Promise<ChatResponse> => {
  try {
    const payload: Record<string, any> = {
      query: data.query,
    };

    // Only include optional fields if provided
    if (data.provider) {
      payload.provider = data.provider;
    }
    if (data.session_id) {
      payload.session_id = data.session_id;
    }

    const response = await axiosInstance.post<ChatResponse>(
      `${CHAT_BASE_URL}/`,
      payload
    );
    return response.data;
  } catch (error) {
    handleError(error);
    throw error;
  }
};
