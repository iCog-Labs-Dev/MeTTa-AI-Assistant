import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ModelSelector from '../ui/ModelSelector'
import { User, Settings, LogOut, Menu } from 'lucide-react'
import { useUserStore } from '../../store/useUserStore'

interface ChatHeaderProps {
  onToggleSidebar?: () => void
  onOpenSettings?: () => void
}

function ChatHeader({ onToggleSidebar, onOpenSettings }: ChatHeaderProps) {
  const navigate = useNavigate()
  const { username, email, logout } = useUserStore()
  const [showProfile, setShowProfile] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  
  const displayName = username || 'User'
  const avatarInitial = email ? email.charAt(0).toUpperCase() : 'U'
  
  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false)
      }
    }

    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfile])

  return (
    <header className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-black">
      <div className="flex items-center gap-2.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <ModelSelector />
      </div>
      <div className="flex items-center gap-2.5 relative" ref={profileRef}>
        <button 
          onClick={() => setShowProfile(!showProfile)}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex items-center justify-center text-xs font-semibold" 
          title="Profile"
        >
          {avatarInitial}
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg overflow-hidden z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm font-semibold">
                  {avatarInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{displayName}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{email || 'Not signed in'}</div>
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <button 
                onClick={() => {
                  onOpenSettings?.()
                  setShowProfile(false)
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xs text-red-600 dark:text-red-400"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default ChatHeader
