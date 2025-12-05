import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Model } from '../types'

type StoredModel = Omit<Model, 'apiKey'>

interface ModelState {
  models: StoredModel[]
  activeId: string
  selectedVariant: string | null
  addModel: (model: Model) => void
  updateModel: (id: string, updates: Partial<Model>) => void
  setActive: (id: string) => void
  setSelectedVariant: (variant: string | null) => void
  removeModel: (id: string) => void
  clearCustomModels: () => void
}

const DEFAULT_MODELS: StoredModel[] = [
  {
    id: 'default',
    name: 'default',
    provider: 'default',
    requiresApiKey: false
  }
];

// Manages the collection of available models and the currently active model
export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      models: [...DEFAULT_MODELS],
      activeId: DEFAULT_MODELS[0].id,
      selectedVariant: null,

      addModel: (model) =>
        set((state) => {
          const { apiKey, ...safeModel } = model as Model
          return {
            models: [...state.models, { ...safeModel, isCustom: true }],
            activeId: model.id,
            selectedVariant: null,
          }
        }),

      // Update an existing model
      updateModel: (id, updates) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      setActive: (id) => set({ activeId: id, selectedVariant: null }),

      setSelectedVariant: (variant) => set({ selectedVariant: variant }),

      removeModel: (id) =>
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          activeId: state.activeId === id ? state.models[0]?.id || '' : state.activeId,
          selectedVariant: state.activeId === id ? null : state.selectedVariant,
        })),

      clearCustomModels: () =>
        set((state) => {
          const builtInModels = state.models.filter((m) => !m.isCustom)
          const isCustomActive = state.models.find(m => m.id === state.activeId)?.isCustom

          return {
            models: builtInModels,
            activeId: isCustomActive ? builtInModels[0]?.id || '' : state.activeId,
            selectedVariant: isCustomActive ? null : state.selectedVariant,
          }
        }),
    }),
    {
      name: 'model-storage',
    }
  )
)
