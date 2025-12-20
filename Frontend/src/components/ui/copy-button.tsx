import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface CopyButtonProps {
  textToCopy: string
  className?: string
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

export function CopyButton({ textToCopy, className = '', tooltipSide = 'bottom' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${className}`}
        >
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <p>{copied ? 'Copied!' : 'Copy message'}</p>
      </TooltipContent>
    </Tooltip>
  )
}
