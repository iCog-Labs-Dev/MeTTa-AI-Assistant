import { Model } from '../types'
import { AVAILABLE_PROVIDERS } from '../store/useModelStore'

export interface ModelFormData {
  provider: string
  apiKey: string
}

// Creates a new model object from form data
export function createModelFromForm(formData: ModelFormData): Model {
  const id = formData.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
  return {
    id,
    name: formData.provider,
    apiKey: formData.apiKey,
    provider: formData.provider,
    isCustom: true
  }
}

// Updates model data from form
export function updateModelFromForm(formData: ModelFormData): Partial<Model> {
  return {
    name: formData.provider,
    apiKey: formData.apiKey,
    provider: formData.provider
  }
}

// Converts a model to form data for editing
export function modelToFormData(model: Model): ModelFormData {
  return {
    provider: model.provider || '',
    apiKey: model.apiKey || ''
  }
}

/**
 * Validates form data
 */
export function validateModelForm(formData: ModelFormData): boolean {
  const isValidProvider = AVAILABLE_PROVIDERS.some(p => p.name === formData.provider)
  return formData.provider.trim() !== '' && formData.apiKey.trim() !== '' && isValidProvider
}

/**
 * Gets available provider options
 */
export function getAvailableProviders() {
  return AVAILABLE_PROVIDERS
}

// Filters models by custom/built-in status
export function filterModels(models: Model[]) {
  return {
    customModels: models.filter(m => m.isCustom),
    builtInModels: models.filter(m => !m.isCustom)
  }
}
