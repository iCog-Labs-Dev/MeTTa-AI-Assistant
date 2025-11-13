import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Model } from '../types'
import { AVAILABLE_PROVIDERS, getProviderById } from '../lib/providers'

interface ModelState {
  models: Model[]
  activeId: string
  addModel: (model: Model) => void
  updateModel: (id: string, updates: Partial<Model>) => void
  setActive: (id: string) => void
  removeModel: (id: string) => void
}

// Default models available in the application
const DEFAULT_MODELS: Model[] = [
  { 
    id: 'default-gemini', 
    name: 'Default Gemini', 
    provider: 'gemini', 
    requiresApiKey: false 
  }
];

// Manages the collection of available models and the currently active model
export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      // Initial state with default models
      models: [...DEFAULT_MODELS],
      activeId: DEFAULT_MODELS[0].id,
      
      // Add a new model to the store
      addModel: (model) =>
        set((state) => ({
          models: [...state.models, { ...model, isCustom: true }],
          activeId: model.id,
        })),
      
      // Update an existing model
      updateModel: (id, updates) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      
      // Set the active model by ID
      setActive: (id) => set({ activeId: id }),
      
      // Remove a model by ID
      removeModel: (id) =>
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
          // If removing the active model, fall back to the first available model
          activeId: state.activeId === id ? state.models[0]?.id || '' : state.activeId,
        })),
    }),
    {
      name: 'model-storage',
    }
  )
)
