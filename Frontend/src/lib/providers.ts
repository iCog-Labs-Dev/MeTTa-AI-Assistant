// Provider configuration for the MeTTa AI Assistant
// This file contains the centralized list of available AI providers.
// To add a new provider, simply add a new entry to the AVAILABLE_PROVIDERS array.

// Information about an AI provider
export interface ProviderInfo {
  id: string;
  name: string; // short name
  displayName: string; // full name
  requiresApiKey?: boolean;
}

// List of available AI providers
// To add a new provider, add a new entry to this array.
export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  { 
    id: 'gemini', 
    name: 'Google', 
    displayName: 'Google (Gemini)',
    requiresApiKey: true
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    displayName: 'OpenAI',
    requiresApiKey: true
  },
];

// Get a provider by ID
export function getProviderById(id: string): ProviderInfo | undefined {
  return AVAILABLE_PROVIDERS.find(provider => provider.id === id);
}

// Get all available provider IDs
export function getAvailableProviderIds(): string[] {
  return AVAILABLE_PROVIDERS.map(provider => provider.id);
}