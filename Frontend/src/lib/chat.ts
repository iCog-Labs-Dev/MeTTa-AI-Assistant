import * as chatService from '../services/chatService';
import type { ChatRequest } from '../types/chat';

// Create a new chat session
export const createChatSession = async () => {
  return chatService.createSession();
};

// Send a chat message
export const sendChatMessage = async (
  query: string,
  provider?: string,
  sessionId?: string
) => {
  const data: ChatRequest = {
    query,
    provider,
    session_id: sessionId,
  };
  
  return chatService.chat(data);
};
