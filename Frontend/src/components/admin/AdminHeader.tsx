import { useState, useRef, useEffect } from "react"
import { Menu, Settings, LogOut } from "lucide-react"
import SettingsModal from "../modals/SettingsModal"
import { useUserStore } from "../../store/useUserStore"

interface AdminHeaderProps {
  onMenuClick: () => void
  onLogout: () => void
}

function AdminHeader({ onMenuClick, onLogout }: AdminHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const { email, username } = useUserStore()

  const displayName = username || (email ? email.split('@')[0] : 'Admin')
  const avatarInitial = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  return (
    <>
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-6 sticky top-0 z-40">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold shadow-sm group-hover:shadow-md transition-shadow">
                {avatarInitial}
              </div>
              <div className="hidden sm:block text-left">
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-950 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden py-1 z-50">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-900 mb-1">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{email}</p>
                </div>
                
                <div className="p-1">
                  <button 
                    onClick={() => {
                      setShowSettings(true)
                      setShowDropdown(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button 
                    onClick={() => {
                      onLogout()
                      setShowDropdown(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-sm text-red-600 dark:text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}

export default AdminHeader
