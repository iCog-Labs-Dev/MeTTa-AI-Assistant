import { create, StateCreator } from 'zustand';
import { ChatSession, Message } from '../types/chat';
import {
  getChatSessions as apiGetChatSessions,
  getSessionMessages as apiGetSessionMessages,
  getSessionMessagesPaginated as apiGetSessionMessagesPaginated, 
  deleteChatSession as apiDeleteChatSession,
  sendMessage as apiSendMessage,
} from '../services/chatService';
import { refreshAccessToken, isAuthenticated } from '../lib/auth';
import { useModelStore } from './useModelStore';

interface ChatState {
  sessions: ChatSession[];
  messages: Message[];
  selectedSessionId: string | null;
  // Sidebar/session list loading state for better UX
  sessionsStatus: 'idle' | 'loading' | 'ready' | 'empty';
  sessionsPage: number;
  hasMoreSessions: boolean;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  paginationState: {
    hasOlderMessages: boolean;
    oldestCursor: string | null;
    isLoadingOlder: boolean;
  };

  // Actions
  loadSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  sendMessage: (query: string) => Promise<void>;
  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => void;
  loadOlderMessages: () => Promise<void>;
}

const chatStoreCreator: StateCreator<ChatState> = (set, get) => ({
  sessions: [],
  messages: [],
  selectedSessionId: null,
  sessionsStatus: 'idle',
  sessionsPage: 1,
  hasMoreSessions: false,
  isLoadingSessions: false,
  isLoadingMessages: false,
  error: null,

  paginationState: {
    hasOlderMessages: false,
    oldestCursor: null,
    isLoadingOlder: false,
  },

  loadSessions: async () => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to view chat sessions', isLoadingSessions: false });
      return;
    }

    set({ isLoadingSessions: true, error: null, sessionsStatus: 'loading' });
    try {
      const response = await apiGetChatSessions(1, 20);
      const sessions = response.sessions;

      // First, store the sessions and update high-level status
      set({
        sessions,
        isLoadingSessions: false,
        sessionsStatus: sessions.length > 0 ? 'ready' : 'empty',
        sessionsPage: 1,
        hasMoreSessions: response.has_next,
      });

      // Then, in the background, derive titles for sessions that don't have one yet
      const sessionsNeedingTitles = sessions.filter((s) => !s.title);
      if (sessionsNeedingTitles.length > 0) {
        Promise.all(
          sessionsNeedingTitles.map(async (s) => {
            try {
              const messages = await apiGetSessionMessages(s.sessionId);
              const firstUserMessage = messages.find((m) => m.role === 'user');
              if (firstUserMessage) {
                set((state: ChatState) => ({
                  sessions: state.sessions.map((session: ChatSession) =>
                    session.sessionId === s.sessionId && !session.title
                      ? { ...session, title: firstUserMessage.content }
                      : session
                  ),
                }));
              }
            } catch {
              // Ignore per-session title derivation errors; sessions list is already loaded
            }
          })
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const response = await apiGetChatSessions(1, 20);
          const sessions = response.sessions;

          set({
            sessions,
            isLoadingSessions: false,
            sessionsStatus: sessions.length > 0 ? 'ready' : 'empty',
            sessionsPage: 1,
            hasMoreSessions: response.has_next,
          });

          const sessionsNeedingTitles = sessions.filter((s) => !s.title);
          if (sessionsNeedingTitles.length > 0) {
            Promise.all(
              sessionsNeedingTitles.map(async (s) => {
                try {
                  const messages = await apiGetSessionMessages(s.sessionId);
                  const firstUserMessage = messages.find((m) => m.role === 'user');
                  if (firstUserMessage) {
                    set((state: ChatState) => ({
                      sessions: state.sessions.map((session: ChatSession) =>
                        session.sessionId === s.sessionId && !session.title
                          ? { ...session, title: firstUserMessage.content }
                          : session
                      ),
                    }));
                  }
                } catch {
                  // Ignore per-session title derivation errors
                }
              })
            );
          }
        } catch (refreshErr) {
          set({
            error: 'Session expired. Please log in again.',
            isLoadingSessions: false,
            sessionsStatus: 'empty',
          });
          // Redirect to login or handle token refresh failure
          window.location.href = '/login';
        }
      } else {
        set({ error: 'Failed to load sessions', isLoadingSessions: false, sessionsStatus: 'empty' });
      }
    }
  },

  loadMoreSessions: async () => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to view more sessions' });
      return;
    }

    const { sessionsPage, hasMoreSessions } = get();
    if (!hasMoreSessions) return;

    const nextPage = sessionsPage + 1;

    try {
      const response = await apiGetChatSessions(nextPage, 20);
      const newSessions = response.sessions;

      set((state: ChatState) => ({
        sessions: [...state.sessions, ...newSessions.filter(ns => !state.sessions.some((s: ChatSession) => s.sessionId === ns.sessionId))],
        sessionsPage: nextPage,
        hasMoreSessions: response.has_next,
      }));

      // Derive titles for newly loaded sessions that don't have one yet
      const sessionsNeedingTitles = newSessions.filter((s) => !s.title);
      if (sessionsNeedingTitles.length > 0) {
        Promise.all(
          sessionsNeedingTitles.map(async (s) => {
            try {
              const messages = await apiGetSessionMessages(s.sessionId);
              const firstUserMessage = messages.find((m) => m.role === 'user');
              if (firstUserMessage) {
                set((state: ChatState) => ({
                  sessions: state.sessions.map((session: ChatSession) =>
                    session.sessionId === s.sessionId && !session.title
                      ? { ...session, title: firstUserMessage.content }
                      : session
                  ),
                }));
              }
            } catch {
              // Ignore per-session title derivation errors
            }
          })
        );
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const response = await apiGetChatSessions(nextPage, 20);
          const newSessions = response.sessions;

          set((state: ChatState) => ({
            sessions: [...state.sessions, ...newSessions.filter(ns => !state.sessions.some((s: ChatSession) => s.sessionId === ns.sessionId))],
            sessionsPage: nextPage,
            hasMoreSessions: response.has_next,
          }));

          const sessionsNeedingTitles = newSessions.filter((s) => !s.title);
          if (sessionsNeedingTitles.length > 0) {
            Promise.all(
              sessionsNeedingTitles.map(async (s) => {
                try {
                  const messages = await apiGetSessionMessages(s.sessionId);
                  const firstUserMessage = messages.find((m) => m.role === 'user');
                  if (firstUserMessage) {
                    set((state: ChatState) => ({
                      sessions: state.sessions.map((session: ChatSession) =>
                        session.sessionId === s.sessionId && !session.title
                          ? { ...session, title: firstUserMessage.content }
                          : session
                      ),
                    }));
                  }
                } catch {
                  // Ignore per-session title derivation errors
                }
              })
            );
          }
        } catch (refreshErr) {
          set({ error: 'Session expired. Please log in again.' });
          window.location.href = '/login';
        }
      } else {
        set({ error: 'Failed to load more sessions' });
      }
    }
  },

  selectSession: async (sessionId: string) => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to view messages', isLoadingMessages: false });
      return;
    }

    set({ 
      selectedSessionId: sessionId, 
      isLoadingMessages: true, 
      error: null,
      messages: [],
      paginationState: {  
        hasOlderMessages: false,
        oldestCursor: null,
        isLoadingOlder: false,
      }
    });
    
    try {
      const { messages: apiMessages, pagination } = await apiGetSessionMessagesPaginated(sessionId, 50);

      // Ensure every message has a stable id and timestamp for React keys and ordering
      const messages = apiMessages.map((m: Message, index: number) => ({
        ...m,
        id: m.id || `${sessionId}-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));

      // Derive a title from the first user message if the session has no title yet
      const firstUserMessage = messages.find((m: Message) => m.role === 'user');

      set((state: ChatState) => ({
        messages,
        isLoadingMessages: false,
        paginationState: {
          hasOlderMessages: pagination.hasOlder,
          oldestCursor: pagination.cursors.oldest,
          isLoadingOlder: false,
        },
        sessions: state.sessions.map((s: ChatSession) =>
          s.sessionId === sessionId && !s.title && firstUserMessage
            ? { ...s, title: firstUserMessage.content }
            : s
        ),
      }));
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const { messages: apiMessages } = await apiGetSessionMessagesPaginated(sessionId, 50);
          const messages = apiMessages.map((m: Message, index: number) => ({
            ...m,
            id: m.id || `${sessionId}-${index}`,
            timestamp: m.timestamp ?? Date.now(),
          }));
          set({ messages, isLoadingMessages: false });
        } catch (refreshErr) {
          set({ error: 'Session expired. Please log in again.', isLoadingMessages: false });
          window.location.href = '/login';
        }
      } else {
        set({ error: 'Failed to load messages', isLoadingMessages: false });
      }
    }
  },

  loadOlderMessages: async () => {
    const { 
      selectedSessionId, 
      messages, 
      paginationState,
      isLoadingMessages 
    } = get();
    
    // Don't load if:
    // - No session selected
    // - Already loading older messages
    // - Already loading messages in general
    // - No older messages available
    // - No cursor to use
    if (!selectedSessionId || 
        paginationState.isLoadingOlder || 
        isLoadingMessages || 
        !paginationState.hasOlderMessages || 
        !paginationState.oldestCursor) {
      return;
    }

    // Set loading state
    set((state: ChatState) => ({
      paginationState: {
        ...state.paginationState,
        isLoadingOlder: true,
      }
    }));

    try {
      // Load older messages using the oldest cursor
      const { messages: olderMessages, pagination } = await apiGetSessionMessagesPaginated(
        selectedSessionId,
        50,  // Load 50 more messages
        paginationState.oldestCursor  // Load messages OLDER than this cursor
      );

      // Process older messages
      const processedOlderMessages = olderMessages.map((m: Message, index: number) => ({
        ...m,
        id: m.id || `${selectedSessionId}-older-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));

      // Combine messages (older messages come first in chronological order)
      const allMessages = [...processedOlderMessages, ...messages];

      set((state: ChatState) => ({
        messages: allMessages,
        paginationState: {
          ...state.paginationState,
          hasOlderMessages: pagination.hasOlder,
          oldestCursor: pagination.cursors.oldest,
          isLoadingOlder: false,
        },
      }));
    } catch (err: any) {
      console.error('Failed to load older messages:', err);
      set((state: ChatState) => ({
        paginationState: {
          ...state.paginationState,
          isLoadingOlder: false,
        }
      }));
    }
  },

  deleteSession: async (sessionId: string) => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to delete sessions' });
      return;
    }

    try {
      await apiDeleteChatSession(sessionId);
      set((state: ChatState) => {
        const remaining = state.sessions.filter((s: ChatSession) => s.sessionId !== sessionId);
        const deletingActive = state.selectedSessionId === sessionId;

        return {
          sessions: remaining,
          selectedSessionId: deletingActive ? null : state.selectedSessionId,
          messages: deletingActive ? [] : state.messages,
          sessionsStatus: remaining.length > 0 ? 'ready' : 'empty',
        };
      });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          await apiDeleteChatSession(sessionId);
          set((state: ChatState) => {
            const remaining = state.sessions.filter((s: ChatSession) => s.sessionId !== sessionId);
            const deletingActive = state.selectedSessionId === sessionId;

            return {
              sessions: remaining,
              selectedSessionId: deletingActive ? null : state.selectedSessionId,
              messages: deletingActive ? [] : state.messages,
              sessionsStatus: remaining.length > 0 ? 'ready' : 'empty',
            };
          });
        } catch (refreshErr) {
          set({ error: 'Session expired. Please log in again.' });
          window.location.href = '/login';
        }
      } else {
        set({ error: 'Failed to delete session' });
      }
    }
  },

  createSession: async () => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to create a new session' });
      return;
    }

    const { selectedSessionId, messages } = get();

    // If we're already on a fresh chat with no messages, do nothing
    if (!selectedSessionId && messages.length === 0) {
      return;
    }

    // GPT-style: open a new chat interface WITHOUT creating a sidebar session yet.
    // The first sendMessage call will create the real backend session and insert it.
    set({
      selectedSessionId: null,
      messages: [],
      error: null,
    });
  },

  sendMessage: async (query: string) => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to send messages' });
      return;
    }

    let { selectedSessionId } = get();

    // Optimistically show the user message and thinking message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    set((state: ChatState) => ({ messages: [...state.messages, userMessage] }));

    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Thinking...',
      timestamp: Date.now() + 1,
      isLoading: true,
    };
    set((state: ChatState) => ({ messages: [...state.messages, thinkingMessage] }));

    const isTempSession = selectedSessionId?.startsWith('temp-');

    try {
      const { models, activeId } = useModelStore.getState();
      const activeModel = models.find((m) => m.id === activeId);
      const provider =
        activeModel?.provider === 'openai'
          ? 'openai'
          : 'gemini';

      const response = await apiSendMessage({
        query,
        session_id: !selectedSessionId || isTempSession ? undefined : selectedSessionId,
        provider,
        mode: 'generate',
      });

      const assistantMessage: Message = {
        id: response.query + Date.now().toString(),
        role: 'assistant',
        content: response.response || 'No response received',
        timestamp: Date.now(),
        responseId: response.responseId, // Store responseId for feedback
      };
      console.log('[useChatStore] Received response from backend:', {
        responseId: response.responseId,
        sessionId: response.session_id,
        content: response.response?.substring(0, 50) + '...'
      });

      const realSessionId = response.session_id;

      set((state: ChatState) => ({
        messages: state.messages.map((msg: Message) => (msg.id === thinkingMessage.id ? assistantMessage : msg)),
        // If this session still has no title, derive it from the first query
        sessions: (() => {
          // Replace temp session id with the real backend id, or insert if not present
          const existing = state.sessions.find((s: ChatSession) => s.sessionId === selectedSessionId || s.sessionId === realSessionId);
          if (!existing) {
            return [
              {
                sessionId: realSessionId,
                createdAt: new Date().toISOString(),
                title: query,
              },
              ...state.sessions,
            ];
          }

          return state.sessions.map((s: ChatSession) => {
            if (s.sessionId === selectedSessionId || s.sessionId === realSessionId) {
              return {
                ...s,
                sessionId: realSessionId,
                title: s.title || query,
              };
            }
            return s;
          });
        })(),
      }));

      // Ensure selectedSessionId is updated to the real backend id
      set((state: ChatState) => ({
        selectedSessionId: realSessionId,
      }));
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const { models, activeId } = useModelStore.getState();
          const activeModel = models.find((m) => m.id === activeId);
          const provider =
            activeModel?.provider === 'openai'
              ? 'openai'
              : 'gemini';

          const response = await apiSendMessage({
            query,
            session_id: !selectedSessionId || isTempSession ? undefined : selectedSessionId,
            provider,
            mode: 'generate',
          });

          const assistantMessage: Message = {
            id: response.query + Date.now().toString(),
            role: 'assistant',
            content: response.response || 'No response received',
            timestamp: Date.now(),
            responseId: response.responseId, // Store responseId for feedback
          };

          const realSessionId = response.session_id;

          set((state: ChatState) => ({
            messages: state.messages.map((msg: Message) => (msg.id === thinkingMessage.id ? assistantMessage : msg)),
            sessions: (() => {
              const existing = state.sessions.find((s: ChatSession) => s.sessionId === selectedSessionId || s.sessionId === realSessionId);
              if (!existing) {
                return [
                  {
                    sessionId: realSessionId,
                    createdAt: new Date().toISOString(),
                    title: query,
                  },
                  ...state.sessions,
                ];
              }

              return state.sessions.map((s: ChatSession) => {
                if (s.sessionId === selectedSessionId || s.sessionId === realSessionId) {
                  return {
                    ...s,
                    sessionId: realSessionId,
                    title: s.title || query,
                  };
                }
                return s;
              });
            })(),
          }));

          set((state: ChatState) => ({
            selectedSessionId: realSessionId,
          }));
          return;
        } catch (refreshErr) {
          set({ error: 'Session expired. Please log in again.' });
          window.location.href = '/login';
          return;
        }
      }

      const errorMessage: Message = {
        id: thinkingMessage.id,
        role: 'assistant',
        content: err?.response?.data?.detail || 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      set((state: ChatState) => ({
        messages: state.messages.map((msg: Message) => (msg.id === thinkingMessage.id ? errorMessage : msg)),
      }));
    }
  },

  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => {
    set((state: ChatState) => ({
      messages: state.messages.map((msg: Message) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    }));
  },
});

export const useChatStore = create<ChatState>(chatStoreCreator);