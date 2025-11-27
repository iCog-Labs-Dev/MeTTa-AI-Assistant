import React from 'react'
import Modal from './modal'
import { Button } from './button'
import { AlertTriangle, Info } from 'lucide-react'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'info'
  isLoading?: boolean
}

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'info',
  isLoading = false
}: ConfirmationDialogProps) => {
  const isDanger = variant === 'danger'
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          isDanger 
            ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20' 
            : 'text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/20'
        }`}>
          {isDanger ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <Info className="w-5 h-5 flex-shrink-0" />}
          <div className="text-sm font-medium">{description}</div>
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 text-white ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmationDialog