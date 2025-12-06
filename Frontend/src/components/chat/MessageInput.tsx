import { useState } from 'react'
import { ArrowUp } from 'lucide-react'

interface ChatInputProps {
  onSend: (text: string) => void
  isSendingMessage?: boolean
  maxWidthClass?: string
}

function MessageInput({ onSend, isSendingMessage = false }: ChatInputProps) {
  const [text, setText] = useState('')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!text.trim() || isSendingMessage) return
    onSend(text)
    setText('')
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl mx-auto px-4 mb-4">
      <div className="relative">
        <div className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ask about MeTTa, programming concepts, or AI research..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e as any);
              }
            }}
            className="w-full resize-none bg-transparent pl-4 pr-12 py-3 min-h-[52px] max-h-[200px] focus:outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 scrollbar-thin"
          />
          <button
            type="submit"
            disabled={!text.trim() || isSendingMessage}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={isSendingMessage ? "Sending..." : "Send message"}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  )
}

export default MessageInput
