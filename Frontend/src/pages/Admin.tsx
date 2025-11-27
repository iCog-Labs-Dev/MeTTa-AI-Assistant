import { useEffect, useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import AdminLayout from "../components/admin/AdminLayout"
import AdminDashboard from "../components/admin/AdminDashboard"
import AnnotationManagement from "../components/admin/AnnotationManagement"
import UserManagement from "../components/admin/UserManagement"
import ChunkManagement from "../components/admin/ChunkManagement"
import RepositoryIngestion from "../components/admin/RepositoryIngestion"
import { isAuthenticated } from "../lib/auth"

function Admin() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const authed = isAuthenticated()
    setIsAuthed(authed)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />
  }

  return (
    <AdminLayout>
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
