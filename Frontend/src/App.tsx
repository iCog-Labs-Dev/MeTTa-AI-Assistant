import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import React, { useEffect } from "react"
import Auth from "./pages/Auth"
import Chat from "./pages/Chat"
import Admin from "./pages/Admin"
import NotFoundPage from "./pages/NotFound"
import { isAuthenticated as checkAuth, getUserRole } from "./lib/auth"
import { useUserStore } from "./store/useUserStore"
import { Toaster, toast } from "sonner"

function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const role = getUserRole()

  useEffect(() => {
    const validAuth = checkAuth()    
    if (!validAuth) {
      navigate("/login")
      return
    }
    if (role !== "admin") {
      toast.error("You need admin access", { id: "admin-access-denied" })
      navigate("/chat")
    }
  }, [isAuthenticated, role, navigate])

  if (!isAuthenticated || role !== "admin") {
    return null
  }

  return children
}

function App() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin/*" element={
          <AdminGuard>
            <Admin />
          </AdminGuard>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
