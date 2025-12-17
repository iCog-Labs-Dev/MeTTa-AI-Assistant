import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors group"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors">
        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white dark:bg-gray-900 rounded-full shadow-sm transition-transform duration-200 ${
          theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
        }`}>
          {theme === 'dark' ? (
            <Moon className="w-2 h-2 absolute top-0.5 left-0.5 text-gray-400" />
          ) : (
            <Sun className="w-2 h-2 absolute top-0.5 left-0.5 text-yellow-500" />
          )}
        </div>
      </div>
      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}

export default ThemeToggle
