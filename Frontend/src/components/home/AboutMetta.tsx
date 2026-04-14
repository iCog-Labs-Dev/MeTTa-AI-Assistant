import { BookOpen } from "lucide-react"

function AboutMetta() {
  return (
    <section id="about-metta" className="mx-auto max-w-7xl px-6 py-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">About MeTTa</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              MeTTa is a language designed for symbolic knowledge representation, pattern matching, and expressive reasoning workflows. It is a strong foundation for exploring structured AI concepts in a more transparent and composable way.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Atoms and expressions</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Model facts, functions, and relationships as symbolic structures that can be queried and transformed.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Pattern matching</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Express logic through matching and structured transformations instead of only imperative control flow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Reasoning workflows</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A good fit for experiments in symbolic AI, typed structures, rules, and assistant-guided exploration.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutMetta