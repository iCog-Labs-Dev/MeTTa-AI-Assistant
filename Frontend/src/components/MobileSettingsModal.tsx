import { useState } from 'react'
import { useModelStore } from '../store/useModelStore'
import { useUserStore } from '../store/useUserStore'
import { useTheme } from '../hooks/useTheme'
import { X, Plus, Pencil, Trash2, User, Palette, Globe, ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type SettingsTab = 'general' | 'models' | 'account' | null

interface MobileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function MobileSettingsModal({ isOpen, onClose }: MobileSettingsModalProps) {
  const { models, addModel, updateModel, removeModel } = useModelStore()
  const { email, accountCreatedAt } = useUserStore()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [formData, setFormData] = useState({ provider: '', apiKey: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isOpen) return null

  const customModels = models.filter(m => m.isCustom)
  const builtInModels = models.filter(m => !m.isCustom)
  
  // Get avatar initial from email
  const avatarInitial = email ? email.charAt(0).toUpperCase() : 'U'
  
  const sidebarItems = [
    { id: 'general' as SettingsTab, label: 'General', icon: Palette },
    { id: 'models' as SettingsTab, label: 'Models', icon: Globe },
    { id: 'account' as SettingsTab, label: 'Account', icon: User },
  ]

  function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.provider.trim() || !formData.apiKey.trim()) return
    
    const id = formData.provider.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    addModel({
      id,
      name: formData.provider,
      apiKey: formData.apiKey,
      provider: formData.provider,
      isCustom: true
    })
    
    setFormData({ provider: '', apiKey: '' })
    setShowAddModal(false)
  }

  function handleUpdateModel(e: React.FormEvent) {
    e.preventDefault()
    if (!editingModel || !formData.provider.trim() || !formData.apiKey.trim()) return
    
    updateModel(editingModel, {
      name: formData.provider,
      apiKey: formData.apiKey,
      provider: formData.provider
    })
    
    setFormData({ provider: '', apiKey: '' })
    setEditingModel(null)
  }

  function handleEdit(modelId: string) {
    const model = models.find(m => m.id === modelId)
    if (model) {
      setFormData({
        provider: model.provider || '',
        apiKey: model.apiKey || ''
      })
      setEditingModel(modelId)
    }
  }

  function handleDelete(modelId: string) {
    setConfirmDeleteId(modelId)
  }

  function closeModal() {
    setShowAddModal(false)
    setEditingModel(null)
    setFormData({ provider: '', apiKey: '' })
  }

  function goBack() {
    setActiveTab(null)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-black text-zinc-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
      {/* Main Menu */}
      {activeTab === null && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h1 className="text-xl font-semibold">Settings</h1>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              title="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Options */}
          <div className="flex-1 p-4">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-base">{item.label}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* General Tab Content */}
      {activeTab === 'general' && (
        <div className="h-full flex flex-col">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">General</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Manage your general preferences and settings
            </p>

            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">Appearance</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Choose your interface theme
                    </p>
                  </div>
                  <select 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black cursor-pointer"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">Language</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Select your preferred language
                    </p>
                  </div>
                  <select 
                    value="english"
                    disabled
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 cursor-not-allowed opacity-60"
                  >
                    <option value="english">English</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Models Tab Content */}
      {activeTab === 'models' && (
        <div className="h-full flex flex-col">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold flex-1">Models</h1>
            <Button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Key
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Manage AI models and API configurations
            </p>

            {/* Built-in Models */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">Available Models</h3>
              <div className="space-y-2">
                {builtInModels.map(model => (
                  <div key={model.id} className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{model.name}</h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{model.provider}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        Built-in
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Models */}
            {customModels.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">Custom Models</h3>
                <div className="space-y-2">
                  {customModels.map(model => (
                    <div key={model.id} className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{model.name}</h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                            {model.provider || 'Custom'} • {model.apiKey ? '••••' + model.apiKey.slice(-4) : 'No API key'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(model.id)}
                            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(model.id)}
                            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Tab Content */}
      {activeTab === 'account' && (
        <div className="h-full flex flex-col">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={goBack}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">Account</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Manage your account information
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 text-xl font-semibold">
                  {avatarInitial}
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{email || 'user@example.com'}</p>
                  {accountCreatedAt && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">Account created on: {new Date(accountCreatedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingModel) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">
                  {editingModel ? 'Edit Model' : 'Add a Key'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={editingModel ? handleUpdateModel : handleAddModel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <select
                    id="provider"
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
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
                    value={formData.apiKey}
                    onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingModel ? 'Update Model' : 'Save Model'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-base font-semibold">Delete model</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">This action cannot be undone. Are you sure you want to delete this model?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button 
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    removeModel(confirmDeleteId)
                    setConfirmDeleteId(null)
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileSettingsModal
