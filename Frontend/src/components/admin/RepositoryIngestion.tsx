import { useEffect, useState } from "react"
import { Check, Clock, X, Loader2 } from "lucide-react"
import { useAdminStore } from "../../store/useAdminStore"
import { Button } from "../ui/button"
import { ingestRepository } from "../../services/adminService" 
import { toast, Toaster } from "sonner"

function RepositoryIngestion() {
  const { repositories, isLoadingRepositories, loadRepositories } = useAdminStore()
  const [repoUrl, setRepoUrl] = useState("")
  const [chunkSize, setChunkSize] = useState("1000")
  const [isIngesting, setIsIngesting] = useState(false)

  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  const handleIngest = async () => {
    if (!repoUrl.trim()) {
      toast.error("Please enter a repository URL")
      return
    }

    const size = parseInt(chunkSize)
    if (isNaN(size) || size < 500 || size > 1500) {
      toast.error("Chunk size must be between 500 and 1500")
      return
    }

    try {
      setIsIngesting(true)
      
      await ingestRepository(repoUrl, size)

      toast.success("Ingestion pipeline started successfully")
      setRepoUrl("")
      loadRepositories()
      
    } catch (error: any) {
      console.error("Ingestion error:", error)
      const message = error.response?.data?.detail || "Failed to start ingestion"
      toast.error(message)
    } finally {
      setIsIngesting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
      case "Processing":
        return <Loader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
      case "Failed":
        return <X className="w-5 h-5 text-red-600 dark:text-red-400" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      <Toaster 
        richColors 
        position="bottom-center" 
        toastOptions={{
          style: { padding: '8px 12px', fontSize: '12px', minHeight: '32px' },
        }}
      />

      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Repository Ingestion</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">Ingest and process code repositories</p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Ingest New Repository</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              disabled={isIngesting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Chunk Size</label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              placeholder="1000"
              min="500"
              max="1500"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              disabled={isIngesting}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Number of characters per chunk (500-1500)</p>
          </div>
          <Button 
            onClick={handleIngest} 
            className="w-full bg-black dark:bg-white text-white dark:text-black"
            disabled={isIngesting}
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Ingestion...
              </>
            ) : (
              "Start Ingestion"
            )}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Ingested Repositories ({repositories.length})
        </h3>
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          {isLoadingRepositories ? (
            <div className="px-6 py-8 text-center text-zinc-600 dark:text-zinc-400">Loading repositories...</div>
          ) : repositories.length === 0 ? (
            <div className="px-6 py-8 text-center text-zinc-600 dark:text-zinc-400">No repositories ingested yet</div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{repo.url}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Chunk size: {repo.chunkSize} • Chunks: {repo.chunks}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {new Date(repo.createdAt).toLocaleDateString()}
                      </p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          repo.status === "Completed"
                            ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : repo.status === "Processing"
                              ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                              : "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {repo.status}
                      </span>
                    </div>
                    {getStatusIcon(repo.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RepositoryIngestion
