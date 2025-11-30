// Export all types from the auth and chat modules
export * from './auth';
export * from './chat';

// Model interface definition
export interface Model {
  id: string;
  name: string;
  provider?: string;
  apiKey?: string;
  keyName?: string;
  isCustom?: boolean;
  requiresApiKey?: boolean;
  icon?: string;
}

export interface SuggestionCard {
  title: string;
  subtitle: string;
}

export interface Session {
  id: string
  title: string
  messages: import('./chat').Message[]
  createdAt: number
  updatedAt: number
  sessionId?: string
}