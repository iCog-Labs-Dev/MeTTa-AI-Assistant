<div align="center">

# 🎨 MeTTa AI Assistant - Frontend

**Modern React + TypeScript chat interface with AI model management**

[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-cyan.svg)](https://tailwindcss.com/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Building](#-building)
- [Code Style](#-code-style)

---

## Overview

A modern, responsive chat interface for the MeTTa AI Assistant. Built with React 19, TypeScript, and TailwindCSS, featuring a clean UI with dark mode support, multi-model selection, and comprehensive settings management.

---

## Features

- **Interactive Chat Interface** - Real-time messaging with thread management
- **Theme Support** - Light/Dark mode with instant switching
- **Multi-Model Management** - Add, edit, and switch between AI models
- **Fully Responsive** - Mobile-first design with adaptive layouts
- **Settings Modal** - Comprehensive user and model settings
- **Search Functionality** - Quick search through chat history
- **Feedback System** - Rate AI responses with thumbs up/down
- **Thread Organization** - Manage multiple conversation threads
- **Authentication** - Secure login/signup flow
- **Keyboard Shortcuts** - Efficient navigation and actions

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
│   │   ├── chat/           # Chat-specific components
│   │   │   ├── ChatHeader.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatMessageItem.tsx
│   │   │   └── ChatMessageList.tsx
│   │   ├── ui/             # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── SearchModal.tsx
│   │   └── SettingsModal.tsx
│   │
│   ├── pages/              # Page components
│   │   ├── Chat.tsx        # Main chat interface
│   │   └── LoginSignup.tsx # Authentication page
│   │
│   ├── layout/             # Layout components
│   │   ├── ChatLayout.tsx  # Chat page layout
│   │   └── Sidebar.tsx     # Navigation sidebar
│   │
│   ├── hooks/              # Custom React hooks
│   │   └── useTheme.ts     # Theme management hook
│   │
│   ├── store/              # Zustand stores
│   │   ├── useModelStore.ts  # Model state
│   │   └── useUserStore.ts   # User state
│   │
│   ├── types/              # TypeScript definitions
│   │   └── index.ts
│   │
│   ├── lib/                # Utility functions
│   │   └── utils.ts
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
- Built-in models (no API key required)
- Custom model addition
- API key management
- Model switching

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

---

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

<div align="center">

**Built using React + TypeScript + Vite**

</div>
