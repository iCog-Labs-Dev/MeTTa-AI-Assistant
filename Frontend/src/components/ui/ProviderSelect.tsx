import { AVAILABLE_PROVIDERS } from '../../lib/providers'

// Props for the ProviderSelect component
interface ProviderSelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
  className?: string
}

// Provider selection dropdown component
// Displays a dropdown with all available providers from the AVAILABLE_PROVIDERS list
function ProviderSelect({ value, onChange, id = 'provider', required = false, className = '' }: ProviderSelectProps) {
  const defaultClassName = "w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
  
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className || defaultClassName}
      required={required}
    >
      <option value="">Select a provider</option>
      {AVAILABLE_PROVIDERS.map((provider) => (
        <option key={provider.id} value={provider.id}>
          {provider.displayName}
        </option>
      ))}
    </select>
  )
}

export default ProviderSelect
