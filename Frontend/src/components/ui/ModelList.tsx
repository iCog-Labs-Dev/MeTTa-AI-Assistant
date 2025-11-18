import { Model } from '../../types'
import { Trash2 } from 'lucide-react'

interface ModelListProps {
  title: string
  models: Model[]
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  isMobile?: boolean
  isCustom: boolean
}

function ModelList({ title, models, onEdit, onDelete, isMobile = false, isCustom }: ModelListProps) {
  const cardBgClass = isMobile 
    ? 'bg-zinc-50 dark:bg-zinc-900' 
    : 'bg-white dark:bg-black'
  
  const borderClass = 'border-zinc-200 dark:border-zinc-800'

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 text-zinc-700 dark:text-zinc-300">{title}</h3>
      <div className="space-y-2">
        {models.map(model => (
          <div key={model.id} className={`${cardBgClass} rounded-lg border ${borderClass} p-4 ${!isMobile && isCustom ? 'group' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{model.name}</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {model.provider || 'Custom'}
                  {isCustom && ` • ${model.apiKey ? '••••' + model.apiKey.slice(-4) : 'No API key'}`}
                </p>
              </div>
              {isCustom ? (
                <div className={`flex items-center gap-1 ${!isMobile ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                  <button
                    onClick={() => onDelete && onDelete(model.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  Built-in
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ModelList
