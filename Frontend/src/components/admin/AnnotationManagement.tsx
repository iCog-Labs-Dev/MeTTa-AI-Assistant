import { useEffect, useState } from "react"
import { Play, RotateCw, Database, CheckCircle, Clock, AlertCircle, AlertTriangle } from "lucide-react"
import { useAdminStore } from "../../store/useAdminStore"
import { Button } from "../ui/button"
import StatCard from "./StatCard"
import { toast, Toaster } from "sonner"

function AnnotationManagement() {
  const { 
    annotationStats, 
    stats, 
    isBatchProcessing, 
    loadAnnotationStats, 
    loadStats, 
    startBatchAnnotation, 
    retryFailedAnnotations 
  } = useAdminStore()
  
  const [batchLimit, setBatchLimit] = useState("")
  const [includeQuotaExceeded, setIncludeQuotaExceeded] = useState(false)

  useEffect(() => {
    loadAnnotationStats()
    loadStats()
  }, [loadAnnotationStats, loadStats])

  const handleStartBatch = async () => {
    try {
      const limit = batchLimit ? Number.parseInt(batchLimit) : undefined
      await startBatchAnnotation(limit)
      toast.success("Batch annotation initiated successfully")
      loadAnnotationStats()
    } catch (error: any) {
      console.error("Batch annotation failed:", error)
      toast.error(error.response?.data?.detail || "Failed to start batch annotation")
    }
  }

  const handleRetryFailed = async () => {
    try {
      await retryFailedAnnotations(includeQuotaExceeded)
      toast.success("Retry batch started successfully")
      loadAnnotationStats()
    } catch (error: any) {
      console.error("Retry failed:", error)
      toast.error(error.response?.data?.detail || "Failed to start retry batch")
    }
  }

  return (
    <div className="space-y-8">
      <Toaster 
        richColors 
        position="bottom-center" 
        toastOptions={{
          style: { padding: '10px', fontSize: '13px', minHeight: '40px' },
        }}
      />
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Annotation Management</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">Monitor and manage chunk annotations</p>
      </div>

      {/* Stats grid */}
      {annotationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Chunks" value={annotationStats.total} icon={Database} />
          <StatCard
            label="Annotated"
            value={annotationStats.completed}
            icon={CheckCircle}
            accent="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          />
          <StatCard
            label="Pending"
            value={annotationStats.pending}
            icon={Clock}
            accent="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            label="Failed"
            value={annotationStats.failed}
            icon={AlertCircle}
            accent="bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          />
          <StatCard
            label="Quota Exceeded"
            value={stats?.quotaExceeded || 0}
            icon={AlertTriangle}
            accent="bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
          />
        </div>
      )}

      {/* Batch operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch Annotate */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Batch Annotate Unannotated Chunks
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Trigger annotation for all unannotated chunks. Optionally set a limit for the number of chunks to process.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Limit (optional)
              </label>
              <input
                type="number"
                value={batchLimit}
                onChange={(e) => setBatchLimit(e.target.value)}
                placeholder="Leave empty for no limit"
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Maximum number of chunks to process in this batch
              </p>
            </div>
            <Button
              onClick={handleStartBatch}
              disabled={isBatchProcessing}
              className="w-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isBatchProcessing ? "Processing..." : "Start Batch Annotation"}
            </Button>
          </div>
        </div>

        {/* Retry Failed */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Retry Failed Annotations</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Retry all failed annotation tasks. Optionally include chunks that failed due to quota limits.
          </p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeQuotaExceeded}
                onChange={(e) => setIncludeQuotaExceeded(e.target.checked)}
                className="w-4 h-4 border border-zinc-300 dark:border-zinc-700 rounded accent-blue-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Include quota-exceeded chunks</span>
            </label>
            <Button
              onClick={handleRetryFailed}
              disabled={isBatchProcessing}
              className="w-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
              {isBatchProcessing ? "Processing..." : "Retry"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnnotationManagement
