export interface Model {
  id: string
  name: string
  provider?: string
  apiKey?: string
  isCustom?: boolean
  requiresApiKey?: boolean
  icon?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  feedback?: 'up' | 'down' | null
}

export interface Thread {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface SuggestionCard {
  title: string
  subtitle: string
}
