import { ModelFormData } from '../../lib/models'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import ProviderSelect from './ProviderSelect'
import { ProviderMismatchInfo, StoreAPIKeyResult, useKMS } from '../../hooks/useKMS'
import { useRef, useState, useEffect } from 'react'

interface ModelFormProps {
  formData: ModelFormData
  onFormChange: (data: ModelFormData) => void
  onSubmit: (e: React.FormEvent, keyId?: string) => void
  onCancel: () => void
  isEditing: boolean
}

function ModelForm({ formData, onFormChange, onSubmit, onCancel, isEditing }: ModelFormProps) {
  const { storeAPIKey } = useKMS()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [providerMismatch, setProviderMismatch] = useState<ProviderMismatchInfo | null>(null)
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [keyName, setKeyName] = useState('')
  const successTimer = useRef<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.provider || !formData.apiKey || !password) {
      setError('Please fill in all fields including your password')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    setProviderMismatch(null)
    setDetectedProvider(null)
    
    try {
      // Pass keyName to storeAPIKey
      const result: StoreAPIKeyResult = await storeAPIKey(
        formData.apiKey, 
        formData.provider, 
        password,
        keyName.trim() || undefined
      )

      if (result.success) {
        // Check for warning
        let message = result.message || `API key for ${formData.provider} stored successfully!`
        if (result.warning) {
          message = result.warning
        }
        setSuccess(message)
        setPassword('')
        setKeyName('') 
        if (successTimer.current) {
          window.clearTimeout(successTimer.current)
        }
        const delay = result.warning ? 4000 : 1400
        successTimer.current = window.setTimeout(() => {
          if (onSubmit) {
            onSubmit(e, result.key_id)
          }
        }, delay)
      } else {
        setError(result.error || 'Failed to store API key')
        setProviderMismatch(result.providerMismatch ?? null)
        if (result.providerMismatch?.detected) {
          setDetectedProvider(result.providerMismatch.detected)
        }
      }
    } catch (err) {
      setError('An error occurred while saving the API key')
      console.error('Error storing API key:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    return () => {
      if (successTimer.current) {
        window.clearTimeout(successTimer.current)
      }
    }
  }, [])

  const handleCancel = () => {
    if (successTimer.current) {
      window.clearTimeout(successTimer.current)
      successTimer.current = null
    }
    setSuccess(null)
    setProviderMismatch(null)
    setDetectedProvider(null)
    setPassword('')
    setKeyName('')  // Clear key name on cancel
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider">Provider</Label>
        <ProviderSelect
          value={formData.provider}
          onChange={value => onFormChange({ ...formData, provider: value })}
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key-name">Key Name (Optional)</Label>
        <Input
          id="key-name"
          type="text"
          placeholder="e.g., Work Gemini, Personal OpenAI"
          value={keyName}
          onChange={e => setKeyName(e.target.value)}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Give your key a custom name to identify it easily
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="password"
          placeholder="Enter your API key"
          value={formData.apiKey}
          onChange={e => onFormChange({ ...formData, apiKey: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Your Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your login password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Your password is used to encrypt the API key. The API key is stored in our database in encrypted form.
        </p>
      </div>
      
      {error && (
        <div className="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
          {error}
        </div>
      )}

      {providerMismatch && (
        <div className="p-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 rounded-md space-y-2">
          <p className="font-semibold">Detected provider mismatch</p>
          <p>
            API key appears to belong to <strong>{providerMismatch.detected}</strong> but{' '}
            <strong>{providerMismatch.declared}</strong> was declared.
          </p>
          {providerMismatch.detail && (
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">{providerMismatch.detail}</p>
          )}
          {detectedProvider && (
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline"
              onClick={() => onFormChange({ ...formData, provider: detectedProvider! })}
            >
              Switch to {detectedProvider}
            </button>
          )}
        </div>
      )}
      
      {success && (
        <div className="p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-md">
          {success}
        </div>
      )}
      
      <div className="flex justify-end gap-3 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isEditing ? 'Updating...' : 'Saving...'}
            </>
          ) : isEditing ? 'Update Model' : 'Save Model'}
        </Button>
      </div>
    </form>
  )
}

export default ModelForm
