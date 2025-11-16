<div align="center">

# MeTTa AI Assistant - Frontend

**Modern React + TypeScript chat interface with AI model management**

[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-cyan.svg)](https://tailwindcss.com/)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Configuration & Customization](#configuration--customization)
- [Development](#-development)
- [Building](#-building)
- [Code Style](#-code-style)

---

## Overview

A modern, responsive chat interface for the MeTTa AI Assistant. Built with React 19, TypeScript, and TailwindCSS, featuring a clean UI with dark mode support, multi-model selection, and comprehensive settings management.

---

## Features

- **Interactive Chat Interface** - Real-time messaging with thread management and markdown rendering.
- **Theme Support** - Light/Dark mode with instant switching.
- **Single Default Model** - A single, pre-configured default model for a streamlined user experience.
- **Fully Responsive** - Mobile-first design with adaptive layouts.
- **Settings Modal** - Comprehensive user settings.
- **Search Functionality** - Quick search through chat history.
- **Feedback System** - Rate AI responses with thumbs up/down.
- **Thread Organization** - Manage multiple conversation threads.
- **Authentication** - Secure login/signup flow with automatic redirection.
- **Keyboard Shortcuts** - Efficient navigation and actions.

---

## 🛠️ Tech Stack

### Core
- **React 19.1** - Latest React with concurrent features
- **TypeScript 5.6** - Type-safe development
- **Vite 7.1** - Lightning-fast build tool

### UI & Styling
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **class-variance-authority** - Component variant management

### State & Routing
- **Zustand 5.0** - Lightweight state management
- **React Router DOM 6.28** - Client-side routing

### Development
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

> **Note:** The structure above reflects the current architecture (chat layout moved into `pages/Chat.tsx`, `Sidebar.tsx` under `components/`, etc.). If you change the layout or rename core components, update this section.

---

## Configuration & Customization

This section points to the key places you’ll edit when changing models/providers, session pagination limits, or general chat behavior.

### Models & Providers

**Available providers (Gemini, OpenAI, etc.)**

- File: `src/lib/providers.ts`
- Export: `AVAILABLE_PROVIDERS`
  - Each entry has `id`, `name`, `displayName`, `requiresApiKey`.
- **To add or remove a provider**:
  - Add/remove entries in `AVAILABLE_PROVIDERS`.
  - Ensure `id` matches what the backend expects (e.g. `"gemini"`, `"openai"`).

**Model store (what models the user can select)**

- File: `src/store/useModelStore.ts`
- Important pieces:
  - `DEFAULT_MODELS`: default model list (initial app models).
  - `models`, `activeId`: stored models and the currently active one.
  - `addModel`, `updateModel`, `removeModel`, `setActive`: actions used by UI.
- Persistence:
  - Wrapped with `persist(...)` so models survive page reloads using localStorage.
- **To change default models**: edit `DEFAULT_MODELS`.
- **To disable persistence**: adjust/remove the `persist` wrapper.

**Model UI and helpers**

- Header selector: `src/components/ui/ModelSelector.tsx`
  - Reads from `useModelStore` and lets the user pick/add models.
- Settings modals:
  - Desktop: `src/components/modals/SettingsModal.tsx`
  - Mobile: `src/components/modals/MobileSettingsModal.tsx`
- Model utilities: `src/lib/models.ts`
  - `createModelFromForm`, `updateModelFromForm`, `modelToFormData`, `validateModelForm`, `filterModels`.

If you change the `Model` type shape, also update:

- `src/types/user.ts` / `src/types/chat.ts` as needed.
- `src/lib/models.ts` and `src/store/useModelStore.ts` (so creation/editing stays consistent).

### Session Pagination (Sidebar Sessions)

Sessions in the left sidebar are loaded from the backend in pages.

**Store logic**

- File: `src/store/useChatStore.ts`
- Key fields in `ChatState`:
  - `sessions`, `sessionsPage`, `hasMoreSessions`, `sessionsStatus`.
- `loadSessions()`:
  - Calls `apiGetChatSessions(1, 20)` → loads page 1 with a **limit of 20 sessions**.
  - Sets `sessions`, `sessionsPage = 1`, and `hasMoreSessions` from `response.has_next`.
  - For sessions without `title`, fetches messages via `apiGetSessionMessages(sessionId)` and derives the title from the **first user message**.
- `loadMoreSessions()`:
  - Uses `nextPage = sessionsPage + 1` and calls `apiGetChatSessions(nextPage, 20)`.
  - Appends new sessions (deduped by `sessionId`).
  - Derives titles from first user message for newly loaded sessions.

**Sidebar UI**

- File: `src/components/Sidebar.tsx`
- Pulls from `useChatStore`:
  - `sessions`, `sessionsStatus`, `hasMoreSessions`, `isLoadingSessions`, `loadMoreSessions`.
- Renders a **"Load more"** pill-style button when `hasMoreSessions` is `true`.

**To change the pagination limit**:

1. Open `src/store/useChatStore.ts`.
2. Search for `apiGetChatSessions(1, 20)` and `apiGetChatSessions(nextPage, 20)`.
3. Replace `20` with your desired limit (e.g. `50`).
4. Make sure the backend supports that `limit` and returns `has_next` accordingly.

### Where to Update When Layout/Architecture Changes

When you significantly change the layout or architecture of the chat UI, make sure to update:

- **This README**:
  - Update the **Project Structure** section (paths like `pages/Chat.tsx`, `components/Sidebar.tsx`).
  - Update the **Configuration & Customization** section if you move or rename:
    - `useChatStore`, `useModelStore`
    - `providers.ts`, `models.ts`
    - `Sidebar`, `SettingsModal`, `ModelSelector`
- **Configuration points in code**:
  - If you remove features (e.g. model management), also clean up unused files and adjust this README so it doesn’t reference removed components.

You can also reserve a small component (for example `src/components/ui/ChangelogBanner.tsx`) to surface release notes from a static source or an API. If you do, document how to update/disable it here.

The app will be available at `http://localhost:5173`

### Quick Commands

```bash
# Development
npm run dev              # Start dev server with hot reload

# Building
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
```

---

## 📁 Project Structure

```
Frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── chat/            # Chat-specific components
│   │   │   ├── ChatHeader.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── MessageList.tsx
│   │   ├── ui/              # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── SearchModal.tsx
│   │   ├── modals/          # Settings / dialog components
│   │   │   ├── SettingsModal.tsx
│   │   │   └── MobileSettingsModal.tsx
│   │   └── Sidebar.tsx      # Navigation + sessions sidebar
│   │
│   ├── pages/               # Page components
│   │   ├── Chat.tsx         # Main chat interface
│   │   └── Auth.tsx         # Authentication page
│   │
│   ├── hooks/              # Custom React hooks
│   │   └── useTheme.ts     # Theme management hook
│   │
│   ├── store/              # Zustand stores
│   │   ├── useModelStore.ts  # Model state
│   │   ├── useChatStore.ts   # Chat sessions/messages state
│   │   └── useUserStore.ts   # User state
│   │
│   ├── types/              # TypeScript definitions
│   │   ├── index.ts
│   │   ├── chat.ts
│   │   ├── user.ts
│   │   └── auth.ts
│   │
│   ├── lib/                # Utility functions
│   │   ├── utils.ts
│   │   ├── axios.ts
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   ├── models.ts
│   │   └── providers.ts
│   │
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
│
├── public/                 # Static assets
├── index.html             # HTML template
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite config
├── tailwind.config.ts     # Tailwind config
├── postcss.config.js      # PostCSS config
└── eslint.config.js       # ESLint config
```

---

## Development

### Component Development

Components follow a consistent pattern:

```tsx
// Example component structure
import { useState } from 'react'
import { Button } from './ui/button'

interface MyComponentProps {
  title: string
  onAction: () => void
}

function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState(false)
  
  return (
    <div className="p-4 rounded-lg bg-white dark:bg-black">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAction}>Action</Button>
    </div>
  )
}

export default MyComponent
```

### State Management

Using Zustand for global state:

```typescript
// stores/useExampleStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ExampleState {
  value: string
  setValue: (value: string) => void
}

export const useExampleStore = create<ExampleState>()(
  persist(
    (set) => ({
      value: '',
      setValue: (value) => set({ value }),
    }),
    { name: 'example-storage' }
  )
)
```

### Styling Guidelines

- Use TailwindCSS utility classes
- Follow dark mode pattern: `bg-white dark:bg-black`
- Maintain consistent spacing: `p-4`, `gap-2`, `space-y-4`
- Use semantic color names: `text-zinc-900 dark:text-zinc-50`

### Theme Support

```tsx
import { useTheme } from '../hooks/useTheme'

function Component() {
  const { theme, setTheme } = useTheme()
  
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  )
}
```

---

## Building

### Development Build

```bash
npm run dev
```

- Hot Module Replacement (HMR)
- Source maps enabled
- Fast refresh for React components

### Production Build

```bash
npm run build
```

Output in `dist/` directory:
- Minified and optimized
- Code splitting
- Asset hashing
- Tree shaking applied

### Preview Production Build

```bash
npm run preview
```

Test the production build locally before deployment.

---

## Code Style

### TypeScript

- Use explicit types for props and state
- Avoid `any` type
- Use interfaces for object shapes
- Export types when shared

### React

- Functional components only
- Use hooks for state and effects
- Keep components focused and small
- Extract reusable logic to custom hooks

### Naming Conventions

- **Components**: PascalCase (`ChatHeader.tsx`)
- **Hooks**: camelCase with `use` prefix (`useTheme.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`UserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### File Organization

- One component per file
- Co-locate related files
- Index files for clean imports
- Separate concerns (UI, logic, types)

---

## Configuration Files

### `vite.config.ts`
Vite build configuration with React plugin

### `tailwind.config.ts`
TailwindCSS customization and theme extension

### `tsconfig.json`
TypeScript compiler options

### `eslint.config.js`
Linting rules and plugins

---

## Key Features Implementation

### Chat Interface
- Real-time message updates
- Thread-based conversations
- Message feedback system
- Suggestion cards for quick actions

### Model Management
- **Single Default Model**: The application is configured with a single, default model to simplify the user experience.
- **No API Key Required**: The default model does not require an API key.

### Settings
- User profile management
- Theme preferences
- Model configuration
- Account settings

### Responsive Design
- Mobile-first approach
- Sidebar overlay on mobile
- Touch-friendly interactions
- Adaptive layouts

---

## Performance

- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Optimized Images**: Proper sizing and formats
- **Minimal Bundle**: Tree-shaking and minification
- **Fast Refresh**: Instant feedback during development
- **Efficient State Management**: Optimized re-renders with Zustand

---

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Router Docs](https://reactrouter.com/)
- [Lucide Icons](https://lucide.dev/)

## Development Guidelines

### Code Style

- Use functional components with TypeScript
- Follow the Airbnb Style Guide with TypeScript support
- Use ESLint and Prettier for consistent formatting
- Write meaningful commit messages following Conventional Commits

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Testing

- Write unit tests for utility functions
- Test components with React Testing Library
- Ensure all tests pass before submitting a PR

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built using React + TypeScript + Vite**

</div>
