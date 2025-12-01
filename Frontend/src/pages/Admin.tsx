import { useEffect, useState } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import AdminLayout from "../components/admin/AdminLayout"
import AdminDashboard from "../components/admin/AdminDashboard"
import AnnotationManagement from "../components/admin/AnnotationManagement"
import UserManagement from "../components/admin/UserManagement"
import ChunkManagement from "../components/admin/ChunkManagement"
import RepositoryIngestion from "../components/admin/RepositoryIngestion"
import { isAuthenticated as checkAuth } from "../lib/auth"
import { toast, Toaster } from "sonner"
import { useUserStore } from "../store/useUserStore"

function Admin() {
  const [isLoading, setIsLoading] = useState(true)
  const role = useUserStore((s) => s.role)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (! isLoading && isAuthenticated && role && role !== "admin") {
      toast.error("You need admin access")
      const timer = setTimeout(() => {navigate("/chat", { replace: true, state: { unauthorized: true } })}, 1500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, isAuthenticated, role, navigate])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!role || role !== "admin") {
    return (
      <Toaster richColors position="top-center" toastOptions={{
          style: { padding: '5px', fontSize: '13px', minHeight: '40px' },
        }}
      />
    )
  }

  return (
    <AdminLayout>
      <Toaster richColors position="bottom-center" toastOptions={{
          style: { padding: '10px', fontSize: '13px', minHeight: '40px' },
        }}
      />
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/annotations" element={<AnnotationManagement />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/chunks" element={<ChunkManagement />} />
        <Route path="/repositories" element={<RepositoryIngestion />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  )
}

export default Admin
