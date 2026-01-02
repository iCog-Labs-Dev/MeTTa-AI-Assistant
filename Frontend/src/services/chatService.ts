import axiosInstance, { handleAxiosError } from '../lib/axios';
import type { ChatSession, SessionsResponse, Message, ChatSessionWithMessages, CursorMessagesResponse } from '../types/chat';

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
  session_id: string; 
  responseId?: string; 
  messageId?: string; 
  userMessageId?: string; 
}

// Fetch paginated chat sessions
export const getChatSessions = async ( page: number = 1, limit: number = 100): Promise<SessionsResponse> => {
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

// Cursor-based message retrieval
export const getSessionMessagesCursor = async (
  sessionId: string,
  limit: number = 10,
  cursor?: string
): Promise<CursorMessagesResponse> => {
  try {
    const response = await axiosInstance.get<CursorMessagesResponse>(`${SESSIONS_BASE_URL}/${sessionId}/messages`, {
      params: { limit, cursor },
    });
    return response.data;
  } catch (error) {
    handleAxiosError(error, 'Sessions');
    throw error;
  }
};

export interface FirstUserMessageResponse {
  message: { messageId: string; content: string; createdAt: string } | null;
}

export const getFirstUserMessage = async (sessionId: string): Promise<FirstUserMessageResponse> => {
  try {
    const response = await axiosInstance.get<FirstUserMessageResponse>(`${SESSIONS_BASE_URL}/${sessionId}/first-user-message`);
    return response.data;
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

// Send a chat message (this non-streaming will use if streaming falls back to non-streaming in Usechatstore)
export const sendMessage = async (data: ChatRequest): Promise<ChatResponse> => {
  try {
    const response = await axiosInstance.post<ChatResponse>(`${CHAT_BASE_URL}/`, data);
    return response.data;
  } catch (error) {
    handleAxiosError(error, 'Chat');
    throw error;
  }
};

// Streaming chat message (SSE over fetch)
export const streamMessage = async (
  data: ChatRequest,
  onPartial: (chunk: string) => void,
  onFinal: (payload: ChatResponse) => void,
  onError: (error: string) => void,
) => {
  try {
    const token = localStorage.getItem('access_token') || '';

    const payload: ChatRequest = {
      query: data.query,
      provider: data.provider,
      model: data.model,
      mode: data.mode,
      session_id: data.session_id,
    };

    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${CHAT_BASE_URL}/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let accumulatedForUi = '';
    let rafScheduled = false;

    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        if (accumulatedForUi.length) {
          onPartial(accumulatedForUi);
        }
      });
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // split on SSE event boundary 
      const events = buffer.split(/\n\n/);
      buffer = events.pop() || ''; // incomplete event stays in buffer

      for (const evt of events) {
        const line = evt.trim();
        if (!line) continue;

        const dataLines = line
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.replace(/^data:\s*/, ''));

        if (dataLines.length === 0) continue;

        const jsonStr = dataLines.join('\n');

        if (!jsonStr || jsonStr === '[DONE]') continue;

        let event: any;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          const raw = jsonStr;
          accumulatedForUi += raw;
          scheduleFlush();
          continue;
        }

        switch (event.type) {
          case 'partial': {
            const delta =
              typeof event.delta === 'string'
                ? event.delta
                : JSON.stringify(event.delta);
            accumulatedForUi += delta;
            scheduleFlush();
            break;
          }
          case 'final': {
            const finalPayload: ChatResponse =
              event.payload || event.response || event;

            if (
              typeof finalPayload.response === 'string' &&
              finalPayload.response.length
            ) {
              accumulatedForUi = finalPayload.response;
              if (rafScheduled) onPartial(accumulatedForUi);
            }
            onFinal(finalPayload);
            break;
          }
          case 'error': {
            onError(event.error || 'Unknown error');
            break;
          }
          default: {
            if (event && typeof event === 'object' && event.response) {
              const finalPayload = event as ChatResponse;
              if (typeof finalPayload.response === 'string') {
                accumulatedForUi = finalPayload.response;
                onPartial(accumulatedForUi);
              }
              onFinal(finalPayload);
            } else {
              const raw = JSON.stringify(event);
              accumulatedForUi += raw;
              scheduleFlush();
            }
            break;
          }
        }
      }
    }

    // Final leftover buffer handling
    if (buffer.trim()) {
      const leftover = buffer.trim();
      const jsonStr = leftover.replace(/^data:\s*/, '');
      try {
        const event: any = JSON.parse(jsonStr);
        if (event.type === 'final') {
          const finalPayload: ChatResponse =
            event.payload || event.response || event;
          if (typeof finalPayload.response === 'string') {
            accumulatedForUi = finalPayload.response;
            onPartial(accumulatedForUi);
          }
          onFinal(finalPayload);
        } else if (event.type === 'partial') {
          const delta =
            typeof event.delta === 'string'
              ? event.delta
              : JSON.stringify(event.delta);
          accumulatedForUi += delta;
          onPartial(accumulatedForUi);
        } else if (event.type === 'error') {
          onError(event.error || 'Unknown error');
        }
      } catch {
        accumulatedForUi += leftover;
        onPartial(accumulatedForUi);
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
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
