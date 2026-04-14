import Hero from "../components/home/Hero"
import ThemeToggle from "../components/home/ThemeToggle"

function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <ThemeToggle />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-400/10" />
        <div className="absolute top-40 left-8 h-72 w-72 rounded-full bg-orange-400/10 blur-3xl dark:bg-orange-300/10" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-300/10" />
      </div>

      <main className="relative">
        <Hero />

        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-900 px-8 py-10 text-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight">Start exploring MeTTa AI Assistant</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-300">
                  Learn the foundations of MeTTa, explore symbolic reasoning ideas, continue into the assistant workspace, run and test your code.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/chat"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
                >
                  Open Chat
                </a>
                <a
                  href="/playground"
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                >
                  Open Playground
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Home