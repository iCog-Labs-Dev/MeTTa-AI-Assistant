import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import React from "react"
import Auth from "./pages/Auth"
import Chat from "./pages/Chat"
import Admin from "./pages/Admin"
import NotFoundPage from "./pages/NotFound"
import GoogleCallback from './pages/GoogleCallback'
import { isAuthenticated } from "./lib/auth"

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  useEffect(() => {
    isAuthenticated()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated() ? "/chat" : "/login"} replace />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
        <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/admin/*" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App