import { useState } from 'react'
import { Plus, Search, ChevronLeft, Menu, MoreHorizontal } from 'lucide-react'
import ThemeToggle from '../components/ui/ThemeToggle'
import { SearchModal } from '../components/ui/SearchModal'
import { Button } from '../components/ui/button'
import type { Thread } from '../types'

interface SidebarProps {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onDeleteThread: (id: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

function Sidebar({ threads, activeId, onSelect, onNewChat, onRenameThread, onDeleteThread, isCollapsed, setIsCollapsed }: SidebarProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  return (
    <>
      <div className={`h-full bg-zinc-50 dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col ${
        isCollapsed 
          ? 'w-16 -translate-x-full lg:translate-x-0' 
          : 'w-64 translate-x-0'
      } fixed lg:relative z-40`} style={{ transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out' }}>
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
              onClick={onNewChat}
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

        {/* Expanded View Content - Fades in/out */}
        <div className={`flex flex-col flex-1 overflow-hidden transition-opacity ${isCollapsed ? 'duration-100 opacity-0 hidden' : 'duration-150 opacity-100 delay-150'}`}>
          {/* Header with Title */}
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

      {/* Navigation Items */}
      <div className="p-2 space-y-1">
        <button
          onClick={onNewChat}
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

      {/* Threads List with fixed height and scroll */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-2.5 py-1.5">
          Chats
        </div>
        <div className="overflow-y-auto h-[calc(100vh-280px)] scrollbar-thin space-y-1">
          {threads.length > 0 ? (
            threads.map(thread => (
              <div
                key={thread.id}
                className="relative group"
              >
                {editingId === thread.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => {
                      if (editingTitle.trim()) {
                        onRenameThread(thread.id, editingTitle.trim())
                      }
                      setEditingId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingTitle.trim()) {
                          onRenameThread(thread.id, editingTitle.trim())
                        }
                        setEditingId(null)
                      } else if (e.key === 'Escape') {
                        setEditingId(null)
                      }
                    }}
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-50"
                  />
                ) : (
                  <button
                    onClick={() => onSelect(thread.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
                      thread.id === activeId
                        ? 'bg-gray-100 dark:bg-gray-900 font-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                  >
                    {thread.title}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenu(activeMenu === thread.id ? null : thread.id)
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Options"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </button>
                
                {/* Thread options menu */}
                {activeMenu === thread.id && (
                  <div 
                    className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg overflow-hidden z-50"
                    onMouseLeave={() => setActiveMenu(null)}
                  >
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditingId(thread.id)
                        setEditingTitle(thread.title)
                        setActiveMenu(null)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setConfirmDeleteId(thread.id)
                        setActiveMenu(null)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-red-600 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-gray-500">
              No chats found
            </div>
          )}
        </div>
      </div>

      {/* Footer with Theme Toggle */}
          <div className="p-2.5 border-t border-gray-200 dark:border-gray-800">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        items={threads}
        filterFn={(thread, query) => {
          const lowerQuery = query.toLowerCase();
          return (
            thread.title.toLowerCase().includes(lowerQuery) ||
            thread.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
          );
        }}
        renderItem={(thread, isActive) => (
          <div className={`px-3 py-2 text-sm rounded-md cursor-pointer ${isActive ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{thread.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {thread.messages.length > 0 ? thread.messages[thread.messages.length - 1].content : 'No messages'}
            </p>
          </div>
        )}
        onSelectItem={(thread) => {
          onSelect(thread.id);
          setIsSearchModalOpen(false);
        }}
      />

      {/* Confirm Delete Modal */}
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
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (confirmDeleteId) {
                      onDeleteThread(confirmDeleteId)
                    }
                    setConfirmDeleteId(null)
                    setActiveMenu(null)
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
  )
}

export default Sidebar
