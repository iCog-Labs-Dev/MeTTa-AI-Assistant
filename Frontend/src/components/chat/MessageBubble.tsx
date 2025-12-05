import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Meh, Copy, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { Message } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageItemProps {
  message: Message;
  onFeedback?: (messageId: string, feedback: 'positive' | 'neutral' | 'negative') => void;
}

function MessageBubble({ message, onFeedback }: ChatMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');

  // Handle loading animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (message.isLoading) {
      interval = setInterval(() => {
        setLoadingDots((prev) => {
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

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="relative group max-w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`max-w-[min(100%,700px)] text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-black dark:bg-white text-white dark:text-black rounded-2xl px-3 py-2'
              : ''
          }`}
        >
          <div>
            {message.isLoading && message.content === 'Thinking...' ? (
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

        {/* Feedback + copy buttons - only show for assistant messages */}
        {message.role === 'assistant' && onFeedback && (
          <div
            className={`flex items-center gap-1 mt-1 transition-opacity ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFeedback(message.id, 'positive')}
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                    message.feedback === 'positive'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : ''
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
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                    message.feedback === 'neutral'
                      ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
                      : ''
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
                  className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                    message.feedback === 'negative'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : ''
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Bad response</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{copied ? 'Copied!' : 'Copy message'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
