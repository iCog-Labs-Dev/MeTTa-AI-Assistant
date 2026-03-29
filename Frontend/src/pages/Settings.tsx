import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Palette, User, Plus } from 'lucide-react'
import { useModelStore } from '../store/useModelStore'
import { useUserStore } from '../store/useUserStore'
import { useTheme } from '../hooks/useTheme'
import { useKMS } from '../hooks/useKMS'
import ModelList from '../components/ui/ModelList'
import ModelForm from '../components/ui/ModelForm'
import { Button } from '../components/ui/button'
import {
  createModelFromForm,
  filterModels,
  ModelFormData,
  validateModelForm,
} from '../lib/models'

type SettingsTab = 'general' | 'models' | 'account'

const Settings = () => {
  const navigate = useNavigate()
  const { models, addModel, removeModel } = useModelStore()
  const { email, username, userId, accountCreatedAt, isAuthenticated } = useUserStore()
  const { theme, setTheme } = useTheme()
  const { deleteAPIKey } = useKMS()

  const [activeTab, setActiveTab] = useState<SettingsTab>('models')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState<ModelFormData>({ provider: '', modelName: '', apiKey: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { customModels, builtInModels } = filterModels(models)
  const displayName = username || (email ? email.split('@')[0] : 'User')
  const avatarInitial = displayName.charAt(0).toUpperCase()

  const sidebarItems: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'models', label: 'Models', icon: Globe },
    { id: 'account', label: 'Account', icon: User },
  ]

  function handleAddModel(e: React.FormEvent) {
    e.preventDefault()
    if (!validateModelForm(formData)) return
    addModel(createModelFromForm(formData))
    closeModal()
  }

  function handleDeleteRequest(modelId: string) {
    setConfirmDeleteId(modelId)
  }

  async function performDelete() {
    if (!confirmDeleteId) return
    const model = models.find((m) => m.id === confirmDeleteId)
    if (!model) {
      setConfirmDeleteId(null)
      return
    }

    if (model.provider) {
      try {
        await deleteAPIKey(model.provider)
      } catch (err) {
        console.error('Failed to delete key via KMS', err)
      }
    }

    removeModel(model.id)
    setConfirmDeleteId(null)
  }

  function closeModal() {
    setShowAddModal(false)
    setFormData({ provider: '', modelName: '', apiKey: '' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/chat')}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage models, API keys, and account preferences
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col md:flex-row">
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800">
              <nav className="p-4 space-y-2">
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="flex-1 p-6">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold">General preferences</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Personalize the assistant experience
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">Theme</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Switch between light and dark UI themes
                          </p>
                        </div>
                        <select
                          value={theme}
                          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'models' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold">Models & API keys</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Add provider keys and organize custom model names
                      </p>
                    </div>
                    <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Model
                    </Button>
                  </div>

                  <ModelList title="Available Models" models={builtInModels} isCustom={false} />

                  <ModelList
                    title="Your Models"
                    models={customModels}
                    onDelete={handleDeleteRequest}
                    isCustom={true}
                  />
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold">Account</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      User profile and sign-in details
                    </p>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg font-semibold">
                      {avatarInitial}
                    </div>
                    <div>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{email || 'Not signed in'}</p>
                      {accountCreatedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Member since {new Date(accountCreatedAt).toLocaleDateString()}
                        </p>
                      )}
                      {userId && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">User ID: {userId}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Add a Key</h3>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
              <ModelForm
                formData={formData}
                onFormChange={setFormData}
                onSubmit={handleAddModel}
                onCancel={closeModal}
                isEditing={false}
              />
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteId(null)}>
          <div
            className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-base font-semibold">Remove model</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This also deletes the provider key stored in the backend vault.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                  Cancel
                </Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={performDelete}>
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

export default Settings
