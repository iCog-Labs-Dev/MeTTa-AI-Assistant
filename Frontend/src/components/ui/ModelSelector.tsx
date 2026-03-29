import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot } from 'lucide-react'

import { useModelStore } from '../../store/useModelStore'
import { useKMS } from '../../hooks/useKMS'

const PROVIDERS_TO_DELETE = ['gemini', 'openai'] as const

const ModelSelector = () => {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [menuPosition, setMenuPosition] = useState({ alignRight: false, dropUp: false })

  const { deleteAPIKey } = useKMS()
  const { models, activeId, setActive, clearCustomModels } = useModelStore()

  const activeModel = models.find((model) => model.id === activeId)
  const hasCustomModels = models.some((model) => model.isCustom)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) {
        return
      }

      if (!dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const margin = 12

    const updatePosition = () => {
      if (!dropdownRef.current || !menuRef.current) {
        return
      }

      const triggerRect = dropdownRef.current.getBoundingClientRect()
      const menuRect = menuRef.current.getBoundingClientRect()

      const alignRight = triggerRect.left + menuRect.width > window.innerWidth - margin
      const dropUp = triggerRect.bottom + menuRect.height > window.innerHeight - margin

      setMenuPosition({
        alignRight,
        dropUp,
      })
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const handleSelectModel = async (modelId: string, isCustom?: boolean) => {
    if (!isCustom) {
      for (const provider of PROVIDERS_TO_DELETE) {
        try {
          await deleteAPIKey(provider)
        } catch (err) {
          console.debug(`No ${provider} key to delete`)
        }
      }
      clearCustomModels()
    }

    setActive(modelId)
    setOpen(false)
  }

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
        title={activeModel?.name ? `Current: ${activeModel.name}` : 'Select model'}
      >
        <Bot className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            className={`absolute ${menuPosition.alignRight ? 'right-0' : 'left-0'} ${
              menuPosition.dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
            } min-w-[15rem] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/60">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Choose a model</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Switch between built-in and custom keys</p>
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id, model.isCustom)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex flex-col gap-0.5 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors ${
                    model.id === activeId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200' : ''
                  }`}
                >
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{model.provider ? model.provider : model.isCustom ? 'Custom' : 'Built-in'}</span>
                </button>
              ))}
            </div>
            {!hasCustomModels && (
              <div className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/60">
                Add your key to unlock Gemini 3.1 Pro or Flash.
              </div>
            )}
            <button
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
              className={`w-full text-left px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors ${
                hasCustomModels ? 'border-t border-gray-200 dark:border-gray-800' : ''
              }`}
            >
              + Add your own key
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ModelSelector
