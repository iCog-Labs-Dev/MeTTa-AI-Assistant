import { ArrowRight, BrainCircuit, Play, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-20 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pt-32">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <BrainCircuit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">MeTTa AI Assistant</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Symbolic reasoning and browser-based experimentation
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          Learn, ask, and experiment with MeTTa in one place
        </div>

        <div className="space-y-5">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            MeTTa Assistant
          </h1>

          <div className="max-w-2xl space-y-4 text-base leading-8 text-zinc-600 dark:text-zinc-400 sm:text-lg">
            <p>Explore and experiment with the MeTTa programming language.</p>
            <p>
              Use the AI assistant to ask questions, understand concepts, and get help writing MeTTa code.
            </p>
            <p>Run and test your code directly in the playground.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/30">
          <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold">MeTTa Playground</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Write, test, and inspect MeTTa code directly in the browser
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <Play className="h-3 w-3" />
              Live execution
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-zinc-400">playground.metta</span>
            </div>

            <div className="space-y-4 px-4 py-5">
              <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-sm leading-7 text-zinc-200">
                {`; facts
                (Parent "Tom" "Bob")
                (Parent "Tom" "Alice")

                ; query
                !(match &self (Parent "Tom" $x) $x)`}
              </pre>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-blue-300">Output</p>
                <pre className="text-sm text-blue-100">["Bob", "Alice"]</pre>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Assistant support</p>
              <p className="mt-2 text-sm font-medium">
                Ask questions, understand syntax, and get help writing MeTTa code
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Browser playground</p>
              <p className="mt-2 text-sm font-medium">
                Run and test your MeTTa programs directly without leaving the platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero