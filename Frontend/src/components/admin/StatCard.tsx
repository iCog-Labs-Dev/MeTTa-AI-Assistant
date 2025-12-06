import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  accent?: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{value}</p>
        </div>
        <div className={`${accent} p-3 rounded-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

export default StatCard
