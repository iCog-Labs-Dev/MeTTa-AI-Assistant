import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Model } from '../types'

interface ModelState {
  models: Model[]
  activeId: string
  addModel: (model: Model) => void
  updateModel: (id: string, updates: Partial<Model>) => void
  setActive: (id: string) => void
  removeModel: (id: string) => void
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      models: [
        { id: 'default', name: 'Default', provider: 'Local', requiresApiKey: false },
      ],
      activeId: 'default',
      addModel: (model) =>
        set((state) => ({
          models: [...state.models, { ...model, isCustom: true }],
          activeId: model.id,
        })),
      updateModel: (id, updates) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      setActive: (id) => set({ activeId: id }),
      removeModel: (id) =>
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          activeId: state.activeId === id ? state.models[0]?.id || '' : state.activeId,
        })),
    }),
    {
      name: 'model-storage',
    }
  )
)
