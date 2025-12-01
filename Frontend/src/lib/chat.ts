import * as chatService from '../services/chatService';
import type { ChatRequest, ChatResponse } from '../services/chatService';

// Send a chat message
export const sendChatMessage = async (
  query: string,
  provider?: 'openai' | 'gemini',
  sessionId?: string,
  keyId?: string
) => {
  const data: ChatRequest = {
    query,
    provider,
    session_id: sessionId,
    key_id: keyId,
  };

  return chatService.sendMessage(data) as Promise<ChatResponse>;
};
