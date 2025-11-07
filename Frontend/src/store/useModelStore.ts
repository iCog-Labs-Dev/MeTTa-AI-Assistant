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
        { id: 'metta', name: 'MeTTa', provider: 'Local', requiresApiKey: false },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', requiresApiKey: false },
        { id: 'gemini-flash', name: 'Gemini Flash', provider: 'Google', requiresApiKey: false },
        { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'Anthropic', requiresApiKey: false },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', requiresApiKey: false },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', requiresApiKey: false },
      ],
      activeId: 'metta',
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
