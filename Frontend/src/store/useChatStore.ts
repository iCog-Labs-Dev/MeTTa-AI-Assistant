import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSession, Message } from '../types/chat';
import {
  getChatSessions as apiGetChatSessions,
  getSessionMessages as apiGetSessionMessages,
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
  isSendingMessage: boolean;
  error: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  sendMessage: (query: string) => Promise<void>;
  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => void;
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
  isSendingMessage: false,
  error: null,

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
                set((state) => ({
                  sessions: state.sessions.map((session) =>
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
                    set((state) => ({
                      sessions: state.sessions.map((session) =>
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

      set((state) => ({
        sessions: [...state.sessions, ...newSessions.filter(ns => !state.sessions.some(s => s.sessionId === ns.sessionId))],
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
                set((state) => ({
                  sessions: state.sessions.map((session) =>
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

          set((state) => ({
            sessions: [...state.sessions, ...newSessions.filter(ns => !state.sessions.some(s => s.sessionId === ns.sessionId))],
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
                    set((state) => ({
                      sessions: state.sessions.map((session) =>
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

    set({ selectedSessionId: sessionId, isLoadingMessages: true, error: null });
    try {
      const apiMessages = await apiGetSessionMessages(sessionId);

      // Ensure every message has a stable id and timestamp for React keys and ordering
      const messages = apiMessages.map((m, index) => ({
        ...m,
        id: m.id || `${sessionId}-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));

      // Derive a title from the first user message if the session has no title yet
      const firstUserMessage = messages.find((m) => m.role === 'user');

      set((state) => ({
        messages,
        isLoadingMessages: false,
        sessions: state.sessions.map((s) =>
          s.sessionId === sessionId && !s.title && firstUserMessage
            ? { ...s, title: firstUserMessage.content }
            : s
        ),
      }));
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const apiMessages = await apiGetSessionMessages(sessionId);
          const messages = apiMessages.map((m, index) => ({
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

  deleteSession: async (sessionId: string) => {
    if (!isAuthenticated()) {
      set({ error: 'Please log in to delete sessions' });
      return;
    }

    try {
      await apiDeleteChatSession(sessionId);
      set((state) => {
        const remaining = state.sessions.filter((s) => s.sessionId !== sessionId);
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
          set((state) => {
            const remaining = state.sessions.filter((s) => s.sessionId !== sessionId);
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

    // Prevent sending if already sending a message
    const { isSendingMessage } = get();
    if (isSendingMessage) {
      return;
    }

    set({ isSendingMessage: true });
    let { selectedSessionId } = get();

    // Optimistically show the user message and thinking message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, userMessage] }));

    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Thinking...',
      timestamp: Date.now() + 1,
      isLoading: true,
    };
    set((state) => ({ messages: [...state.messages, thinkingMessage] }));

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
        id: response.messageId || Date.now().toString(),
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

      const realSessionId = response.session_id || selectedSessionId;

      set((state) => ({
        messages: state.messages.map((msg) => {
          // Replace thinking message with actual assistant response
          if (msg.id === thinkingMessage.id) return assistantMessage;
          // Update user message with backend ID
          if (msg.id === userMessage.id && response.userMessageId) {
            return { ...msg, id: response.userMessageId };
          }
          return msg;
        }),
        // If this session still has no title, derive it from the first query
        sessions: (() => {
          // Replace temp session id with the real backend id, or insert if not present
          const existing = state.sessions.find((s) => s.sessionId === selectedSessionId || s.sessionId === realSessionId);
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

          return state.sessions.map((s) => {
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
      set((state) => ({
        selectedSessionId: realSessionId,
        isSendingMessage: false,
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
            id: response.messageId || Date.now().toString(),
            role: 'assistant',
            content: response.response || 'No response received',
            timestamp: Date.now(),
            responseId: response.responseId, // Store responseId for feedback
          };

          const realSessionId = response.session_id || selectedSessionId;

          set((state) => ({
            messages: state.messages.map((msg) => {
              // Replace thinking message with actual assistant response
              if (msg.id === thinkingMessage.id) return assistantMessage;
              // Update user message with backend ID
              if (msg.id === userMessage.id && response.userMessageId) {
                return { ...msg, id: response.userMessageId };
              }
              return msg;
            }),
            sessions: (() => {
              const existing = state.sessions.find((s) => s.sessionId === selectedSessionId || s.sessionId === realSessionId);
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

              return state.sessions.map((s) => {
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

          set((state) => ({
            selectedSessionId: realSessionId,
            isSendingMessage: false,
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
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === thinkingMessage.id ? errorMessage : msg)),
        isSendingMessage: false,
      }));
    }
  },

  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    }));
  },
});

export const useChatStore = create<ChatState>()(
  persist(chatStoreCreator, {
    name: 'chat-storage',
    partialize: (state) => ({
      sessions: state.sessions,
      selectedSessionId: state.selectedSessionId,
    }),
  })
);
