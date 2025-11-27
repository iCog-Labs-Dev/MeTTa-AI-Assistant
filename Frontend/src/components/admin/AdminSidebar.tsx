import { useLocation, Link } from "react-router-dom"
import { BarChart3, Users, FileText, Upload, CheckSquare, Menu } from "lucide-react"
import { useState } from "react"
import ThemeToggle from "../ui/ThemeToggle"

interface AdminSidebarProps {
  isOpen: boolean
  onClose?: () => void
}

function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isActive = (path: string) => {
    return location.pathname === `/admin${path}` || (path === "/" && location.pathname === "/admin")
  }

  const navItems = [
    { label: "Dashboard", path: "/", icon: BarChart3 },
    { label: "Annotations", path: "/annotations", icon: CheckSquare },
    { label: "Users", path: "/users", icon: Users },
    { label: "Chunks", path: "/chunks", icon: FileText },
    { label: "Repository Ingestion", path: "/repositories", icon: Upload },
  ]

  return (
    <>
      <div
        className={`${
          isCollapsed ? "w-20" : "w-64"
        } bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed lg:relative z-40 h-full transition-all duration-300 ${
          !isOpen && typeof window !== "undefined" && window.innerWidth < 1024 ? "-translate-x-full" : "translate-x-0"
        }`}
      >

        <div className="px-4 py-4 flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap overflow-hidden">
              MeTTa AI Assistant
            </h1>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 ${isCollapsed ? "mx-auto" : ""}`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={`/admin${path}`}
              onClick={onClose}
              title={isCollapsed ? label : ""}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(path)
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              } ${isCollapsed ? "justify-center px-2" : ""}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm whitespace-nowrap overflow-hidden">{label}</span>}
            </Link>
          ))}
        </nav>

        {!isCollapsed && (
          <div className="p-4 border-t border-zinc-300 dark:border-zinc-800">
             <div className="flex items-center gap-3 px-2">
               <ThemeToggle />
             </div>
          </div>
        )}
      </div>
    </>
  )
}

export default AdminSidebar
