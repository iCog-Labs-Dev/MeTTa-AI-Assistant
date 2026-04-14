import { Building2 } from "lucide-react"

function AboutICog() {
  return (
    <section id="about-icog" className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
            <Building2 className="h-6 w-6" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">About iCog Labs</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            iCog Labs is presented here as the company building the platform and driving the product direction behind this MeTTa AI Assistant experience. This section gives your landing page a clear ownership story and helps frame the product as part of a larger AI and research ecosystem.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Focus</p>
              <p className="mt-2 text-sm font-medium">AI research, symbolic systems, and intelligent product experiences</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Role in platform</p>
              <p className="mt-2 text-sm font-medium">Builder of the MeTTa AI Assistant product experience</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-2xl font-semibold tracking-tight">Why this homepage helps</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Better first impression</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Users understand the product before they are pushed directly into login.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Clear product story</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                It introduces MeTTa, the assistant workflow, and the team behind the platform.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Future ready</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Later this can grow into docs, onboarding, auth-aware CTAs, pricing, or enterprise messaging.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Matches the current app</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                It keeps the same zinc, black, border, and rounded visual language as the rest of your interface.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutICog