import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/modals/SettingsModal';
import { useChatStore } from '../store/useChatStore';
import { isAuthenticated } from '../lib/auth';

function Chat() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, isLoadingMessages, sendMessage } = useChatStore();

  function handleSuggestionClick(text: string) {
    sendMessage(text);
  }

  function handleFeedback(messageId: string, feedback: 'up' | 'down') {
    // Handle feedback logic here
    console.log('Feedback:', messageId, feedback);
  }

  // Open sidebar on desktop by default, close on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth guard: redirect to /login if not authenticated
  useEffect(() => {
    if (!isAuthenticated() && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [location.pathname, navigate]);

  // Don't render chat UI if not authenticated
  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
      {/* Left panel: sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Right panel: chat window */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {isLoadingMessages ? (
          <div className="flex-1 overflow-y-auto px-4 py-8" style={{ scrollbarWidth: 'thin' }}>
            <div className="mx-auto max-w-2xl space-y-4">
              {/* Skeleton bubbles mimicking chat messages, starting near the top and biased to the right */}
              <div className="flex justify-end mt-1">
                <div className="max-w-md rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-64 animate-pulse" />
              </div>
              <div className="flex justify-end">
                <div className="max-w-lg rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-80 animate-pulse" />
              </div>
              <div className="flex justify-end mt-2">
                <div className="max-w-xs rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-32 animate-pulse" />
              </div>
              <div className="flex justify-start mt-3">
                <div className="max-w-sm rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-56 animate-pulse" />
              </div>
              <div className="flex justify-end mt-3">
                <div className="max-w-md rounded-2xl rounded-br-sm bg-zinc-100 dark:bg-zinc-900 h-5 w-72 animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            onSuggestionClick={handleSuggestionClick}
            onFeedback={handleFeedback}
          />
        )}
        <MessageInput onSend={sendMessage} />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default Chat

