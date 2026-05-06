import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSession, Message } from '../types/chat';
import {
  getChatSessions as apiGetChatSessions,
  getFirstUserMessage as apiGetFirstUserMessage,
  getSessionMessages as apiGetSessionMessages,
  getSessionMessagesCursor as apiGetSessionMessagesCursor,
  deleteChatSession as apiDeleteChatSession,
  sendMessage as apiSendMessage,
  streamMessage as apiStreamMessage,
  getSession as apiGetSession,
} from '../services/chatService';
import { getLearningStart } from '../services/learningModeService';
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
  messagesNextCursor: string | null;
  hasNextMessages: boolean;
  isLoadingMoreMessages: boolean;

  // Actions
  loadSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  loadOlderMessages: () => Promise<number>;
  deleteSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  sendMessage: (query: string) => Promise<void>;
  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => void;
  refreshSession: (sessionId: string) => Promise<void>;

  // Learning mode
  createLearningSession: (userId: string, moduleId: string) => void;
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
  messagesNextCursor: null,
  hasNextMessages: false,
  isLoadingMoreMessages: false,

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

      const sessionsNeedingTitles = sessions.filter((s) => !s.title);
      if (sessionsNeedingTitles.length > 0) {
        Promise.all(
          sessionsNeedingTitles.map(async (s) => {
            try {
              const { message } = await apiGetFirstUserMessage(s.sessionId);
              if (message?.content) {
                set((state) => ({
                  sessions: state.sessions.map((session) =>
                    session.sessionId === s.sessionId && !session.title
                      ? { ...session, title: message.content }
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
                  const { message } = await apiGetFirstUserMessage(s.sessionId);
                  if (message?.content) {
                    set((state) => ({
                      sessions: state.sessions.map((session) =>
                        session.sessionId === s.sessionId && !session.title
                          ? { ...session, title: message.content }
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

  createLearningSession: async (userId: string, moduleId: string) => {
    set({ isLoadingMessages: true, error: null });
    try {
      // Create a new session in the backend with a fixed message
      const response = await apiSendMessage({
        query: "Start learning",
        isLearning: true,
        moduleId,
      });

      // Set selectedSessionId to the new session_id returned from backend
      if (response && response.session_id) {
        set({ selectedSessionId: response.session_id });
      } else {
        set({ error: 'Learning session not created. Please try again.' });
        return;
      }

      // Reload sessions from backend (for sidebar/session list)
      await get().loadSessions();

      // 4. Fetch messages for the new session from backend (no static local messages)
      const { messages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(response.session_id, 10);
      // Fetch messages for the new session from backend (cursor-based)
      const messagesResp = await apiGetSessionMessagesCursor(response.session_id, 10);
      set({
        messages: messages || [],
        isLoadingMessages: false,
        messagesNextCursor: messagesResp.nextCursor || null,
        hasNextMessages: !!messagesResp.hasNext,
      });
    } catch (err) {
      set({
        error: 'Failed to create learning session',
        isLoadingMessages: false,
      });
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

      // Derive titles for newly loaded sessions that don't have one yet, via the lightweight endpoint
      {
        const sessionsNeedingTitlesMore = newSessions.filter((s) => !s.title);
        if (sessionsNeedingTitlesMore.length > 0) {
          Promise.all(
            sessionsNeedingTitlesMore.map(async (s) => {
              try {
                const { message } = await apiGetFirstUserMessage(s.sessionId);
                if (message?.content) {
                  set((state) => ({
                    sessions: state.sessions.map((session) =>
                      session.sessionId === s.sessionId && !session.title
                        ? { ...session, title: message.content }
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

          const sessionsNeedingTitlesMore = newSessions.filter((s) => !s.title);
          if (sessionsNeedingTitlesMore.length > 0) {
            Promise.all(
              sessionsNeedingTitlesMore.map(async (s) => {
                try {
                  const { message } = await apiGetFirstUserMessage(s.sessionId);
                  if (message?.content) {
                    set((state) => ({
                      sessions: state.sessions.map((session) =>
                        session.sessionId === s.sessionId && !session.title
                          ? { ...session, title: message.content }
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

    const { sessions } = get();
    const session = sessions.find((s) => s.sessionId === sessionId);
    set({ selectedSessionId: sessionId, isLoadingMessages: true, error: null });

    // Unified: always load messages from backend for both chat and learning mode
    if (session && session.isLearning) {
      set({ isLoadingMessages: true });
      try {
        const { messages: apiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(sessionId, 10);
        let messagesToSet = apiMessages.map((m, index) => ({
          ...m,
          id: m.id || `${sessionId}-${index}`,
          timestamp: m.timestamp ?? Date.now(),
        }));
        if (!messagesToSet.length) {
          try {
            const data = await getLearningStart();
            let msg = data.message || "";
            let lessonTitles = "";
            if (data.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
              lessonTitles = data.lessons.map((l: { lesson: string }) => l.lesson).join(", ");
            } else if (data.modules && Array.isArray(data.modules) && data.modules.length > 0) {
              lessonTitles = data.modules.map((m: { title: string }) => m.title).join(", ");
            }
            if (lessonTitles) {
              msg = msg.trim().replace(/[:\.]?$/, ":") + " " + lessonTitles;
            }
            const welcomeMsg = {
              id: `learning-welcome-${Date.now()}`,
              role: 'assistant' as const,
              content: msg,
              timestamp: Date.now(),
            };
            messagesToSet = [welcomeMsg];
          } catch {
            // fallback to static message if backend fails
            const welcomeMsg = {
              id: `learning-welcome-${Date.now()}`,
              role: 'assistant' as const,
              content: 'Hello, welcome to MeTTa learning mode! Here you will learn about MeTTa step by step. These are the major modules you can explore. You can progress in order, or if you feel comfortable, you can say things like \'jump to [module]\' to skip ahead. At any point, you may be quizzed to check your understanding!',
              timestamp: Date.now(),
            };
            messagesToSet = [welcomeMsg];
          }
        }
        set({
          messages: messagesToSet,
          isLoadingMessages: false,
          messagesNextCursor: nextCursor ?? null,
          hasNextMessages: !!hasNext,
        });
      } catch {
        set({
          messages: [],
          isLoadingMessages: false,
          messagesNextCursor: null,
          hasNextMessages: false,
        });
      }
      return;
    }

    // Normal chat: load from backend and persist
    try {
      const { messages: apiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(sessionId, 10);
      const messages = apiMessages.map((m, index) => ({
        ...m,
        id: m.id || `${sessionId}-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));
      // Persist messages for this session
      try {
        localStorage.setItem(`chat-messages-${sessionId}`, JSON.stringify(messages));
      } catch {}
      // Derive a title from the first user message if the session has no title yet
      const firstUserMessage = messages.find((m) => m.role === 'user');
      set((state) => ({
        messages,
        isLoadingMessages: false,
        messagesNextCursor: nextCursor ?? null,
        hasNextMessages: !!hasNext,
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
          const { messages: apiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(sessionId, 10);
          const messages = apiMessages.map((m, index) => ({
            ...m,
            id: m.id || `${sessionId}-${index}`,
            timestamp: m.timestamp ?? Date.now(),
          }));
          try {
            localStorage.setItem(`chat-messages-${sessionId}`, JSON.stringify(messages));
          } catch {}
          set({ messages, isLoadingMessages: false, messagesNextCursor: nextCursor ?? null, hasNextMessages: !!hasNext });
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
    if (!isAuthenticated()) {
      set({ error: 'Please log in to view messages' });
      return 0;
    }

    const { selectedSessionId, messagesNextCursor, hasNextMessages, isLoadingMoreMessages } = get();
    if (!selectedSessionId || !hasNextMessages || !messagesNextCursor || isLoadingMoreMessages) {
      return 0;
    }

    set({ isLoadingMoreMessages: true, error: null });

    const processOlderResponse = (
      olderApiMessages: Message[],
      nextCursor?: string | null,
      hasNext?: boolean
    ) => {
      const olderMessages = olderApiMessages.map((m, index) => ({
        ...m,
        id: m.id || `${selectedSessionId}-older-${messagesNextCursor}-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));

      set((state) => ({
        messages: [...olderMessages, ...state.messages],
        messagesNextCursor: nextCursor ?? null,
        hasNextMessages: !!hasNext,
        isLoadingMoreMessages: false,
      }));

      return olderMessages.length;
    };

    try {
      const { messages: olderApiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(
        selectedSessionId,
        10,
        messagesNextCursor
      );

      return processOlderResponse(olderApiMessages, nextCursor, hasNext);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const { messages: olderApiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(
            selectedSessionId,
            10,
            messagesNextCursor
          );

          return processOlderResponse(olderApiMessages, nextCursor, hasNext);
        } catch (refreshErr) {
          set({ error: 'Session expired. Please log in again.', isLoadingMoreMessages: false });
          window.location.href = '/login';
          return 0;
        }
      }

      set({ error: 'Failed to load more messages', isLoadingMoreMessages: false });
      return 0;
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
    let { selectedSessionId, sessions, messages } = get();

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

    // Unified chat/learning mode routing
    const session = sessions.find((s) => s.sessionId === selectedSessionId);
    const isLearning = !!(session && session.isLearning);
    const moduleId = session && session.isLearning ? session.moduleId : undefined;

    if (isLearning) {
      // Learning mode: always use non-streaming API
      try {
        const response = await apiSendMessage({
          query,
          session_id: selectedSessionId!,
          isLearning,
          moduleId,
        });
        set((state) => ({
          messages: [
            ...state.messages.filter((m) => !m.isLoading),
            {
              id: response.responseId || (Date.now() + 2).toString(),
              role: 'assistant',
              content: response.response,
              timestamp: Date.now() + 2,
            },
          ],
          isSendingMessage: false,
        }));
      } catch (err: any) {
        set({
          error: err?.response?.data?.detail || 'Chat error. Please try again.',
          isSendingMessage: false,
        });
      }
      return;
    }

    // Normal chat: streaming path
    try {
      // If no sessionId, create a new session on-the-fly
      let sessionId = selectedSessionId;
      let createdSessionId: string | null = null;
      let firstChunk = true;
      let assistantMessageId = (Date.now() + 2).toString();
      let assistantContent = '';

      await apiStreamMessage(
        {
          query,
          session_id: sessionId || undefined,
        },
        (event) => {
          if (event.type === 'start') {
            // Optionally handle start event
          } else if (event.type === 'chunk') {
            assistantContent += event.chunk || '';
            if (firstChunk) {
              // Remove thinking message and add assistant message
              set((state) => ({
                messages: [
                  ...state.messages.filter((m) => !m.isLoading),
                  {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: Date.now() + 2,
                    isLoading: true,
                  },
                ],
              }));
              firstChunk = false;
            } else {
              // Update assistant message content
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                ),
              }));
            }
          } else if (event.type === 'end') {
            // Finalize assistant message
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: assistantContent, isLoading: false }
                  : m
              ),
              isSendingMessage: false,
            }));
          } else if (event.type === 'error') {
            set({
              error: event.error || 'Chat error. Please try again.',
              isSendingMessage: false,
            });
          }
          // Handle session_id returned from backend (for new sessions)
          if (event.session_id && !sessionId) {
            createdSessionId = event.session_id;
            set({ selectedSessionId: event.session_id });
            sessionId = event.session_id;
            // Optionally reload sessions list
            get().loadSessions();
          }
        }
      );
      // If a new session was created, reload sessions and messages
      if (createdSessionId) {
        await get().loadSessions();
        // Optionally reload messages for the new session
        // const messagesResp = await apiGetSessionMessages(createdSessionId);
        // set({ messages: messagesResp });
      }
      set({ isSendingMessage: false });
    } catch (err: any) {
      set({
        error: err?.response?.data?.detail || err?.message || 'Chat error. Please try again.',
        isSendingMessage: false,
      });
    }
    return;
  },

  updateMessageFeedback: (messageId: string, feedback: 'positive' | 'neutral' | 'negative' | null) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    }));
  },

  refreshSession: async (sessionId: string) => {
    try {
      const sessionData = await apiGetSession(sessionId, false);
      
      if (sessionData.title) {
         set((state) => ({
           sessions: state.sessions.map((s) => 
             s.sessionId === sessionId ? { ...s, title: sessionData.title } : s
           ),
         }));
      }
    } catch (error) {
       console.error("Failed to refresh session title:", error);
    }
  },
});

export const useChatStore = create<ChatState>()(
  persist(chatStoreCreator, {
    name: 'chat-storage',
    partialize: (state) => ({
      sessions: state.sessions,
      selectedSessionId: state.selectedSessionId,
      messages: state.messages,
    }),
  })
);
