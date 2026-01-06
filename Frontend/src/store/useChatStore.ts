import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatSession, Message } from "../types/chat";
import {
  getChatSessions as apiGetChatSessions,
  getFirstUserMessage as apiGetFirstUserMessage,
  getSessionMessages as apiGetSessionMessages,
  getSessionMessagesCursor as apiGetSessionMessagesCursor,
  deleteChatSession as apiDeleteChatSession,
  sendMessage as apiSendMessage,
  streamMessage,
  ChatRequest,
} from "../services/chatService";
import { refreshAccessToken, isAuthenticated } from "../lib/auth";
import { useModelStore } from "./useModelStore";

interface ChatState {
  sessions: ChatSession[];
  messages: Message[];
  selectedSessionId: string | null;
  // Sidebar/session list loading state for better UX
  sessionsStatus: "idle" | "loading" | "ready" | "empty";
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
  updateMessageFeedback: ( messageId: string, feedback: "positive" | "neutral" | "negative" | null ) => void;
}

const chatStoreCreator: StateCreator<ChatState> = (set, get) => ({
  sessions: [],
  messages: [],
  selectedSessionId: null,
  sessionsStatus: "idle",
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
      set({ error: "Please log in to view chat sessions",  isLoadingSessions: false });
      return;
    }

    set({ isLoadingSessions: true, error: null, sessionsStatus: "loading" });

    try {
      const response = await apiGetChatSessions(1, 20);
      const sessions = response.sessions;

      // First, store the sessions and update high-level status
      set({
        sessions,
        isLoadingSessions: false,
        sessionsStatus: sessions.length > 0 ? "ready" : "empty",
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
            sessionsStatus: sessions.length > 0 ? "ready" : "empty",
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
        } catch {
          set({
            error: "Session expired. Please log in again.",
            isLoadingSessions: false,
            sessionsStatus: "empty",
          });
          // Redirect to login or handle token refresh failure
          window.location.href = "/login";
        }
      } else {
        set({ error: "Failed to load sessions", isLoadingSessions: false, sessionsStatus: "empty" });
      }
    }
  },

  loadMoreSessions: async () => {
    if (!isAuthenticated()) {
      set({ error: "Please log in to view more sessions" });
      return;
    }

    const { sessionsPage, hasMoreSessions } = get();
    if (!hasMoreSessions) return;

    const nextPage = sessionsPage + 1;

    try {
      const response = await apiGetChatSessions(nextPage, 20);
      const newSessions = response.sessions;

      set((state) => ({
        sessions: [...state.sessions, ...newSessions.filter((ns) => !state.sessions.some((s) => s.sessionId === ns.sessionId))],
        sessionsPage: nextPage,
        hasMoreSessions: response.has_next,
      }));

      // Derive titles for newly loaded sessions that don't have one yet, via the lightweight endpoint
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
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();
          const response = await apiGetChatSessions(nextPage, 20);
          const newSessions = response.sessions;

          set((state) => ({
            sessions: [...state.sessions, ...newSessions.filter((ns) => !state.sessions.some((s) => s.sessionId === ns.sessionId))],
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
          set({ error: "Session expired. Please log in again." });
          window.location.href = "/login";
        }
      } else {
        set({ error: "Failed to load more sessions" });
      }
    }
  },

  selectSession: async (sessionId: string) => {
    if (!isAuthenticated()) {
      set({ error: "Please log in to view messages", isLoadingMessages: false});
      return;
    }

    set({ selectedSessionId: sessionId, isLoadingMessages: true, error: null });
    try {
      const { messages: apiMessages, nextCursor, hasNext } = await apiGetSessionMessagesCursor(sessionId, 10);

      const messages = apiMessages.map((m, index) => ({
        ...m,
        id: m.id || `${sessionId}-${index}`,
        timestamp: m.timestamp ?? Date.now(),
      }));

      // Derive a title from the first user message if the session has no title yet
      const firstUserMessage = messages.find((m) => m.role === "user");

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
          const {
            messages: apiMessages,
            nextCursor,
            hasNext,
          } = await apiGetSessionMessagesCursor(sessionId, 10);

          const messages = apiMessages.map((m, index) => ({
            ...m,
            id: m.id || `${sessionId}-${index}`,
            timestamp: m.timestamp ?? Date.now(),
          }));

          set({ messages, isLoadingMessages: false, messagesNextCursor: nextCursor ?? null, hasNextMessages: !!hasNext });
        } catch {
          set({ error: "Session expired. Please log in again.", isLoadingMessages: false });
          window.location.href = "/login";
        }
      } else {
        set({ error: "Failed to load messages", isLoadingMessages: false });
      }
    }
  },

  loadOlderMessages: async () => {
    if (!isAuthenticated()) {
      set({ error: "Please log in to view messages" });
      return 0;
    }

    const { selectedSessionId, messagesNextCursor, hasNextMessages, isLoadingMoreMessages } = get();
    if ( !selectedSessionId || !hasNextMessages || !messagesNextCursor || isLoadingMoreMessages) {
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
        id:
          m.id ||
          `${selectedSessionId}-older-${messagesNextCursor}-${index}`,
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
        } catch {
          set({ error: "Session expired. Please log in again.", isLoadingMoreMessages: false });
          window.location.href = "/login";
          return 0;
        }
      }

      set({ error: "Failed to load more messages", isLoadingMoreMessages: false });
      return 0;
    }
  },

  deleteSession: async (sessionId: string) => {
    if (!isAuthenticated()) {
      set({ error: "Please log in to delete sessions" });
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
          sessionsStatus: remaining.length > 0 ? "ready" : "empty",
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
              sessionsStatus: remaining.length > 0 ? "ready" : "empty",
            };
          });
        } catch {
          set({ error: "Session expired. Please log in again." });
          window.location.href = "/login";
        }
      } else {
        set({ error: "Failed to delete session" });
      }
    }
  },

  createSession: async () => {
    if (!isAuthenticated()) {
      set({ error: "Please log in to create a new session" });
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
      set({ error: "Please log in to send messages" });
      return;
    }

    // Prevent sending if already sending a message
    const { isSendingMessage } = get();
    if (isSendingMessage) {
      return;
    }

    set({ isSendingMessage: true });

    let selectedSessionId = get().selectedSessionId;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
    }));

    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Thinking...",
      timestamp: Date.now() + 1,
      isLoading: true,
    };

    set((state) => ({
      messages: [...state.messages, thinkingMessage],
    }));

    const isTempSession = selectedSessionId?.startsWith("temp-") ?? false;

    const modelsState = useModelStore.getState();
    const activeModel = modelsState.models.find(
      (m) => m.id === modelsState.activeId
    );
    const provider: "openai" | "gemini" =
      activeModel?.provider === "openai" ? "openai" : "gemini";

    const baseRequest: ChatRequest = {
      query,
      session_id:
        !selectedSessionId || isTempSession ? undefined : selectedSessionId,
      provider,
      mode: "generate",
    };

    const updateSessionsWithRealId = (realSessionId: string) => {
      set((state) => {
        const existing = state.sessions.find(
          (s) =>
            s.sessionId === (selectedSessionId ?? "") ||
            s.sessionId === realSessionId
        );

        if (!existing) {
          return {
            sessions: [
              {
                sessionId: realSessionId,
                createdAt: new Date().toISOString(),
                title: query,
              },
              ...state.sessions,
            ],
          } as Partial<ChatState>;
        }

        return {
          sessions: state.sessions.map((s) => {
            if (
              s.sessionId === selectedSessionId ||
              s.sessionId === realSessionId
            ) {
              return {
                ...s,
                sessionId: realSessionId,
                title: s.title || query,
              };
            }
            return s;
          }),
        } as Partial<ChatState>;
      });
    };

    // Streaming first
    try {
      let accumulated = "";

      await streamMessage(
        baseRequest,
        (chunk: string) => {
          accumulated = chunk;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === thinkingMessage.id
                ? { ...thinkingMessage, content: accumulated }
                : msg
            ),
          }));
        },
        (payload: any) => {
          const finalText =
            payload?.response ??
            payload?.payload?.response ??
            accumulated ??
            "No response received";

          const responseId =
            payload?.responseId ?? payload?.payload?.responseId ?? undefined;

          const realSessionId =
            payload?.session_id ??
            payload?.sessionid ??
            payload?.payload?.session_id ??
            payload?.payload?.sessionid ??
            selectedSessionId;

          const assistantMessage: Message = {
            id: thinkingMessage.id,
            role: "assistant",
            content: finalText,
            timestamp: Date.now(),
            responseId,
          };

          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === thinkingMessage.id ? assistantMessage : msg
            ),
          }));

          if (realSessionId) {
            updateSessionsWithRealId(realSessionId);
            selectedSessionId = realSessionId;
            set({ selectedSessionId: realSessionId });
          }

          set({ isSendingMessage: false });
        },
        (errorText: string) => {
          const text = String(errorText || "Streaming error");
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === thinkingMessage.id
                ? {
                    ...thinkingMessage,
                    content: `Error: ${text}`,
                    isLoading: false,
                  }
                : msg
            ),
            isSendingMessage: false,
          }));
        }
      );

      return;
    } catch (streamErr) {
      console.error("[useChatStore] Streaming failed, falling back:", streamErr);
    }

    // FALLBACK TO NON-STREAMING sendMessage
    const runNonStreaming = async () => {
      const response = await apiSendMessage(baseRequest);

      const assistantMessage: Message = {
        id: response.messageId ?? thinkingMessage.id,
        role: "assistant",
        content: response.response ?? "No response received",
        timestamp: Date.now(),
        responseId: response.responseId,
      };

      const realSessionId = response.session_id;

      set((state) => ({
        messages: state.messages.map((msg) => {
          if (msg.id === thinkingMessage.id) {
            return assistantMessage;
          }
          if (msg.id === userMessage.id && response.userMessageId) {
            return { ...msg, id: response.userMessageId };
          }
          return msg;
        }),
      }));

      updateSessionsWithRealId(realSessionId);
      set({
        selectedSessionId: realSessionId,
        isSendingMessage: false,
      });
    };

    try {
      await runNonStreaming();
      return;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        try {
          await refreshAccessToken();

          selectedSessionId = get().selectedSessionId;
          const isTempSessionAfter =
            selectedSessionId?.startsWith("temp-") ?? false;

          const modelsState2 = useModelStore.getState();
          const activeModel2 = modelsState2.models.find(
            (m) => m.id === modelsState2.activeId
          );
          const provider2: "openai" | "gemini" =
            activeModel2?.provider === "openai" ? "openai" : "gemini";

          const retryRequest: ChatRequest = {
            query,
            session_id:
              !selectedSessionId || isTempSessionAfter
                ? undefined
                : selectedSessionId,
            provider: provider2,
            mode: "generate",
          };

          const response = await apiSendMessage(retryRequest);

          const assistantMessage: Message = {
            id: response.messageId ?? thinkingMessage.id,
            role: "assistant",
            content: response.response ?? "No response received",
            timestamp: Date.now(),
            responseId: response.responseId,
          };

          const realSessionId = response.session_id;

          set((state) => ({
            messages: state.messages.map((msg) => {
              if (msg.id === thinkingMessage.id) {
                return assistantMessage;
              }
              if (msg.id === userMessage.id && response.userMessageId) {
                return { ...msg, id: response.userMessageId };
              }
              return msg;
            }),
          }));

          updateSessionsWithRealId(realSessionId);
          set({
            selectedSessionId: realSessionId,
            isSendingMessage: false,
          });

          return;
        } catch {
          set({
            error: "Session expired. Please log in again.",
            isSendingMessage: false,
          });
          window.location.href = "/login";
          return;
        }
      }

      const errorMessage: Message = {
        id: thinkingMessage.id,
        role: "assistant",
        content:
          err?.response?.data?.detail ||
          "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === thinkingMessage.id ? errorMessage : msg
        ),
        isSendingMessage: false,
      }));
    }
  },

  updateMessageFeedback: (messageId: string, feedback: "positive" | "neutral" | "negative" | null) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ),
    }));
  },
});

export const useChatStore = create<ChatState>()(
  persist(chatStoreCreator, {
    name: "chat-storage",
    partialize: (state) => ({
      sessions: state.sessions,
      selectedSessionId: state.selectedSessionId,
    }),
  })
);
