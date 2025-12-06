import { useEffect, useRef, useCallback, useState } from "react";
import type { Message, SuggestionCard } from "../../types";
import ChatMessageItem from "./MessageBubble";
import { useChatStore } from "../../store/useChatStore";

interface ChatMessageListProps {
  messages: Message[];
  onSuggestionClick: (text: string) => void;
  onFeedback?: (
    messageId: string,
    feedback: "positive" | "neutral" | "negative"
  ) => void;
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
}: ChatMessageListProps) {
  const showWelcome = messages.length === 0;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null); // FIXED: Added initial value

  // Get store functions for loading more messages
  const { loadOlderMessages, paginationState } = useChatStore();
  const { hasOlderMessages, isLoadingOlder } = paginationState;

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && messages.length > 0 && !isUserScrolling) {
      // Check if user is near bottom (within 100px)
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      // Auto-scroll only if near bottom or it's initial load
      if (isNearBottom || messages.length <= 50) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }, 100);
      }
    }
  }, [messages, isUserScrolling]);

  // Infinite scroll: load older messages when scrolling to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingOlder || !hasOlderMessages) return;

    // Mark that user is actively scrolling
    setIsUserScrolling(true);

    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a timeout to reset the scrolling flag
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 500);

    // Calculate scroll position
    const scrollTop = container.scrollTop;

    // Load more when 200px from top (adjustable)
    const triggerPoint = 200;
    if (scrollTop < triggerPoint) {
      loadOlderMessages();
    }
  }, [isLoadingOlder, hasOlderMessages, loadOlderMessages]);

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [handleScroll]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-8"
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="mx-auto max-w-2xl">
        {showWelcome ? (
          // Welcome screen (unchanged)
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
            {/* Loading indicator for older messages */}
            {isLoadingOlder && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-300 dark:border-gray-600"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Loading older messages...
                </p>
              </div>
            )}
            {/* "Load more" button as alternative to auto-load */}
            {hasOlderMessages && !isLoadingOlder && (
              <div className="text-center py-4">
                <button
                  onClick={loadOlderMessages}
                  disabled={isLoadingOlder}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load older messages
                </button>
              </div>
            )}
            {/* Messages list */}
            {messages.map((m) => (
              <ChatMessageItem key={m.id} message={m} onFeedback={onFeedback} />
            ))}
            {/* Scroll anchor for auto-scroll to bottom */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageList;
