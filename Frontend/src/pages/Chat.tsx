import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import Sidebar from "../components/Sidebar";
import SettingsModal from "../components/modals/SettingsModal";
import { useChatStore } from "../store/useChatStore";
import { isAuthenticated } from "../lib/auth";
import { submitFeedback } from "../services/chatService";

function Chat() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    messages,
    isLoadingMessages,
    sendMessage,
    selectedSessionId,
    updateMessageFeedback,
    sessions,
    loadSessions,
    selectSession,
    paginationState, // ADD THIS: Import paginationState for testing
  } = useChatStore();

  // --- ADD THIS FOR TEST: Auto-select a test session when no sessions exist ---
  useEffect(() => {
    if (isAuthenticated()) {
      loadSessions();
    }
  }, []);

  useEffect(() => {
    // Wait a moment for sessions to load, then auto-select a test session
    const timer = setTimeout(() => {
      if (sessions.length === 0 && isAuthenticated()) {
        console.log("🔍 No sessions found, creating test session...");
        // Create a test session ID
        const testSessionId = "test_session_" + Date.now();
        selectSession(testSessionId);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessions]);
  // --- END TEST CODE ---

  function handleSuggestionClick(text: string) {
    sendMessage(text);
  }

  async function handleFeedback(
    messageId: string,
    feedback: "positive" | "neutral" | "negative"
  ) {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.responseId || !selectedSessionId) {
      console.error("Cannot submit feedback: missing responseId or sessionId");
      return;
    }

    const previousFeedback = message.feedback;

    try {
      console.log("[Chat] handleFeedback called:", {
        messageId,
        feedback,
        responseId: message.responseId,
        sessionId: selectedSessionId,
      });

      // Update local state immediately for better UX
      updateMessageFeedback(messageId, feedback);

      // Submit feedback to backend
      await submitFeedback({
        responseId: message.responseId,
        sessionId: selectedSessionId,
        sentiment: feedback,
      });
      console.log("[Chat] Feedback submitted successfully");
    } catch (error) {
      console.error("[Chat] Failed to submit feedback:", error);
      // Revert optimistic update on error
      updateMessageFeedback(messageId, previousFeedback || null);
    }
  }

  // Open sidebar on desktop by default, close on mobile
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

  // Auth guard: redirect to /login if not authenticated
  useEffect(() => {
    if (!isAuthenticated() && location.pathname !== "/login") {
      navigate("/login");
    }
  }, [location.pathname, navigate]);

  // Don't render chat UI if not authenticated
  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
      {/* Left panel: sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right panel: chat window */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* --- ADD THIS FOR TEST: Debug info panel (remove later) --- */}
        {process.env.NODE_ENV === "development" && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b">
            <div className="max-w-2xl mx-auto text-xs flex items-center justify-between">
              <div>
                <span className="font-medium">🔍 Debug Info:</span>
                <span className="ml-2">Messages: {messages.length}</span>
                <span className="ml-2">
                  Has Older: {paginationState.hasOlderMessages ? "✅" : "❌"}
                </span>
                <span className="ml-2">
                  Session: {selectedSessionId || "None"}
                </span>
              </div>
              <button
                onClick={() => {
                  const testSessionId = "test_" + Date.now();
                  selectSession(testSessionId);
                }}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
              >
                New Test Session
              </button>
            </div>
          </div>
        )}
        {/* --- END TEST CODE --- */}

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
          />
        )}
        <MessageInput onSend={sendMessage} />
      </div>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default Chat;
