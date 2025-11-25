import { useState, useEffect, useRef } from 'react'
import { useModelStore } from '../../store/useModelStore'
import { ChevronDown } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { Label } from './label'
import ProviderSelect from './ProviderSelect'
import { getProviderById } from '../../lib/providers'
import { useKMS } from '../../hooks/useKMS'

function ModelSelector() {
  const { models, activeId, setActive, addModel: addModelToStore, removeModel, clearCustomModels } = useModelStore()
  const activeModel = models.find(m => m.id === activeId)
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newModel, setNewModel] = useState({ provider: '', apiKey: '' })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { storeAPIKey, deleteAPIKey, isLoading: isKmsLoading, error: kmsError } = useKMS()
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [closeTimer, setCloseTimer] = useState<number | null>(null)

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

  async function addModel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLocalError(null)
    setSuccessMessage(null)

    if (!newModel.provider.trim() || !newModel.apiKey.trim()) {
      setLocalError('Provider and API key are required')
      return
    }

    try {
      // First store the API key via KMS so backend can use it via cookies
      const result = await storeAPIKey(newModel.apiKey, newModel.provider)

      if (!result.success) {
        setLocalError(result.error || 'Failed to store API key')
        return
      }

      const message = result.message || `API key for ${newModel.provider} stored successfully!`
      setSuccessMessage(message)

      // Generate a unique ID using the provider name and timestamp
      const id = newModel.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()

      // Get the provider info to use the correct name
      const providerInfo = getProviderById(newModel.provider)
      const displayName = providerInfo?.displayName || newModel.provider

      addModelToStore({ 
        id, 
        name: displayName, 
        apiKey: newModel.apiKey,
        provider: newModel.provider,
        isCustom: true
      })

      setLocalError(null)
      if (closeTimer) {
        window.clearTimeout(closeTimer)
      }
      const timer = window.setTimeout(() => {
        setShowAdd(false)
        setSuccessMessage(null)
        setNewModel({ provider: '', apiKey: '' })
        setCloseTimer(null)
      }, 1500)
      setCloseTimer(timer)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to add model')
    }
  }

  function closeAddModal() {
    if (closeTimer) {
      window.clearTimeout(closeTimer)
      setCloseTimer(null)
    }
    setShowAdd(false)
    setLocalError(null)
    setSuccessMessage(null)
    setNewModel({ provider: '', apiKey: '' })
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setOpen(!open)} 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-xs hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          <span className="font-medium">{activeModel?.name || 'Select Model'}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        
        {open && (
          <div className="absolute left-0 top-full mt-1.5 w-56 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg overflow-hidden z-50">
            <div className="max-h-56 overflow-y-auto scrollbar-thin">
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
                    m.id === activeId ? 'bg-gray-100 dark:bg-gray-900 font-medium' : ''
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <button 
              onClick={() => { setShowAdd(true); setOpen(false) }} 
              className="w-full text-left px-3 py-1.5 text-xs border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium"
            >
              + Add your own Key
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeAddModal}
        >
          <div 
            className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Add a Model</h3>
                <button 
                  onClick={closeAddModal} 
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={addModel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <ProviderSelect
                    value={newModel.provider}
                    onChange={value => setNewModel({...newModel, provider: value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your key"
                    value={newModel.apiKey}
                    onChange={e => setNewModel({...newModel, apiKey: e.target.value})}
                    required
                  />
                </div>
                {(localError || kmsError) && (
                  <div className="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                    {localError || kmsError}
                  </div>
                )}
                {successMessage && (
                  <div className="p-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-md">
                    {successMessage}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowAdd(false)}
                    disabled={isKmsLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isKmsLoading}>
                    {isKmsLoading ? 'Saving...' : 'Save Model'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ModelSelector
