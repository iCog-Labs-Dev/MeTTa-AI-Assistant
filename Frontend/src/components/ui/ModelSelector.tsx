import { useState, useEffect, useRef } from 'react'
import { useModelStore } from '../../store/useModelStore'
import { ChevronDown } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { Label } from './label'

function ModelSelector() {
  const { models, activeId, setActive, addModel: addModelToStore } = useModelStore()
  const activeModel = models.find(m => m.id === activeId)
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newModel, setNewModel] = useState({ provider: '', apiKey: '' })
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

  function addModel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newModel.provider.trim() || !newModel.apiKey.trim()) return
    const id = newModel.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    addModelToStore({ 
      id, 
      name: newModel.provider, 
      apiKey: newModel.apiKey,
      provider: newModel.provider,
      isCustom: true
    })
    setNewModel({ provider: '', apiKey: '' })
    setShowAdd(false)
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
                  onClick={() => { setActive(m.id); setOpen(false) }} 
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
          onClick={() => setShowAdd(false)}
        >
          <div 
            className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Add a Model</h3>
                <button 
                  onClick={() => setShowAdd(false)} 
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={addModel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <select
                    id="provider"
                    value={newModel.provider}
                    onChange={e => setNewModel({...newModel, provider: e.target.value})}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                    required
                  >
                    <option value="">Select a provider</option>
                    <option value="Google">Google (Gemini)</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="Anthropic">Anthropic</option>
                  </select>
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
                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Model
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
