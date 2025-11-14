import { useState } from 'react'
import { useModelStore } from '../../store/useModelStore'
import { useUserStore } from '../../store/useUserStore'
import { useTheme } from '../../hooks/useTheme'
import { X, User, Palette, Globe, ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import ModelList from '../ui/ModelList'
import ModelForm from '../ui/ModelForm'
import { Button } from '../ui/button'
import { 
  createModelFromForm, 
  updateModelFromForm, 
  modelToFormData, 
  validateModelForm,
  filterModels,
  ModelFormData
} from '../../lib/models'

type SettingsTab = 'general' | 'models' | 'account' | null

interface MobileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function MobileSettingsModal({ isOpen, onClose }: MobileSettingsModalProps) {
  const { models, addModel, updateModel, removeModel } = useModelStore()
  const { email, username, userId, isAuthenticated, accountCreatedAt } = useUserStore()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [formData, setFormData] = useState<ModelFormData>({ provider: '', apiKey: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isOpen) return null

  const { customModels, builtInModels } = filterModels(models)
  
  // Get avatar initial from username or email
  const displayName = username || (email ? email.split('@')[0] : 'User')
  const avatarInitial = displayName.charAt(0).toUpperCase()
  
  const sidebarItems = [
    { id: 'general' as SettingsTab, label: 'General', icon: Palette },
    { id: 'models' as SettingsTab, label: 'Models', icon: Globe },
    { id: 'account' as SettingsTab, label: 'Account', icon: User },
  ]

  function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!validateModelForm(formData)) return
    addModel(createModelFromForm(formData))
    closeModal()
  }

  function handleUpdateModel(e: React.FormEvent) {
    e.preventDefault()
    if (!editingModel || !validateModelForm(formData)) return
    updateModel(editingModel, updateModelFromForm(formData))
    closeModal()
  }

  function handleEdit(modelId: string) {
    const model = models.find(m => m.id === modelId)
    if (model) {
      setFormData(modelToFormData(model))
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
            
            <ModelList 
              title="Available Models"
              models={builtInModels}
              isCustom={false}
              isMobile
            />

            {customModels.length > 0 && (
              <div className="mt-6">
                <ModelList 
                  title="Custom Models"
                  models={customModels}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isCustom={true}
                  isMobile
                />
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
                  {isAuthenticated ? (
                    <>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{email}</p>
                      {userId && <p className="text-xs text-zinc-500 dark:text-zinc-500">ID: {userId}</p>}
                      {accountCreatedAt && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                          Account created: {new Date(accountCreatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Guest User</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">Not signed in</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">Sign in</a> to access your account
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              {isAuthenticated && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">User ID: {userId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              <ModelForm 
                formData={formData}
                onFormChange={setFormData}
                onSubmit={editingModel ? handleUpdateModel : handleAddModel}
                onCancel={closeModal}
                isEditing={!!editingModel}
              />
            </div>
          </div>
        </div>
      )}

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
