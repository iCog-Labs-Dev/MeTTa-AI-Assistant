import { Model } from '../types'
import { AVAILABLE_PROVIDERS, getProviderById } from '../lib/providers'

// Form data for creating or updating a model
export interface ModelFormData {
  provider: string
  apiKey: string
}

// Creates a new model object from form data
export function createModelFromForm(formData: ModelFormData): Model {
  // Generate a unique ID using the provider name and timestamp
  const id = formData.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
  
  // Get the provider info to use the correct name
  const providerInfo = getProviderById(formData.provider)
  const displayName = providerInfo?.displayName || formData.provider
  
  return {
    id,
    name: displayName,
    apiKey: formData.apiKey,
    provider: formData.provider,
    isCustom: true
  }
}

// Updates model data from form
export function updateModelFromForm(formData: ModelFormData): Partial<Model> {
  // Get the provider info to use the correct name
  const providerInfo = getProviderById(formData.provider)
  const displayName = providerInfo?.displayName || formData.provider
  
  return {
    name: displayName,
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

// Validates model form data
export function validateModelForm(formData: ModelFormData): boolean {
  const isValidProvider = AVAILABLE_PROVIDERS.some(provider => provider.id === formData.provider)
  return formData.provider.trim() !== '' && formData.apiKey.trim() !== '' && isValidProvider
}

// Gets available provider options
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
