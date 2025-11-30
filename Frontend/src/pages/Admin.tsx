import { useEffect, useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import AdminLayout from "../components/admin/AdminLayout"
import AdminDashboard from "../components/admin/AdminDashboard"
import AnnotationManagement from "../components/admin/AnnotationManagement"
import UserManagement from "../components/admin/UserManagement"
import ChunkManagement from "../components/admin/ChunkManagement"
import RepositoryIngestion from "../components/admin/RepositoryIngestion"
import { isAuthenticated, getAccessToken } from "../lib/auth"
import { jwtDecode } from "jwt-decode"
import { toast, Toaster } from "sonner"

function Admin() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    const authed = isAuthenticated()

    if (!authed) {
      setIsAllowed(false)
      setIsLoading(false)
      return
    }

    const token = getAccessToken()
    if (!token) {
      setIsAllowed(false)
      setIsLoading(false)
      return
    }

    try {
      const decoded: any = jwtDecode(token)
      const role = decoded.role?.toLowerCase()

      if (role === "admin") {
        setIsAllowed(true)
      } else {
        toast.error("You need admin access")
        setIsAllowed(false)
      }
    } catch {
      setIsAllowed(false)
    }

    setIsLoading(false)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!isAllowed) {
    return <Navigate to="/chat" replace />
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
