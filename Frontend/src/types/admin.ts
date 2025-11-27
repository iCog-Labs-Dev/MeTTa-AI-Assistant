export interface AdminStats {
  totalUsers: number
  totalChunks: number
  annotatedChunks: number
  failedAnnotations: number
  quotaExceeded: number
  total_users?: number
  total_chunks?: number
  annotated_chunks?: number
  failed_annotations?: number
  quota_exceeded?: number
}

export interface AnnotationProgress {
  completed: number
  pending: number
  failed: number
}

export interface AnnotationStats extends AnnotationProgress {
  total: number
  completedPercentage: number
  pendingPercentage: number
  failedPercentage: number
}

export interface User {
  id: string
  email: string
  role: "Admin" | "User"
  createdAt: string
}

export interface CodeChunk {
  chunkId: string
  source: string
  chunk: string
  isEmbedded: boolean
  project: string
  repo: string
  section: string[]
  file: string[]
  version: string
  status: string
  last_annotated_at: string | null
  annotation?: string | null
  url?: string | null
  page_title?: string | null
  category?: string | null
  filename?: string | null
  file_name?: string | null
  page_numbers?: string | null
  description?: string | null
  pending_since?: string | null
  retry_count?: number
}

export interface IngestResponse {
  message: string
  status: string
  task_id?: string
}

export interface ChunkUpdateData {
  chunk?: string; 
  metadata?: Record<string, any>;
  embedding_status?: string;
  annotation_status?: string;
  annotation?: string;
}

export interface Repository {
  id: string
  url: string
  chunkSize: number
  chunks: number
  status: "Completed" | "Processing" | "Failed"
  createdAt: string
}

export interface BatchAnnotationRequest {
  limit?: number
  includeQuotaExceeded: boolean
}

export interface FailedAnnotationRetryRequest {
  includeQuotaExceeded: boolean
}

export interface ChunkFilters {
  project?: string
  repository?: string
  section?: string
  search?: string
  page?: number
  limit?: number
}