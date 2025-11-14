import { useState, useEffect } from 'react'
import ChatLayout from '../layout/ChatLayout'
import ChatMessageList from '../components/chat/ChatMessageList'
import ChatInput from '../components/chat/ChatInput'
import SettingsModal from '../components/modals/SettingsModal'
import type { Thread, Message } from '../types'
import { sendChatMessage } from '../lib/chat'

// Empty initial messages for new chats
const EMPTY_MESSAGES: Message[] = []

// Loading state for chat responses
interface LoadingState {
  threadId: string;
  messageId: string;
}

function ChatPage() {
  const [threads, setThreads] = useState<Thread[]>([
    { id: 't1', title: 'New Chat', messages: EMPTY_MESSAGES, createdAt: Date.now(), updatedAt: Date.now() },
  ])
  const [activeThreadId, setActiveThreadId] = useState('t1')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null)

  const messages = threads.find(t => t.id === activeThreadId)?.messages || EMPTY_MESSAGES;

// In the handleSend function, update the loading message creation and state updates
  async function handleSend(text: string) {
    const activeThread = threads.find(t => t.id === activeThreadId);
    if (!activeThread) return;

    const isNewChat = activeThread.messages.length === 0;
    let currentSessionId = activeThread.sessionId;
  if (!text.trim() || isLoading) return;

  const userMessage: Message = {
    id: `m${Date.now()}`,
    role: 'user',
    content: text,
    timestamp: Date.now()
  };

  // Add user and loading messages to the active thread
  const tempId = `m${Date.now() + 1}`;
  const loadingMessage: Message = {
    id: tempId,
    role: 'assistant',
    content: 'Thinking...',
    timestamp: Date.now() + 1,
    isLoading: true
  };
  
      setThreads(prev =>
      prev.map(t =>
        t.id === activeThreadId
          ? { ...t, messages: [...t.messages, userMessage, loadingMessage] }
          : t
      )
    );
  setIsLoading(true);

                  try {
      const response = await sendChatMessage(text, undefined, currentSessionId);

      // If this is a new chat, update the thread with the session ID and title from the response
      if (isNewChat && response.session_id) {
        const newTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        setThreads(prev =>
          prev.map(t =>
            t.id === activeThreadId
              ? { ...t, sessionId: response.session_id, title: newTitle }
              : t
          )
        );
      }

      // Replace loading message with actual response
      const aiMessage: Message = {
        id: tempId, // Same ID as loading message to replace it
        role: 'assistant',
        content: response?.response || 'Sorry, I could not generate a response.',
        timestamp: Date.now()
      };

        setThreads(prev =>
      prev.map(t =>
        t.id === activeThreadId
          ? { ...t, messages: t.messages.map(m => m.id === tempId ? aiMessage : m) }
          : t
      )
    );

  } catch (error) {
    console.error('Error sending message:', error);
    // Update loading message with error
    const errorMessage: Message = {
      id: tempId,
      role: 'assistant',
      content: 'Sorry, there was an error processing your request.',
      timestamp: Date.now()
    };
        setThreads(prev =>
      prev.map(t =>
        t.id === activeThreadId
          ? { ...t, messages: t.messages.map(m => m.id === tempId ? errorMessage : m) }
          : t
      )
    );
  } finally {
    setIsLoading(false);
  }
}

  function handleNewChat() {
    // Only create new chat if we're not already on an empty new chat
    const currentThread = threads.find(t => t.id === activeThreadId)
    if (currentThread && currentThread.title === 'New Chat' && currentThread.messages.length === 0) {
      return // Already on a new empty chat, don't create another
    }
    
    const newId = `t${Date.now()}`
    const newThread: Thread = { 
      id: newId, 
      title: 'New Chat', 
      messages: [], 
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    }
    setThreads(prev => [newThread, ...prev])
    setActiveThreadId(newId)
      }

  function handleRenameThread(id: string, newTitle: string) {
    setThreads(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t))
  }

  function handleDeleteThread(id: string) {
    const remainingThreads = threads.filter(t => t.id !== id)
    setThreads(remainingThreads)
    // If deleting active thread, switch to another one
    if (id === activeThreadId) {
      if (remainingThreads.length > 0) {
        setActiveThreadId(remainingThreads[0].id)
              } else {
        handleNewChat()
      }
    }
  }

  function handleFeedback(messageId: string, feedback: 'up' | 'down') {
    // Update message feedback in threads
    setThreads(prev => prev.map(t => 
      t.id === activeThreadId 
        ? { 
            ...t, 
            messages: t.messages.map(m => 
              m.id === messageId ? { ...m, feedback } : m
            ) 
          }
        : t
    ))
  }

  return (
    <>
      <ChatLayout
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onNewChat={handleNewChat}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onOpenSettings={() => setIsSettingsOpen(true)}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatMessageList 
            messages={messages} 
            onSuggestionClick={handleSend} 
            onFeedback={handleFeedback}
          />
          <ChatInput onSend={handleSend} />
        </div>
      </ChatLayout>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  )
}

export default ChatPage


