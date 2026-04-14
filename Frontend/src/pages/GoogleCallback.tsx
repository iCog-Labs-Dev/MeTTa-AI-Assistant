import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/useUserStore'
import { setTokens } from '../lib/auth'
import { jwtDecode } from 'jwt-decode'
import type { DecodedToken } from '../types/auth'

function GoogleCallback() {
  const navigate = useNavigate()
  const setUser  = useUserStore((state) => state.setUser)

  // In GoogleCallback.tsx — change the navigate calls to window.location.href
useEffect(() => {
    const params       = new URLSearchParams(window.location.search)
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const email        = params.get('email') ?? ''

    if (!accessToken || !refreshToken) {
      window.location.href = '/login'
      return
    }

    try {
      const decoded: DecodedToken = jwtDecode(accessToken)
      
      // Save tokens to localStorage first
      setTokens(accessToken, refreshToken)
      setUser(email, decoded.sub, decoded.role)

      // Hard redirect — forces a fresh page load so isAuthenticated()
      // reads from localStorage on a clean start
      window.location.href = decoded.role?.toLowerCase() === 'admin' ? '/admin' : '/chat'
    } catch (e) {
      console.error('JWT decode failed:', e)
      window.location.href = '/login'
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <p className="text-zinc-500">Signing you in...</p>
    </div>
  )
}

export default GoogleCallback