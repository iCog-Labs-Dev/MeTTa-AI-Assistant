import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Model } from '../types'

type StoredModel = Omit<Model, 'apiKey'>

interface ModelState {
  models: StoredModel[]
  activeId: string
  addModel: (model: Model) => void
  updateModel: (id: string, updates: Partial<Model>) => void
  setActive: (id: string) => void
  removeModel: (id: string) => void
  clearCustomModels: () => void
}

// Default models available in the application (mirrors backend-supported presets)
const DEFAULT_MODELS: StoredModel[] = [
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    modelId: 'gemini-3.1-pro',
    provider: 'gemini',
    requiresApiKey: false,
  },
  {
    id: 'gemini-3.1-flash',
    name: 'Gemini 3.1 Flash',
    modelId: 'gemini-3.1-flash',
    provider: 'gemini',
    requiresApiKey: false,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    modelId: 'gpt-4.1-mini',
    provider: 'openai',
    requiresApiKey: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    requiresApiKey: true,
  },
];

const STORAGE_VERSION = 1

// Manages the collection of available models and the currently active model
export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      // Initial state with default models
      models: [...DEFAULT_MODELS],
      activeId: DEFAULT_MODELS[0].id,
      
      // Add a new model to the store, but never persist apiKey
      addModel: (model) =>
        set((state) => {
          const { apiKey, ...safeModel } = model as Model
          return {
            models: [...state.models, { ...safeModel, isCustom: true }],
            activeId: model.id,
          }
        }),
      
      // Update an existing model
      updateModel: (id, updates) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      
      // Set the active model by ID
      setActive: (id) => set({ activeId: id }),
      
      // Remove a model by ID
      removeModel: (id) =>
        set((state) => {
          const remaining = state.models.filter((m) => m.id !== id)
          return {
            models: remaining,
            activeId: state.activeId === id ? remaining[0]?.id || '' : state.activeId,
          }
        }),

      // Remove all custom models
      clearCustomModels: () =>
        set((state) => {
          const builtInModels = state.models.filter((m) => !m.isCustom)
          const isCustomActive = state.models.find(m => m.id === state.activeId)?.isCustom

          return {
            models: builtInModels,
            // If active model was custom, switch to first built-in option
            activeId: isCustomActive ? builtInModels[0]?.id || '' : state.activeId,
          }
        }),
    }),
    {
      name: 'model-storage',
      version: STORAGE_VERSION,
      migrate: (persistedState, version) => {
        if (!persistedState) return persistedState

        const storedModels = Array.isArray(persistedState.models) ? persistedState.models : []
        const customModels = storedModels.filter((model) => model.isCustom)

        const mergedModels = [
          ...DEFAULT_MODELS,
          ...customModels,
        ]

        const activeIdExists = mergedModels.some((model) => model.id === persistedState.activeId)

        return {
          ...persistedState,
          models: mergedModels,
          activeId: activeIdExists ? persistedState.activeId : DEFAULT_MODELS[0].id,
        }
      },
    }
  )
)
