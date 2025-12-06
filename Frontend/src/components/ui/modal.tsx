import React from 'react'

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default Modal