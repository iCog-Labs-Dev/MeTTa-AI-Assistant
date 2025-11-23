import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react'
import type { Message } from '../../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageItemProps {
  message: Message
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void
}

function MessageBubble({ message, onFeedback }: ChatMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingDots, setLoadingDots] = useState('.')
  
  // Handle loading animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (message.isLoading) {
      interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev.length >= 3) return '.';
          return prev + '.';
        });
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [message.isLoading]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div 
        className="relative group max-w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`max-w-[min(100%,700px)] text-sm leading-relaxed break-words ${
          message.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black rounded-2xl px-3 py-2' : ''
        }`}>
          <div>
            {message.isLoading || message.content === 'Thinking...' ? (
            <div className="flex items-center">
              <span>Thinking</span>
              <span className="w-8 text-left">{loadingDots}</span>
            </div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          </div>
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
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
