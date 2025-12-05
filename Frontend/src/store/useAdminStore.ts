import { create, type StateCreator } from "zustand"
import type { AdminStats, AnnotationStats, User, CodeChunk, Repository } from "../types/admin"
import {
  getAdminStats,
  getAnnotationStats,
  getUsers,
  getChunks,
  getRepositories,
  deleteUser as apiDeleteUser,
  createUser as apiCreateUser,
  startBatchAnnotation as apiStartBatchAnnotation,
  retryFailedAnnotations as apiRetryFailedAnnotations
} from "../services/adminService"

interface AdminState {
  stats: AdminStats | null
  annotationStats: AnnotationStats | null
  isLoadingStats: boolean

  users: User[]
  isLoadingUsers: boolean

  chunks: CodeChunk[]
  totalChunks: number
  isLoadingChunks: boolean

  repositories: Repository[]
  isLoadingRepositories: boolean

  isBatchProcessing: boolean
  error: string | null

  loadStats: () => Promise<void>
  loadAnnotationStats: () => Promise<void>
  loadUsers: () => Promise<void>
  loadChunks: (filters?: { 
    project?: string; 
    repository?: string; 
    section?: string; 
    search?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>
  loadRepositories: () => Promise<void>
  addUser: (userData: { email: string; password?: string; role: string }) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  startBatchAnnotation: (limit?: number) => Promise<void>
  retryFailedAnnotations: (includeQuotaExceeded: boolean) => Promise<void>
  clearError: () => void
}

const adminStoreCreator: StateCreator<AdminState> = (set) => ({
  stats: null,
  annotationStats: null,
  isLoadingStats: false,
  users: [],
  isLoadingUsers: false,
  chunks: [],
  totalChunks: 0,
  isLoadingChunks: false,
  repositories: [],
  isLoadingRepositories: false,
  isBatchProcessing: false,
  error: null,

  loadStats: async () => {
    set({ isLoadingStats: true, error: null })
    try {
      const data = await getAdminStats()
      set({ stats: data, isLoadingStats: false })
    } catch (err: any) {
      console.error("Failed to load stats:", err)
      set({ error: "Failed to load statistics", isLoadingStats: false })
    }
  },

  loadAnnotationStats: async () => {
    try {
      const data = await getAnnotationStats()
      set({ annotationStats: data })
    } catch (err: any) {
      console.error("Failed to load annotation stats:", err)
      set({ error: "Failed to load annotation stats" })
    }
  },

  loadUsers: async () => {
    set({ isLoadingUsers: true, error: null })
    try {
      const data = await getUsers()
      set({ users: data, isLoadingUsers: false })
    } catch (err: any) {
      console.error("Failed to load users:", err)
      set({ error: "Failed to load users", isLoadingUsers: false })
    }
  },

  loadChunks: async (filters = {}) => {
    set({ isLoadingChunks: true, error: null })
    try {
      const params = {
        project: filters.project,
        repo: filters.repository,
        section: filters.section,
        search: filters.search,
        page: filters.page || 1,
        limit: filters.limit || 10
      }

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v != null && v !== '')
      )

      const responseData = await getChunks(cleanParams)
      
      let data: CodeChunk[] = []
      let total = 0

      if (Array.isArray(responseData)) {
        data = responseData
        total = responseData.length
      } else {
        data = (responseData as any).items || []
        total = (responseData as any).total || data.length
      }
      
      set({ chunks: data, totalChunks: total, isLoadingChunks: false })
    } catch (err: any) {
      console.error("Failed to load chunks:", err)
      set({ error: "Failed to load chunks", isLoadingChunks: false })
    }
  },

  loadRepositories: async () => {
    set({ isLoadingRepositories: true, error: null })
    try {
      const data = await getRepositories()
      set({ repositories: data, isLoadingRepositories: false })
    } catch (err: any) {
      console.error("Failed to load repositories:", err)
      set({ error: "Failed to load repositories", isLoadingRepositories: false })
    }
  },

  addUser: async (userData) => {
    try {
      const newUser = await apiCreateUser(userData)
      set((state) => ({ users: [...state.users, newUser] }))
    } catch (err: any) {
      set({ error: "Failed to create user" })
      throw err
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await apiDeleteUser(userId)
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
      }))
    } catch (err: any) {
      set({ error: "Failed to delete user" })
    }
  },

  startBatchAnnotation: async (limit?: number) => {
    set({ isBatchProcessing: true, error: null })
    try {
      await apiStartBatchAnnotation(limit)
      set({ isBatchProcessing: false })
    } catch (err: any) {
      set({ error: "Failed to start batch annotation", isBatchProcessing: false })
      throw err
    }
  },

  retryFailedAnnotations: async (includeQuotaExceeded: boolean) => {
    set({ isBatchProcessing: true, error: null })
    try {
      await apiRetryFailedAnnotations(includeQuotaExceeded)
      set({ isBatchProcessing: false })
    } catch (err: any) {
      set({ error: "Failed to retry annotations", isBatchProcessing: false })
      throw err
    }
  },

  clearError: () => set({ error: null }),
})

export const useAdminStore = create<AdminState>(adminStoreCreator)
