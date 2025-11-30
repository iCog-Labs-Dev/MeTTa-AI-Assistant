import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import Auth from "./pages/Auth"
import Chat from "./pages/Chat"
import Admin from "./pages/Admin"
import NotFoundPage from "./pages/NotFound"
import { isAuthenticated } from "./lib/auth"

function App() {
  useEffect(() => {
    isAuthenticated()
  }, [])

  const authed = isAuthenticated()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={authed ? "/chat" : "/login"} replace />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
