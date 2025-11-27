import type React from "react"
import { useState } from "react"
import AdminSidebar from "./AdminSidebar"
import AdminHeader from "./AdminHeader"
import { useUserStore } from "../../store/useUserStore"
import { useNavigate } from "react-router-dom"

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const userStore = useUserStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    userStore.logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black overflow-hidden">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} onLogout={handleLogout} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
