import { ModelFormData } from '../../lib/models'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import ProviderSelect from './ProviderSelect'
import { useKMS } from '../../hooks/useKMS'
import { useRef, useState, useEffect } from 'react'

interface ModelFormProps {
  formData: ModelFormData
  onFormChange: (data: ModelFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isEditing: boolean
}

function ModelForm({ formData, onFormChange, onSubmit, onCancel, isEditing }: ModelFormProps) {
  const { storeAPIKey } = useKMS()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const successTimer = useRef<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.provider || !formData.apiKey) return
    
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    
    try {
      const result = await storeAPIKey(formData.apiKey, formData.provider)

      if (result.success) {
        const message = result.message || `API key for ${formData.provider} stored successfully!`
        setSuccess(message)
        if (successTimer.current) {
          window.clearTimeout(successTimer.current)
        }
        successTimer.current = window.setTimeout(() => {
          if (onSubmit) {
            onSubmit(e)
          }
        }, 1400)
      } else {
        setError(result.error || 'Failed to store API key')
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
      
      {error && (
        <div className="p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
          {error}
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
