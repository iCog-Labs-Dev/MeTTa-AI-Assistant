import { useEffect, useMemo } from "react"
import { Users, Database, CheckCircle, Activity, Clock, ArrowUpRight } from "lucide-react"
import { useAdminStore } from "../../store/useAdminStore"
import StatCard from "./StatCard"
import AnnotationProgressChart from "./AnnotationProgressChart"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Link } from "react-router-dom"

function AdminDashboard() {
  const { 
    stats, 
    annotationStats, 
    totalChunks,
    chunks,
    isLoadingStats, 
    loadStats, 
    loadAnnotationStats,
    loadChunks 
  } = useAdminStore()

  useEffect(() => {
    loadStats()
    loadAnnotationStats()
    loadChunks({ limit: 1000 }) 
  }, [loadStats, loadAnnotationStats, loadChunks])

  const recentActivity = useMemo(() => {
    if (!chunks.length) return []
    return [...chunks]
      .filter(c => c.last_annotated_at)
      .sort((a, b) => new Date(b.last_annotated_at!).getTime() - new Date(a.last_annotated_at!).getTime())
      .slice(0, 5)
  }, [chunks])

  if (isLoadingStats && !stats && !annotationStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-zinc-500">Loading dashboard metrics...</div>
      </div>
    )
  }

  const totalUsers = stats?.totalUsers ?? (stats as any)?.total_users ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Overview</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">System health and annotation metrics</p>
        </div>
        <div className="text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Total Users" 
          value={totalUsers} 
          icon={Users} 
        />
        <StatCard 
          label="Total Chunks" 
          value={totalChunks || chunks.length || 0} 
          icon={Database} 
        />
        <StatCard 
          label="Total Annotations" 
          value={annotationStats?.completed ?? 0} 
          icon={CheckCircle} 
          accent="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
          {annotationStats && <AnnotationProgressChart stats={annotationStats} />}

          <Card className="dark:bg-zinc-950 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-zinc-500" />
                Recent Annotations
              </CardTitle>
              <Link to="/admin/chunks" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((chunk) => (
                    <div key={chunk.chunkId} className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-900 last:border-0 last:pb-0">
                      <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0">
                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {chunk.filename || (chunk as any).file_name || `Chunk ${chunk.chunkId.substring(0, 8)}`}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          ID: {chunk.chunkId}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-zinc-500 text-sm">No recent activity found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
