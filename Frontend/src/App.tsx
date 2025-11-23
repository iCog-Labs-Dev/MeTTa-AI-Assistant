import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Auth from './pages/Auth'
import Chat from './pages/Chat'
import NotFoundPage from './pages/NotFound'
import { isAuthenticated } from './lib/auth'

function App() {
  // Initialize authentication state when app loads
  useEffect(() => {
    // This will sync the token-based auth state with the store
    isAuthenticated();
  }, []);
  
  const authed = isAuthenticated();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={authed ? '/chat' : '/login'} replace />
          }
        />
        <Route path="/login" element={<Auth />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
