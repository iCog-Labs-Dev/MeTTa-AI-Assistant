import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  username: string
  email: string
  isAuthenticated: boolean
  accountCreatedAt: number | null;
  setUser: (email: string) => void
  setUsername: (username: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: '',
      email: '',
      isAuthenticated: false,
      accountCreatedAt: null,
      setUser: (email) => {
        const username = email.split('@')[0]
        set({
          username,
          email,
          isAuthenticated: true,
        })
      },
      setUsername: (username) => set({ username }),
      logout: () =>
        set({
          username: '',
          email: '',
          isAuthenticated: false,
          accountCreatedAt: null,
        }),
    }),
    {
      name: 'user-storage',
    }
  )
)
