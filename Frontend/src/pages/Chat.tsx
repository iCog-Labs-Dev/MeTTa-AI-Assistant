import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import ChatHeader from "../components/chat/ChatHeader"
import MessageList from "../components/chat/MessageList"
import MessageInput from "../components/chat/MessageInput"
import ChatPlaygroundDock from "../components/chat/ChatPlaygroundDock"
import Sidebar from "../components/Sidebar"
import SettingsModal from "../components/modals/SettingsModal"
import { useChatStore } from "../store/useChatStore"
import { isAuthenticated } from "../lib/auth"
import { submitFeedback } from "../services/chatService"

function Chat() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [playgroundOpen, setPlaygroundOpen] = useState(() => window.innerWidth >= 1280)

  const navigate = useNavigate()
  const location = useLocation()

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
  } = useChatStore()

  function handleSuggestionClick(text: string) {
    sendMessage(text)
  }

  async function handleFeedback(
    messageId: string,
    feedback: "positive" | "neutral" | "negative"
  ) {
    const message = messages.find((m) => m.id === messageId)
    if (!message || !message.responseId || !selectedSessionId) {
      console.error("Cannot submit feedback: missing responseId or sessionId")
      return
    }

    const previousFeedback = message.feedback

    try {
      updateMessageFeedback(messageId, feedback)

      await submitFeedback({
        responseId: message.responseId,
        sessionId: selectedSessionId,
        sentiment: feedback,
      })
    } catch (error) {
      console.error("[Chat] Failed to submit feedback:", error)
      updateMessageFeedback(messageId, previousFeedback || null)
    }
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!isAuthenticated() && location.pathname !== "/login") {
      navigate("/login")
    }
  }, [location.pathname, navigate])
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
  if (!isAuthenticated()) {
    return null
  }

  const [restoredSessionId, setRestoredSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (
      selectedSessionId &&
      messages.length === 0 &&
      !isLoadingMessages &&
      restoredSessionId !== selectedSessionId
    ) {
      setRestoredSessionId(selectedSessionId)
      useChatStore.getState().selectSession(selectedSessionId)
    }
  }, [selectedSessionId, messages.length, isLoadingMessages, restoredSessionId])

  return (
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Main chat */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatHeader
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              onOpenSettings={() => setSettingsOpen(true)}
              onTogglePlayground={() => setPlaygroundOpen((prev) => !prev)}
              isPlaygroundOpen={playgroundOpen}
            />

          {isLoadingMessages ? (
            <div
              className="flex-1 overflow-y-auto px-4 py-8"
              style={{ scrollbarWidth: "thin" }}
            >
              <div className="mx-auto max-w-2xl space-y-4">
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
            />
          )}

          <MessageInput
            onSend={sendMessage}
            isSendingMessage={isSendingMessage}
          />
        </div>

        {/* Embedded playground */}
        <ChatPlaygroundDock
          isOpen={playgroundOpen}
          onToggle={() => setPlaygroundOpen((prev) => !prev)}
        />
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default Chat