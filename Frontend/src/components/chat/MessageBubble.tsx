import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, ThumbsDown, Meh, Copy, Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { CopyButton } from '../ui/copy-button'
import type { Message } from '../../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageItemProps {
  message: Message
  onFeedback?: (messageId: string, feedback: 'positive' | 'neutral' | 'negative') => void
}

const PreCode = ({ children, ...props }: any) => {
  const [isCopied, setIsCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    if (preRef.current) {
      const text = preRef.current.innerText || '';
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="relative group/code my-2">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1.5 rounded-md bg-white/10 dark:bg-black/50 text-zinc-400 opacity-0 group-hover/code:opacity-100 transition-all hover:bg-white/20 dark:hover:bg-black/70 hover:text-white z-10"
        title="Copy code"
      >
        {isCopied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
      <pre ref={preRef} {...props} className="!my-0">
        {children}
      </pre>
    </div>
  );
};

function MessageBubble({ message, onFeedback }: ChatMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false)
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

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className="relative group max-w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`max-w-[min(100%,700px)] text-sm leading-relaxed break-words ${message.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black rounded-2xl px-3 py-2' : ''
          }`}>
          <div>
            {message.isLoading || message.content === 'Thinking...' ? (
              <div className="flex items-center">
                <span>Thinking</span>
                <span className="w-8 text-left">{loadingDots}</span>
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: PreCode
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Feedback buttons - only show for assistant messages */}
        {message.role === 'assistant' && onFeedback && (
          <div className={`flex items-center gap-1 mt-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'
            }`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFeedback(message.id, 'positive')}
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${message.feedback === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : ''
                    }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Good response</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFeedback(message.id, 'neutral')}
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${message.feedback === 'neutral' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400' : ''
                    }`}
                >
                  <Meh className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Neutral response</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFeedback(message.id, 'negative')}
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${message.feedback === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : ''
                    }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Bad response</p>
              </TooltipContent>
            </Tooltip>

            <CopyButton textToCopy={message.content} />
          </div>
        )}

        {message.role === 'user' && (
          <div className={`flex justify-end mt-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <CopyButton textToCopy={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
