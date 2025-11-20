import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'

const helperLinks = [
  { label: 'Return to login', to: '/login', description: 'Authenticate before returning to the assistant.' },
  { label: 'Go back to chat', to: '/chat', description: 'Jump straight into your conversations.' },
]

function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 py-6 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <section className="w-full max-w-4xl space-y-8 rounded-3xl border border-zinc-200/70 bg-white/90 p-10 shadow-lg shadow-zinc-300/40 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/80">
        <p className="text-sm font-semibold uppercase tracking-[0.5em] text-zinc-500 dark:text-zinc-400">404 error</p>
        <h1 className="text-4xl font-bold leading-tight">We couldn’t find that page</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-300">
          The address you entered does not match any route in the MeTTa Assistant.
        </p>
     </section>
    </div>
  )
}

export default NotFound
