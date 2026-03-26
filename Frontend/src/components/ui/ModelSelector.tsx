import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModelStore } from '../../store/useModelStore'
import { Bot } from 'lucide-react'
import { useKMS } from '../../hooks/useKMS'

function ModelSelector() {
  const navigate = useNavigate()
  const { deleteAPIKey } = useKMS()
  const { models, activeId, setActive, clearCustomModels } = useModelStore()
  const activeModel = models.find(m => m.id === activeId)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setOpen(!open)} 
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Select Model"
        >
          <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-1/2 bottom-full mb-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-xl overflow-hidden z-50">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-black border-l border-t border-gray-200 dark:border-gray-800 rotate-45"></div>
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Current Model</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{activeModel?.name || 'Select Model'}</div>
            </div>
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {models.map(m => (
                <button 
                  key={m.id}
                  onClick={async () => { 
                    if (!m.isCustom) {
                      // When switching to default, delete all custom models
                      const customModels = models.filter(model => model.isCustom)
                      
                      // Delete API keys from backend
                      const providersToDelete = ['gemini', 'openai']
                      for (const provider of providersToDelete) {
                        try {
                          await deleteAPIKey(provider)
                        } catch (err) {
                          console.debug(`No ${provider} key to delete`)
                        }
                      }
                      
                      // Remove all custom models from UI in one go
                      console.log('[ModelSelector] Clearing all custom models')
                      clearCustomModels()
                    }
                    setActive(m.id); 
                    setOpen(false) 
                  }} 
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors ${
                    m.id === activeId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : ''
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <button 
              onClick={() => { 
                setOpen(false)
                navigate('/settings')
              }} 
              className="w-full text-left px-3 py-1.5 text-xs border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium"
            >
              + Add your own Key
            </button>
          </div>
          </>
        )}
      </div>
    </>
  )
}

export default ModelSelector
