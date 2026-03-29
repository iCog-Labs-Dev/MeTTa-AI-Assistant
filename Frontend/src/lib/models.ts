import { Model } from '../types'
import { AVAILABLE_PROVIDERS } from '../lib/providers'

export interface ProviderModelOption {
  value: string
  label: string
  provider: string
  description?: string
}

const PROVIDER_MODEL_OPTIONS: Record<string, ProviderModelOption[]> = {
  gemini: [
    { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', provider: 'gemini', description: 'Highest quality, best for detailed reasoning' },
    { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash', provider: 'gemini', description: 'Faster, lower-latency option' },
  ],
  openai: [
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', description: 'Balanced quality and latency' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', description: 'Great for lightweight tasks' },
  ],
}

export function getModelOptionsForProvider(provider: string): ProviderModelOption[] {
  return PROVIDER_MODEL_OPTIONS[provider] ?? []
}

export function getModelOption(provider: string, value: string): ProviderModelOption | undefined {
  if (!provider || !value) return undefined
  return getModelOptionsForProvider(provider).find(option => option.value === value)
}

export function getAllSupportedModelOptions(): ProviderModelOption[] {
  return Object.values(PROVIDER_MODEL_OPTIONS).flat()
}

// Form data for creating or updating a model
export interface ModelFormData {
  provider: string
  modelName: string
  apiKey: string
}

// Creates a new model object from form data
export function createModelFromForm(formData: ModelFormData): Model {
  // Generate a unique ID using the provider name and timestamp
  const id = formData.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
  const selectedModel = getModelOption(formData.provider, formData.modelName)
  const displayName = selectedModel?.label || formData.modelName || formData.provider
  
  return {
    id,
    name: displayName,
    modelId: selectedModel?.value || formData.modelName,
    apiKey: formData.apiKey,
    provider: formData.provider,
    isCustom: true
  }
}

// Updates model data from form
export function updateModelFromForm(formData: ModelFormData): Partial<Model> {
  const selectedModel = getModelOption(formData.provider, formData.modelName)
  return {
    name: selectedModel?.label || formData.modelName || formData.provider,
    modelId: selectedModel?.value || formData.modelName,
    apiKey: formData.apiKey,
    provider: formData.provider
  }
}

// Converts a model to form data for editing
export function modelToFormData(model: Model): ModelFormData {
  return {
    provider: model.provider || '',
    modelName: model.modelId || '',
    apiKey: model.apiKey || ''
  }
}

// Validates model form data
export function validateModelForm(formData: ModelFormData): boolean {
  const isValidProvider = AVAILABLE_PROVIDERS.some(provider => provider.id === formData.provider)
  const hasSupportedModel = !!getModelOption(formData.provider, formData.modelName)
  return (
    formData.provider.trim() !== '' &&
    formData.modelName.trim() !== '' &&
    formData.apiKey.trim() !== '' &&
    isValidProvider &&
    hasSupportedModel
  )
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
