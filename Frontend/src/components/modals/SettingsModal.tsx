import { useState, useEffect } from 'react'
import { useModelStore } from '../../store/useModelStore'
import { useUserStore } from '../../store/useUserStore'
import { useTheme } from '../../hooks/useTheme'
import { X, User, Palette, Globe, Plus } from 'lucide-react'
import MobileSettingsModal from './MobileSettingsModal'
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

type SettingsTab = 'general' | 'models' | 'account'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { models, addModel, updateModel, removeModel } = useModelStore()
  const { email, username, userId, isAuthenticated, accountCreatedAt } = useUserStore()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [isMobile, setIsMobile] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [formData, setFormData] = useState<ModelFormData>({ provider: '', apiKey: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isOpen) return null

  // Render mobile version on small screens
  if (isMobile) {
    return <MobileSettingsModal isOpen={isOpen} onClose={onClose} />
  }

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12" onClick={onClose}>
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
                  Add Your own Key
                </Button>
              </div>

              <ModelList 
                title="Available Models"
                models={builtInModels}
                isCustom={false}
              />

              {customModels.length > 0 && (
                <ModelList 
                  title="Custom Models"
                  models={customModels}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isCustom={true}
                />
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

                {/* <div className="space-y-4">
                  {isAuthenticated && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">User ID: {userId}</span>
                    </div>
                  )}
                </div> */}
              </div>
            </div>
          )}
        </div>
      </div>

      {(showAddModal || editingModel) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
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
