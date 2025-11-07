import { useState, useEffect } from 'react'
import ChatLayout from '../layout/ChatLayout'
import ChatMessageList from '../components/chat/ChatMessageList'
import ChatInput from '../components/chat/ChatInput'
import SettingsModal from '../components/SettingsModal'
import type { Thread, Message } from '../types'

// Dummy MeTTa content for different threads
const METTA_INTRO_MESSAGES: Message[] = [
  { 
    id: 'm1', 
    role: 'assistant', 
    content: 'Hello! I\'m your MeTTa AI Assistant. MeTTa (Meta Type Talk) is a programming language designed for AI and cognitive computing. How can I help you learn about MeTTa today?', 
    timestamp: Date.now() - 10000 
  },
  { 
    id: 'm2', 
    role: 'user', 
    content: 'What is MeTTa?', 
    timestamp: Date.now() - 9000 
  },
  { 
    id: 'm3', 
    role: 'assistant', 
    content: 'MeTTa is a meta-language for AI that combines symbolic and sub-symbolic approaches. It\'s part of the OpenCog Hyperon project and is designed to enable more flexible and powerful AI reasoning. MeTTa supports pattern matching, type checking, and can work with neural networks seamlessly.', 
    timestamp: Date.now() - 8000 
  }
]

const RAG_BRAINSTORM_MESSAGES: Message[] = [
  { 
    id: 'm1', 
    role: 'assistant', 
    content: 'Let\'s brainstorm about RAG (Retrieval-Augmented Generation) in MeTTa!', 
    timestamp: Date.now() - 15000 
  },
  { 
    id: 'm2', 
    role: 'user', 
    content: 'How can I implement RAG with MeTTa?', 
    timestamp: Date.now() - 14000 
  },
  { 
    id: 'm3', 
    role: 'assistant', 
    content: 'In MeTTa, you can implement RAG by combining symbolic knowledge retrieval with neural embeddings. You\'d use MeTTa\'s pattern matching to query your knowledge base, then use the results to augment prompts for language models. The beauty of MeTTa is that it can natively handle both the symbolic reasoning and the neural components.', 
    timestamp: Date.now() - 13000 
  }
]

// AI response generator
function generateAIResponse(userMessage: string): string {
  const responses = [
    `That's an interesting question about "${userMessage}". In MeTTa, we approach this through symbolic reasoning combined with neural processing.`,
    `Great question! MeTTa's type system and pattern matching make it perfect for handling queries like "${userMessage}".`,
    `Let me help you with that. MeTTa provides powerful abstractions for working with concepts related to "${userMessage}".`,
    `Regarding "${userMessage}", MeTTa's meta-language capabilities allow for flexible representation and reasoning.`,
    `That's a key concept! In MeTTa, "${userMessage}" can be expressed using its unique combination of symbolic and sub-symbolic features.`
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

function ChatPage() {
  const [threads, setThreads] = useState<Thread[]>([
    { id: 't1', title: 'Introduction to MeTTa', messages: METTA_INTRO_MESSAGES, createdAt: Date.now() - 20000, updatedAt: Date.now() - 8000 },
    { id: 't2', title: 'RAG Implementation', messages: RAG_BRAINSTORM_MESSAGES, createdAt: Date.now() - 25000, updatedAt: Date.now() - 13000 },
  ])
  const [activeThreadId, setActiveThreadId] = useState('t1')
  const [messages, setMessages] = useState<Message[]>(METTA_INTRO_MESSAGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Load messages when switching threads
  useEffect(() => {
    const activeThread = threads.find(t => t.id === activeThreadId)
    if (activeThread) {
      setMessages(activeThread.messages)
    }
  }, [activeThreadId, threads])

  function handleSend(text: string) {
    if (!text.trim()) return
    
    const userMessage: Message = {
      id: `m${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    
    const aiMessage: Message = {
      id: `m${Date.now() + 1}`,
      role: 'assistant',
      content: generateAIResponse(text),
      timestamp: Date.now() + 500
    }
    
    setMessages(prev => [...prev, userMessage, aiMessage])
    
    // Update thread messages
    setThreads(prev => prev.map(t => 
      t.id === activeThreadId 
        ? { ...t, messages: [...t.messages, userMessage, aiMessage], updatedAt: Date.now() }
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


