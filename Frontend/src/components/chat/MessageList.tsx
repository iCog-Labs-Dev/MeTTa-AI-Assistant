import { useEffect, useRef } from 'react'
import type { Message, SuggestionCard } from '../../types'
import ChatMessageItem from './MessageBubble'

interface ChatMessageListProps {
  messages: Message[]
  onSuggestionClick: (text: string) => void
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void
}

const suggestionCards: SuggestionCard[] = [
  { title: 'What is MeTTa?', subtitle: 'Explain the basics' },
  { title: 'Pattern matching', subtitle: 'How does it work in MeTTa?' },
  { title: 'Type system', subtitle: 'MeTTa type checking explained' },
  { title: 'Symbolic reasoning', subtitle: 'Combining with neural networks' },
]

function MessageList({ messages, onSuggestionClick, onFeedback }: ChatMessageListProps) {
  const showWelcome = messages.length === 0
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8" style={{ scrollbarWidth: 'thin' }}>
      <div className="mx-auto max-w-2xl">
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h1 className="text-3xl font-semibold mb-1.5">What's on your mind today?</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">Start a conversation with MeTTa AI</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-2xl">
              {suggestionCards.map((card) => (
                <button
                  key={card.title}
                  onClick={() => onSuggestionClick(`${card.title} ${card.subtitle}`)}
                  className="text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                >
                  <div className="font-medium text-xs mb-0.5 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{card.title}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{card.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-3">
            {messages.map((m) => (
              <ChatMessageItem key={m.id} message={m} onFeedback={onFeedback} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageList
