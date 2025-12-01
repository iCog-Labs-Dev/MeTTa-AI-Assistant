import { Model } from '../types'
import { AVAILABLE_PROVIDERS, getProviderById } from '../lib/providers'

// Form data for creating or updating a model
export interface ModelFormData {
  id?: string
  provider: string
  apiKey: string
  keyName?: string
}

// Creates a new model object from form data
export function createModelFromForm(formData: ModelFormData): Model {
  // Use provided ID or generate a unique ID using the provider name and timestamp
  const id = formData.id || formData.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()

  // Get the provider info to use the correct name
  const providerInfo = getProviderById(formData.provider)
  // Use keyName if provided, otherwise fallback to provider display name
  const displayName = formData.keyName?.trim() || providerInfo?.displayName || formData.provider

  return {
    id,
    name: displayName,
    apiKey: formData.apiKey,
    provider: formData.provider,
    keyName: formData.keyName?.trim(),
    isCustom: true
  }
}

// Updates model data from form
export function updateModelFromForm(formData: ModelFormData): Partial<Model> {
  // Get the provider info to use the correct name
  const providerInfo = getProviderById(formData.provider)
  const displayName = formData.keyName?.trim() || providerInfo?.displayName || formData.provider

  return {
    name: displayName,
    apiKey: formData.apiKey,
    provider: formData.provider,
    keyName: formData.keyName?.trim()
  }
}

// Converts a model to form data for editing
export function modelToFormData(model: Model): ModelFormData {
  return {
    provider: model.provider || '',
    apiKey: model.apiKey || '',
    keyName: model.keyName || ''
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
