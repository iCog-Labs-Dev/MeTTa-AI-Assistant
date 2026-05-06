import { useState, useEffect, useRef } from "react";
import { getLearningStart } from "../services/learningModeService";
import { useNavigate, useLocation } from "react-router-dom";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import Sidebar from "../components/Sidebar";
import SettingsModal from "../components/modals/SettingsModal";
import { useChatStore } from "../store/useChatStore";
import { isAuthenticated } from "../lib/auth";
import { submitFeedback } from "../services/chatService";

// import { useRef } from "react";

interface ChatProps {
  learningMode?: boolean;
}

function Chat({ learningMode: propLearningMode = false }: ChatProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    messages,
    isLoadingMessages,
    isSendingMessage,
    sendMessage,
    selectedSessionId,
    updateMessageFeedback,
    loadOlderMessages,
    hasNextMessages,
    isLoadingMoreMessages,
    createLearningSession,
  } = useChatStore();

  // Local state to control learning mode UI, always synced with selected session
  const [isLearningMode, setIsLearningMode] = useState(propLearningMode);

  // Sync isLearningMode with the selected session
  useEffect(() => {
    const session = selectedSessionId
      ? useChatStore
          .getState()
          .sessions.find((s) => s.sessionId === selectedSessionId)
      : null;
    setIsLearningMode(!!session?.isLearning);
  }, [selectedSessionId]);

  // Insert the learning welcome/lessons as a persistent assistant message in learning mode
  useEffect(() => {
    if (
      isLearningMode &&
      selectedSessionId &&
      messages.length === 0 &&
      !isLoadingMessages
    ) {
      (async () => {
        try {
          const data = await getLearningStart();
          let msg = data.message || "";
          // Support both old (modules) and new (lessons) API
          let lessonTitles = "";
          if (
            data.lessons &&
            Array.isArray(data.lessons) &&
            data.lessons.length > 0
          ) {
            lessonTitles = data.lessons.map((l: any) => l.lesson).join(", ");
          } else if (
            data.modules &&
            Array.isArray(data.modules) &&
            data.modules.length > 0
          ) {
            lessonTitles = data.modules.map((m: any) => m.title).join(", ");
          }
          if (lessonTitles) {
            msg = msg.trim().replace(/[:\.]?$/, ":") + " " + lessonTitles;
          }
          // Insert as a real assistant message and persist
          const welcomeMsg = {
            id: `learning-welcome-${Date.now()}`,
            role: "assistant" as const,
            content: msg,
            timestamp: Date.now(),
          };
          useChatStore.setState((state) => {
            const newMessages = [...state.messages, welcomeMsg];
            // Persist in localStorage for this session
            try {
              localStorage.setItem(
                `chat-messages-${selectedSessionId}`,
                JSON.stringify(newMessages),
              );
            } catch {}
            return { messages: newMessages };
          });
        } catch (err) {
          // Optionally handle error
        }
      })();
    }
  }, [isLearningMode, selectedSessionId, messages.length, isLoadingMessages]);

  function handleSuggestionClick(text: string) {
    sendMessage(text);
  }

  async function handleFeedback(
    messageId: string,
    feedback: "positive" | "neutral" | "negative",
  ) {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.responseId || !selectedSessionId) {
      console.error("Cannot submit feedback: missing responseId or sessionId");
      return;
    }

    const previousFeedback = message.feedback;

    try {
      updateMessageFeedback(messageId, feedback);

      await submitFeedback({
        responseId: message.responseId,
        sessionId: selectedSessionId,
        sentiment: feedback,
      });
    } catch (error) {
      console.error("[Chat] Failed to submit feedback:", error);
      updateMessageFeedback(messageId, previousFeedback || null);
    }
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated() && location.pathname !== "/login") {
      navigate("/login");
    }
  }, [location.pathname, navigate]);

  if (!isAuthenticated()) {
    return null;
  }

  const [restoredSessionId, setRestoredSessionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      selectedSessionId &&
      messages.length === 0 &&
      selectedSessionId &&
      messages.length === 0 &&
      !isLoadingMessages &&
      restoredSessionId !== selectedSessionId
    ) {
      setRestoredSessionId(selectedSessionId);
      useChatStore.getState().selectSession(selectedSessionId);
    }
  }, [
    selectedSessionId,
    messages.length,
    isLoadingMessages,
    restoredSessionId,
  ]);

  // --- Learning Mode Integration ---
  useEffect(() => {
    function handleLearningMode() {
      (async () => {
        try {
          const data = await getLearningStart();
          // Add the welcome message as a real message in the selected session
          const { selectedSessionId, messages, sendMessage } =
            useChatStore.getState();
          // Only add if not already present (avoid duplicates)
          const alreadyExists = messages.some(
            (m) => m.content === data.message && m.role === "assistant",
          );
          if (!alreadyExists && selectedSessionId) {
            // Simulate a system/assistant message by calling sendMessage with a special flag
            // (Or, if you want to persist, you may need a backend endpoint for system messages)
            useChatStore.setState((state) => ({
              messages: [
                ...state.messages,
                {
                  id: `learning-welcome-${Date.now()}`,
                  role: "assistant",
                  content: data.message,
                  timestamp: Date.now(),
                  extra: { modules: data.modules, learningMode: true },
                },
              ],
            }));
          }
        } catch (err) {
          useChatStore.setState((state) => ({
            messages: [
              ...state.messages,
              {
                id: `learning-error-${Date.now()}`,
                role: "assistant",
                content: "Failed to start learning mode. Please try again.",
                timestamp: Date.now(),
              },
            ],
          }));
        }
      })();
    }
    window.addEventListener("start-learning-mode", handleLearningMode);
    return () =>
      window.removeEventListener("start-learning-mode", handleLearningMode);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right panel: chat window */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {/* Learning Mode button just below the header, only show if not in learning mode */}
        {!isLearningMode && (
          <div className="w-full flex justify-end px-6 pt-4">
            <button
              onClick={() => {
                createLearningSession();
                setIsLearningMode(true);
              }}
              className="px-3 py-1.5 rounded-xl border border-blue-500 text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-medium transition-colors shadow"
              title="Start Learning Mode"
            >
              🎓 Learning Mode
            </button>
          </div>
        )}
        {/* No separate learning welcome UI: it is now a persistent assistant message */}
        {isLoadingMessages ? (
          <div
            className="flex-1 overflow-y-auto px-4 py-8"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="mx-auto max-w-2xl space-y-4">
              {/* Skeleton bubbles mimicking chat messages, starting near the top and biased to the right */}
              <div className="flex justify-end mt-1">
                <div className="max-w-md rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-64 animate-pulse" />
              </div>
              <div className="flex justify-end">
                <div className="max-w-lg rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-80 animate-pulse" />
              </div>
              <div className="flex justify-end mt-2">
                <div className="max-w-xs rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-32 animate-pulse" />
              </div>
              <div className="flex justify-start mt-3">
                <div className="max-w-sm rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-56 animate-pulse" />
              </div>
              <div className="flex justify-end mt-3">
                <div className="max-w-md rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-72 animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            onSuggestionClick={handleSuggestionClick}
            onFeedback={handleFeedback}
            onLoadOlder={loadOlderMessages}
            hasNextMessages={hasNextMessages}
            isLoadingMoreMessages={isLoadingMoreMessages}
            showWelcomeUI={
              !(
                isLearningMode ||
                (selectedSessionId &&
                  useChatStore
                    .getState()
                    .sessions.find((s) => s.sessionId === selectedSessionId)
                    ?.isLearning)
              )
            }
          />
        )}
        <MessageInput
          onSend={sendMessage}
          isSendingMessage={isSendingMessage}
        />
      </div>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default Chat;
