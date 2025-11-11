import { ModelFormData } from '../../lib/models'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import ProviderSelect from './ProviderSelect'

interface ModelFormProps {
  formData: ModelFormData
  onFormChange: (data: ModelFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isEditing: boolean
}

function ModelForm({ formData, onFormChange, onSubmit, onCancel, isEditing }: ModelFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          placeholder="Enter your key"
          value={formData.apiKey}
          onChange={e => onFormChange({ ...formData, apiKey: e.target.value })}
          required
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEditing ? 'Update Model' : 'Save Model'}
        </Button>
      </div>
    </form>
  )
}

export default ModelForm
