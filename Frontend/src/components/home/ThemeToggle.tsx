import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../hooks/useTheme"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
      ) : (
        <Sun className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
      )}
    </button>
  )
}

export default ThemeToggle