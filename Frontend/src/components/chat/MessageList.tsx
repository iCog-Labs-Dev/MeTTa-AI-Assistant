import { useEffect, useRef, useState } from "react";
import type { Message, SuggestionCard } from "../../types";
import ChatMessageItem from "./MessageBubble";

interface ChatMessageListProps {
  messages: Message[];
  onSuggestionClick: (text: string) => void;
  onFeedback?: (
    messageId: string,
    feedback: "positive" | "neutral" | "negative"
  ) => void;
  isStreaming: boolean;
  onLoadOlder?: () => Promise<number>;
  hasNextMessages?: boolean;
  isLoadingMoreMessages?: boolean;
}

const suggestionCards: SuggestionCard[] = [
  { title: "What is MeTTa?", subtitle: "Explain the basics" },
  { title: "Pattern matching", subtitle: "How does it work in MeTTa?" },
  { title: "Type system", subtitle: "MeTTa type checking explained" },
  { title: "Symbolic reasoning", subtitle: "Combining with neural networks" },
];

function MessageList({
  messages,
  onSuggestionClick,
  onFeedback,
  isStreaming,
  onLoadOlder,
  hasNextMessages = false,
  isLoadingMoreMessages = false,
}: ChatMessageListProps) {
  const showWelcome = messages.length === 0;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  const [stickToBottom, setStickToBottom] = useState(true);
  const lastMessageCountRef = useRef<number>(messages.length);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      setStickToBottom(true);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      lastMessageCountRef.current = messages.length;
    }
  }, [messages]);

  // Handle scrolling and stick-to-bottom / infinite scroll
  async function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    // Stick-to-bottom for streaming
    if (isStreaming) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const threshold = 100;
      setStickToBottom(distanceFromBottom <= threshold);
    }

    // Infinite scroll
    if (
      hasNextMessages &&
      onLoadOlder &&
      !isLoadingMoreMessages &&
      !isFetchingRef.current
    ) {
      const threshold = 24;
      if (container.scrollTop <= threshold) {
        isFetchingRef.current = true;
        const prevHeight = container.scrollHeight;
        const prevTop = container.scrollTop;
        try {
          await onLoadOlder();
          requestAnimationFrame(() => {
            const nextHeight = container.scrollHeight;
            const delta = nextHeight - prevHeight;
            container.scrollTop = prevTop + delta;
          });
        } finally {
          isFetchingRef.current = false;
        }
      }
    }
  }

  // Auto-scroll effect
  useEffect(() => {
    if (!isStreaming || !stickToBottom || isLoadingMoreMessages) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, stickToBottom, isLoadingMoreMessages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-8"
      style={{ scrollbarWidth: "thin" }}
      onScroll={handleScroll}
    >
      <div className="mx-auto max-w-2xl">
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h1 className="text-3xl font-semibold mb-1.5">
              What's on your mind today?
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
              Start a conversation with MeTTa AI
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full max-w-2xl">
              {suggestionCards.map((card) => (
                <button
                  key={card.title}
                  onClick={() =>
                    onSuggestionClick(`${card.title} ${card.subtitle}`)
                  }
                  className="text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                >
                  <div className="font-medium text-xs mb-0.5 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {card.title}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {card.subtitle}
                  </div>
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
  );
}

export default MessageList;
