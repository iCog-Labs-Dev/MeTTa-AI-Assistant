import { useState, useEffect } from 'react';
import { Plus, Search, ChevronLeft, Menu, MoreHorizontal } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import ThemeToggle from './ui/ThemeToggle';
import { SearchModal } from './ui/SearchModal';
import { Button } from './ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    sessions,
    selectedSessionId,
    sessionsStatus,
    hasMoreSessions,
    isLoadingSessions,
    loadSessions,
    loadMoreSessions,
    selectSession,
    deleteSession,
    createSession,
  } = useChatStore();

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const sessionItems = sessions.map((s) => {
    const sessionId = s.sessionId;

    return {
      id: sessionId,
      title: s.title ?? '',
      isTitleLoading: !s.title,
      createdAt: new Date(s.createdAt).getTime(),
      sessionId,
    };
  });

  const handleSelect = (id: string) => {
    selectSession(id);
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  };

  const handleNewChat = () => {
    createSession();
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  };

  const handleDeleteSessionItem = (id: string) => {
    deleteSession(id);
    setConfirmDeleteId(null);
    setActiveMenu(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activeMenu) {
        setActiveMenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && typeof window !== 'undefined' && window.innerWidth < 1024 && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`h-full bg-zinc-50 dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col ${
          isCollapsed
            ? 'w-16 -translate-x-full lg:translate-x-0'
            : 'w-64'
        } fixed lg:relative z-40 ${
          !isOpen && typeof window !== 'undefined' && window.innerWidth < 1024
            ? '-translate-x-full'
            : 'translate-x-0'
        }`}
        style={{ transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out' }}
      >
        {/* Collapsed View */}
        <div className={`flex flex-col items-center py-3 gap-2 ${isCollapsed ? 'flex' : 'hidden'}`}>
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
            title="Expand sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Expanded View Content */}
        <div className={`flex flex-col flex-1 overflow-hidden transition-opacity ${isCollapsed ? 'duration-100 opacity-0 hidden' : 'duration-150 opacity-100 delay-150'}`}>
          <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">MeTTa AI Assistant</h1>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 space-y-1">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New chat</span>
            </button>
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xs text-zinc-600 dark:text-zinc-400"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-2">
            <div className="overflow-y-auto h-full scrollbar-thin space-y-1 pb-6">
              <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-2.5 py-1.5">Chats</div>
              {sessionItems.length > 0 ? (
                sessionItems.map(sessionItem => (
                  <div key={sessionItem.id} className="relative group">
                    <button
                      onClick={() => handleSelect(sessionItem.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
                        sessionItem.id === selectedSessionId
                          ? 'bg-gray-100 dark:bg-gray-900 font-medium shadow-sm'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-900 hover:shadow-sm'
                      }`}
                    >
                      {sessionItem.isTitleLoading ? (
                        <div className="h-3.5 w-28 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                      ) : (
                        <span>{sessionItem.title}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === sessionItem.id ? null : sessionItem.id);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Options"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                    {activeMenu === sessionItem.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg overflow-hidden z-50"
                        onMouseLeave={() => setActiveMenu(null)}
                      >
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDeleteId(sessionItem.id);
                            setActiveMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-red-600 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : sessionsStatus === 'empty' ? (
                <div className="px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-gray-500">No chats found</div>
              ) : null}

              {hasMoreSessions && (
                <button
                  onClick={() => loadMoreSessions()}
                  disabled={isLoadingSessions}
                  className="w-full mt-1 px-2.5 py-1.5 text-[11px] rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoadingSessions ? 'Loading more…' : 'Load more'}
                </button>
              )}
            </div>
          </div>

          <div className="p-2.5 border-t border-gray-200 dark:border-gray-800">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        items={sessionItems}
        filterFn={(sessionItem, query) => sessionItem.title.toLowerCase().includes(query.toLowerCase())}
        renderItem={(sessionItem, isActive) => (
          <div className={`px-3 py-2 text-sm rounded-md cursor-pointer ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{sessionItem.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              Chat history
            </p>
          </div>
        )}
        onSelectItem={(sessionItem) => {
          handleSelect(sessionItem.id);
          setIsSearchModalOpen(false);
        }}
      />

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-base font-semibold">Delete chat</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">This will permanently delete this chat and all its messages. This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (confirmDeleteId) {
                      handleDeleteSessionItem(confirmDeleteId);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
