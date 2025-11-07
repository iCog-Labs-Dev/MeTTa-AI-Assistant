import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import type { Message } from '../../types'

interface ChatMessageItemProps {
  message: Message
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void
}

function ChatMessageItem({ message, onFeedback }: ChatMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div 
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-xs leading-[1.4] ${
          message.role === 'user' 
            ? 'bg-black dark:bg-white text-white dark:text-black' 
            : 'bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
        }`}>
          {message.content}
        </div>
        
        {/* Feedback buttons - only show for assistant messages */}
        {message.role === 'assistant' && onFeedback && (
          <div className={`flex items-center gap-1 mt-1 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <button
              onClick={() => onFeedback(message.id, 'up')}
              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                message.feedback === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : ''
              }`}
              title="Good response"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => onFeedback(message.id, 'down')}
              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                message.feedback === 'down' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : ''
              }`}
              title="Bad response"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatMessageItem
