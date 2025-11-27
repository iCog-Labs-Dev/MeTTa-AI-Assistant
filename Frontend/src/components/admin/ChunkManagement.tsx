import React, { useState, useEffect, useMemo } from 'react'
import { Search, Edit2, Trash2, Zap, Filter, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { toast, Toaster } from 'sonner'
import { useAdminStore } from '../../store/useAdminStore'
import { updateChunk, deleteChunk, triggerEmbedding, annotateChunk } from '../../services/adminService'
import { CodeChunk } from '../../types/admin'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import Modal from '../ui/modal'
import Textarea from '../ui/textarea'
import Badge from '../ui/badge'
import ConfirmationDialog from '../ui/confirmation-dialog'

function ChunkManagement() {
  const { chunks, isLoadingChunks, loadChunks } = useAdminStore()
  const safeChunks = Array.isArray(chunks) ? chunks : []
  
  const [filters, setFilters] = useState({
    project: '',
    repo: '',
    section: '',
    search: '',
  })
  
  const [fetchLimit, setFetchLimit] = useState(100)
  const [page, setPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  const [editingChunk, setEditingChunk] = useState<CodeChunk | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deletingChunk, setDeletingChunk] = useState<CodeChunk | null>(null)
  const [annotatingChunk, setAnnotatingChunk] = useState<CodeChunk | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadChunks({ limit: fetchLimit } as any)
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [fetchLimit, loadChunks])

  const filteredChunks = useMemo(() => {
    return safeChunks.filter(chunk => {
      const matchProject = !filters.project || (chunk.project || '').toLowerCase().includes(filters.project.toLowerCase())
      const matchRepo = !filters.repo || (chunk.repo || '').toLowerCase().includes(filters.repo.toLowerCase())
      const matchSection = !filters.section || (chunk.section || []).some(s => s.toLowerCase().includes(filters.section.toLowerCase()))
      const matchSearch = !filters.search || (chunk.chunk || '').toLowerCase().includes(filters.search.toLowerCase())
      
      return matchProject && matchRepo && matchSection && matchSearch
    })
  }, [safeChunks, filters])

  const totalPages = Math.ceil(filteredChunks.length / itemsPerPage)
  const paginatedChunks = filteredChunks.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  useEffect(() => {
    setPage(1)
  }, [filters, fetchLimit])

  const handleUpdateChunk = async () => {
    if (!editingChunk) return
    try {
      await updateChunk(editingChunk.chunkId, { chunk: editContent })
      toast.success('Chunk updated successfully')
      setEditingChunk(null)
      loadChunks({ limit: fetchLimit } as any) 
    } catch (error) {
      console.error('Failed to update chunk:', error)
      toast.error('Failed to update chunk')
    }
  }

  const handleDeleteChunk = async () => {
    if (!deletingChunk) return
    try {
      await deleteChunk(deletingChunk.chunkId)
      toast.success('Chunk deleted')
      setDeletingChunk(null)
      loadChunks({ limit: fetchLimit } as any)
    } catch (error) {
      console.error('Failed to delete chunk:', error)
      toast.error('Failed to delete chunk')
    }
  }

  const handleTriggerEmbedding = async () => {
    const toastId = toast.loading("Starting embedding pipeline...")
    try {
      const data = await triggerEmbedding()
      toast.dismiss(toastId)
      toast.success(data.message)
      loadChunks({ limit: fetchLimit } as any)
    } catch (error) {
      toast.dismiss(toastId)
      console.error('Failed to trigger embedding:', error)
      toast.error('Failed to trigger embedding')
    }
  }

  const handleAnnotateChunk = async () => {
    if (!annotatingChunk) return
    setIsProcessing(true)
    try {
      await annotateChunk(annotatingChunk.chunkId)
      toast.success('Annotation triggered successfully')
      setAnnotatingChunk(null)
      loadChunks({ limit: fetchLimit } as any)
    } catch (error) {
      console.error('Failed to annotate chunk:', error)
      toast.error('Failed to annotate chunk')
      setAnnotatingChunk(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>
    const s = status.toUpperCase()
    if (s === 'COMPLETED') return <Badge variant="default">Completed</Badge>
    if (s === 'FAILED') return <Badge variant="destructive">Failed</Badge>
    if (s === 'RAW') return <Badge variant="outline">Raw</Badge>
    return <Badge variant="secondary">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <Toaster 
        richColors 
        position="bottom-center" 
        toastOptions={{
          style: { padding: '8px 12px', fontSize: '12px', minHeight: '32px' },
        }}
      />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Chunk Management</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">Browse, edit, and manage code chunks</p>
        </div>
        <Button onClick={handleTriggerEmbedding} className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
          <Zap className="w-4 h-4 mr-2" />
          Embed
        </Button>
      </div>

      <Card className="dark:bg-zinc-950 dark:border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-limit">Limit</Label>
              <Input
                id="filter-limit"
                type="number"
                min="1"
                max="1000"
                value={fetchLimit}
                onChange={(e) => setFetchLimit(parseInt(e.target.value) || 50)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-project">Project</Label>
              <Input
                id="filter-project"
                placeholder="Filter by project..."
                value={filters.project}
                onChange={(e) => setFilters({ ...filters, project: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-repo">Repository</Label>
              <Input
                id="filter-repo"
                placeholder="Filter by repo..."
                value={filters.repo}
                onChange={(e) => setFilters({ ...filters, repo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-section">Section</Label>
              <Input
                id="filter-section"
                placeholder="Filter by section..."
                value={filters.section}
                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
              />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="filter-search">Search Content</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="filter-search"
                  placeholder="Search content..."
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-zinc-950 dark:border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chunks ({filteredChunks.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoadingChunks}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">
                Page {page} of {totalPages || 1}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoadingChunks}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingChunks ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-zinc-600 dark:text-zinc-400">Loading chunks...</div>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
              No chunks found matching your filters
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedChunks.map((chunk) => (
                <div
                  key={chunk.chunkId}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {chunk.project && (
                          <Badge variant="outline">Project: {chunk.project}</Badge>
                        )}
                        {chunk.repo && (
                          <Badge variant="outline">Repo: {chunk.repo}</Badge>
                        )}
                        {chunk.section && Array.isArray(chunk.section) && chunk.section.length > 0 && (
                          <Badge variant="outline">Section: {chunk.section.filter(Boolean).join(' > ')}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400">Embedding:</span>
                          {chunk.isEmbedded ? (
                            <Badge variant="default">Embedded</Badge>
                          ) : (
                            <Badge variant="secondary">Not Embedded</Badge>
                          )}
                        </div>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400">Status:</span>
                          {getStatusBadge(chunk.status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnnotatingChunk(chunk)}
                        title="Annotate this chunk"
                        className="h-8 w-8 p-0"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingChunk(chunk)
                          setEditContent(chunk.chunk)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingChunk(chunk)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-3 overflow-x-auto border border-zinc-100 dark:border-zinc-800">
                    <pre className="text-sm text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap break-words font-mono">
                      {chunk.chunk}
                    </pre>
                  </div>

                  {/* Display Annotation/Description */}
                  {(chunk.description || chunk.annotation) && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-sm">
                      <div className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                        <FileText className="w-3 h-3" /> AI Annotation
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {chunk.description || chunk.annotation}
                      </p>
                    </div>
                  )}
                  
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                    <span>ID: {chunk.chunkId}</span>
                    {chunk.last_annotated_at && (
                      <span>Annotated: {new Date(chunk.last_annotated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal 
        isOpen={!!editingChunk} 
        onClose={() => setEditingChunk(null)}
        title="Edit Chunk Content"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-content">Content</Label>
            <Textarea
              id="edit-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={12}
              className="font-mono mt-2"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleUpdateChunk}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditingChunk(null)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deletingChunk}
        onClose={() => setDeletingChunk(null)}
        onConfirm={handleDeleteChunk}
        title="Delete Chunk"
        description={
          <span>
            Are you sure you want to permanently delete chunk <span className="font-mono text-zinc-900 dark:text-zinc-200">{deletingChunk?.chunkId}</span>? This action cannot be undone.
          </span>
        }
        confirmText="Delete Permanently"
        variant="danger"
      />

      {/* Annotation Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!annotatingChunk}
        onClose={() => setAnnotatingChunk(null)}
        onConfirm={handleAnnotateChunk}
        title="Annotate Chunk"
        description={
          <span>
            This will trigger the AI annotation process for chunk <span className="font-mono text-zinc-900 dark:text-zinc-200">{annotatingChunk?.chunkId}</span>. This may take a few moments.
          </span>
        }
        confirmText="Start Annotation"
        variant="info"
        isLoading={isProcessing}
      />
    </div>
  )
}

export default ChunkManagement