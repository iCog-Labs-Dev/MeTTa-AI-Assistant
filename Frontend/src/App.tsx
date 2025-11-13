import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import LoginSignupPage from './pages/LoginSignup'
import ChatPage from './pages/Chat'
import { isAuthenticated } from './lib/api'

function App() {
  // Initialize authentication state when app loads
  useEffect(() => {
    // This will sync the token-based auth state with the store
    isAuthenticated();
  }, []);
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginSignupPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
