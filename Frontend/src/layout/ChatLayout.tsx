import { ReactNode, useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import ChatHeader from '../components/chat/ChatHeader'
import type { Thread } from '../types'

interface ChatLayoutProps {
  children: ReactNode
  threads: Thread[]
  activeThreadId: string
  onSelectThread: (id: string) => void
  onNewChat: () => void
  onRenameThread: (id: string, newTitle: string) => void
  onDeleteThread: (id: string) => void
  onOpenSettings: () => void
}

function ChatLayout({ 
  children, 
  threads, 
  activeThreadId, 
  onSelectThread, 
  onNewChat,
  onRenameThread,
  onDeleteThread,
  onOpenSettings
}: ChatLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed on mobile

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCollapsed(true);
      }
    };

    // Check if desktop on mount
    const checkDesktop = () => {
      if (window.innerWidth >= 1024) {
        setIsCollapsed(false);
      }
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('resize', checkDesktop);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
      {/* Backdrop overlay for mobile */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-zinc-900/20 dark:bg-zinc-50/10 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        ></div>
      )}
      <Sidebar 
        threads={threads} 
        activeId={activeThreadId} 
        onSelect={onSelectThread}
        onNewChat={onNewChat}
        onRenameThread={onRenameThread}
        onDeleteThread={onDeleteThread}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <div className="flex-1 flex flex-col">
        <ChatHeader 
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)} 
          onOpenSettings={onOpenSettings}
        />
        {children}
      </div>
    </div>
  )
}

export default ChatLayout
