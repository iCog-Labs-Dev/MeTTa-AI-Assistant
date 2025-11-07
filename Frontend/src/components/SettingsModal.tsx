import { useState } from 'react'
import { useModelStore } from '../store/useModelStore'
import { useUserStore } from '../store/useUserStore'
import { useTheme } from '../hooks/useTheme'
import { X, Plus, Pencil, Trash2, User, Palette, Globe, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type SettingsTab = 'general' | 'models' | 'account'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { models, addModel, updateModel, removeModel } = useModelStore()
  const { username, email, setUsername } = useUserStore()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', apiKey: '', provider: '' })
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(username || '')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isOpen) return null

  const customModels = models.filter(m => m.isCustom)
  const builtInModels = models.filter(m => !m.isCustom)
  
  // Get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  const userInitials = username ? getInitials(username) : 'U'
  
  const sidebarItems = [
    { id: 'general' as SettingsTab, label: 'General', icon: Palette },
    { id: 'models' as SettingsTab, label: 'Models', icon: Globe },
    { id: 'account' as SettingsTab, label: 'Account', icon: User },
  ]

  function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim() || !formData.apiKey.trim()) return
    
    const id = formData.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    addModel({
      id,
      name: formData.name,
      apiKey: formData.apiKey,
      provider: formData.provider || 'Custom',
      isCustom: true
    })
    
    setFormData({ name: '', apiKey: '', provider: '' })
    setShowAddModal(false)
  }

  function handleUpdateModel(e: React.FormEvent) {
    e.preventDefault()
    if (!editingModel || !formData.name.trim() || !formData.apiKey.trim()) return
    
    updateModel(editingModel, {
      name: formData.name,
      apiKey: formData.apiKey,
      provider: formData.provider || 'Custom'
    })
    
    setFormData({ name: '', apiKey: '', provider: '' })
    setEditingModel(null)
  }

  function handleEdit(modelId: string) {
    const model = models.find(m => m.id === modelId)
    if (model) {
      setFormData({
        name: model.name,
        apiKey: model.apiKey || '',
        provider: model.provider || ''
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
    setFormData({ name: '', apiKey: '', provider: '' })
  }

  function handleSaveName() {
    if (editedName.trim()) {
      setUsername(editedName.trim())
      setIsEditingName(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="h-[85vh] w-[90vw] max-w-6xl flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 rounded-xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Settings</h1>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              title="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === item.id
                    ? 'bg-zinc-100 dark:bg-zinc-900 font-medium'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-3xl p-8">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-1">General</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage your general preferences and settings
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
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

                <div className="bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
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
                      className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 cursor-not-allowed opacity-60"
                    >
                      <option value="english">English</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Models</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Manage AI models and API configurations
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Model
                </Button>
              </div>

              {/* Built-in Models */}
              <div>
                <h3 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">Available Models</h3>
                <div className="space-y-2">
                  {builtInModels.map(model => (
                    <div key={model.id} className="bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
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
                      <div key={model.id} className="bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 group">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{model.name}</h4>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                              {model.provider || 'Custom'} • {model.apiKey ? '••••' + model.apiKey.slice(-4) : 'No API key'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(model.id)}
                              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
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
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-1">Account</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage your account information
                </p>
              </div>

              <div className="bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 text-xl font-semibold">
                    {userInitials}
                  </div>
                  <div>
                    <h3 className="font-semibold">{username || 'User'}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{email || 'user@example.com'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs font-medium">Name</Label>
                      {!isEditingName && (
                        <button
                          onClick={() => {
                            setIsEditingName(true)
                            setEditedName(username || '')
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>
                    {isEditingName ? (
                      <div className="flex gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSaveName}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setIsEditingName(false)
                            setEditedName(username || '')
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input value={username || ''} disabled className="bg-zinc-50 dark:bg-zinc-900" />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Email</Label>
                    <Input value={email || ''} disabled className="bg-zinc-50 dark:bg-zinc-900" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Add/Edit Modal */}
        {(showAddModal || editingModel) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
            <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">
                    {editingModel ? 'Edit Model' : 'Add a Model'}
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
                  <Label htmlFor="model-name">Model Name</Label>
                  <Input
                    id="model-name"
                    placeholder="e.g., GPT-4, Claude 3"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider (Optional)</Label>
                  <Input
                    id="provider"
                    placeholder="e.g., OpenAI, Anthropic"
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                  />
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteId(null)}>
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
    </div>
  )
}

export default SettingsModal
