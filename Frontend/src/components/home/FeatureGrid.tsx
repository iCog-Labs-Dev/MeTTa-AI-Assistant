import { Cpu, Network, ShieldCheck } from "lucide-react"

function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-4">
      <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Network className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">Pattern-first reasoning</h3>
          <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
            Explore relationships, atoms, and symbolic structures in a more natural reasoning flow.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">Interactive assistant</h3>
          <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
            Learn concepts, generate ideas, and move into experimentation with assistant support.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">Research-ready UX</h3>
          <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
            A clean front door that can later grow into onboarding, docs, workspace entry, and auth flows.
          </p>
        </div>
      </div>
    </section>
  )
}

export default FeatureGrid