import * as chatService from '../services/chatService';
import type { ChatRequest, ChatResponse } from '../services/chatService';

// Create a new chat session
export const createChatSession = async () => {
  return chatService.createSession();
};

// Send a chat message
export const sendChatMessage = async (
  query: string,
  provider?: 'openai' | 'gemini',
  sessionId?: string
) => {
  const data: ChatRequest = {
    query,
    provider,
    session_id: sessionId,
  };
  
  return chatService.sendMessage(data) as Promise<ChatResponse>;
};
