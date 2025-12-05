import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { kmsService } from '../../services/kmsService'
import { useModelStore } from '../../store/useModelStore'

interface ModelVariantSelectorProps {
  keyId?: string
  provider?: string
}

interface ModelVariant {
  id: string
  name: string
}

function ModelVariantSelector({ keyId, provider }: ModelVariantSelectorProps) {
  const { selectedVariant, setSelectedVariant } = useModelStore()
  const [variants, setVariants] = useState<ModelVariant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!keyId || !provider) {
      setVariants([])
      setSelectedVariant(null)
      return
    }

    const fetchModels = async () => {
      setIsLoading(true)
      try {
        const data = await kmsService.getAvailableModels(keyId)
        setVariants(data.models)
        
        if (!selectedVariant && data.default_model) {
          setSelectedVariant(data.default_model)
        } else if (!selectedVariant && data.models.length > 0) {
          setSelectedVariant(data.models[0].id)
        }
      } catch (error) {
        console.error('[ModelVariantSelector] Failed to fetch models:', error)
        setVariants([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchModels()
  }, [keyId, provider])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  if (!keyId || !provider || variants.length === 0) {
    return null
  }

  const selectedVariantObj = variants.find(v => v.id === selectedVariant)
  const displayName = selectedVariantObj?.name || 'Select Model'

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)} 
        disabled={isLoading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 text-xs hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Select model variant"
      >
        <span className="font-medium max-w-[150px] truncate">
          {isLoading ? 'Loading...' : displayName}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && !isLoading && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg overflow-hidden z-50">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {variants.map(variant => (
              <button 
                key={variant.id}
                onClick={() => { 
                  setSelectedVariant(variant.id)
                  setOpen(false)
                }} 
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors ${
                  variant.id === selectedVariant ? 'bg-gray-100 dark:bg-gray-900 font-medium' : ''
                }`}
              >
                <div className="font-medium">{variant.name}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{variant.id}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ModelVariantSelector
