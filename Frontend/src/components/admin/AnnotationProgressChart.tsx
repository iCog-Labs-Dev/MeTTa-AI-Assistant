import type { AnnotationStats } from "../../types/admin"

interface AnnotationProgressChartProps {
  stats: AnnotationStats
}

function AnnotationProgressChart({ stats }: AnnotationProgressChartProps) {
  const progressItems = [
    { label: "Completed", value: stats.completed, percentage: stats.completedPercentage, color: "bg-green-500" },
    { label: "Pending", value: stats.pending, percentage: stats.pendingPercentage, color: "bg-yellow-500" },
    { label: "Failed", value: stats.failed, percentage: stats.failedPercentage, color: "bg-red-500" },
  ]

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Annotation Progress</h2>
      <div className="space-y-4">
        {progressItems.map(({ label, value, percentage, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {value} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AnnotationProgressChart
