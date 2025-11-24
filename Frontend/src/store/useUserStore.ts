import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearTokens } from '../lib/auth'

interface UserState {
  username: string
  email: string
  userId: string | null
  isAuthenticated: boolean
  accountCreatedAt: number | null
  setUser: (email: string, userId?: string) => void
  setUsername: (username: string) => void
  setIsAuthenticated: (value: boolean) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: '',
      email: '',
      userId: null,
      isAuthenticated: false, // Will be updated by auth.ts if tokens exist
      accountCreatedAt: null,
      setUser: (email, userId) => {
        const username = email.split('@')[0]
        set({
          username,
          email,
          userId: userId || null,
        })
      },
      setUsername: (username) => set({ username }),
      setIsAuthenticated: (value) => set({ isAuthenticated: value }),
      logout: () => {
        clearTokens()
        set({
          username: '',
          email: '',
          userId: null,
          isAuthenticated: false, // After clearing tokens, we know this is false
          accountCreatedAt: null,
        })
      },
    }),
    {
      name: 'user-storage',
    }
  )
)
