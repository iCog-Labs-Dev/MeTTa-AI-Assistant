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
  const [messages, setMessages] = useState<Message[]>(EMPTY_MESSAGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null)

  // Load messages when switching threads
  useEffect(() => {
    const activeThread = threads.find(t => t.id === activeThreadId)
    if (activeThread) {
      setMessages(activeThread.messages)
    }
  }, [activeThreadId, threads])

  async function handleSend(text: string) {
    if (!text.trim()) return
    
    const userMessage: Message = {
      id: `m${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    
    // Add user message immediately
    setMessages(prev => [...prev, userMessage])
    
    // Update thread with user message
    setThreads(prev => prev.map(t => 
      t.id === activeThreadId 
        ? { ...t, messages: [...t.messages, userMessage], updatedAt: Date.now() }
        : t
    ))
    
    // Auto-rename "New Chat" to first message
    const activeThread = threads.find(t => t.id === activeThreadId)
    if (activeThread && activeThread.title === 'New Chat') {
      const newTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '')
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId ? { ...t, title: newTitle } : t
      ))
    }
    
    // Create temporary loading message
    const tempId = `m${Date.now() + 1}`
    const loadingMessage: Message = {
      id: tempId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: Date.now() + 100
    }
    
    setMessages(prev => [...prev, loadingMessage])
    setLoadingState({ threadId: activeThreadId, messageId: tempId })
    setIsLoading(true)
    
    try {
      // Call the actual API
      const response = await sendChatMessage(text)
      
      // Replace loading message with actual response
      const aiMessage: Message = {
        id: tempId,
        role: 'assistant',
        content: response.response,
        timestamp: Date.now()
      }
      
      setMessages(prev => prev.map(m => m.id === tempId ? aiMessage : m))
      
      // Update thread with AI message
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId 
          ? { ...t, messages: t.messages.map(m => m.id === tempId ? aiMessage : m), updatedAt: Date.now() }
          : t
      ))
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Replace loading message with error
      const errorMessage: Message = {
        id: tempId,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      }
      
      setMessages(prev => prev.map(m => m.id === tempId ? errorMessage : m))
      
      // Update thread with error message
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId 
          ? { ...t, messages: t.messages.map(m => m.id === tempId ? errorMessage : m), updatedAt: Date.now() }
          : t
      ))
    } finally {
      setIsLoading(false)
      setLoadingState(null)
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
    setMessages([])
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
        setMessages(remainingThreads[0].messages)
      } else {
        handleNewChat()
      }
    }
  }

  function handleFeedback(messageId: string, feedback: 'up' | 'down') {
    // Update message feedback in current messages
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback } : m
    ))
    
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


