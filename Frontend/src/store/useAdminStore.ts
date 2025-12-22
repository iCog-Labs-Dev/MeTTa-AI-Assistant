import { create, type StateCreator } from "zustand"
import type { AdminStats, AnnotationStats, User, CodeChunk, Repository, ChunkFilters } from "../types/admin"
import {
  getAdminStats,
  getAnnotationStats,
  getUsers,
  getPaginatedChunks,
  getRepositories,
  deleteUser as apiDeleteUser,
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
  totalPages: number
  currentPage: number
  isLoadingChunks: boolean

  repositories: Repository[]
  isLoadingRepositories: boolean

  isBatchProcessing: boolean
  error: string | null

  loadStats: () => Promise<void>
  loadAnnotationStats: () => Promise<void>
  loadUsers: () => Promise<void>
  loadChunks: (filters?: ChunkFilters) => Promise<void>
  loadRepositories: () => Promise<void>
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
  totalPages: 1,
  currentPage: 1,
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

  loadChunks: async (filters: ChunkFilters = {}) => {
    set({ isLoadingChunks: true, error: null })
    try {
      const params = {
        project: filters.project,
        repository: filters.repository,
        section: filters.section,
        source: filters.source,
        search: filters.search,
        page: filters.page || 1,
        limit: filters.limit || 100
      }

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v != null && v !== '')
      )

      const responseData = await getPaginatedChunks(cleanParams)

      let data: CodeChunk[] = []
      if (responseData && typeof responseData === 'object' && 'chunks' in responseData) {
        data = responseData.chunks || []
        set({
          chunks: data,
          totalChunks: responseData.total || 0,
          totalPages: responseData.totalPages || 1,
          currentPage: responseData.page || 1,
          isLoadingChunks: false
        })
      } else {
        // Fallback for non-paginated response
        data = Array.isArray(responseData) ? responseData : []
        set({
          chunks: data,
          totalChunks: data.length,
          totalPages: 1,
          currentPage: 1,
          isLoadingChunks: false
        })
      }
    } catch (error) {
      console.error('Failed to load chunks:', error)
      set({
        error: 'Failed to load chunks',
        isLoadingChunks: false
      })
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
