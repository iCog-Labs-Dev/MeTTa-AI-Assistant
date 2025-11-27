import { useEffect, useState } from "react"
import { Trash2, Shield, User } from "lucide-react"
import { useAdminStore } from "../../store/useAdminStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import Modal from "../ui/modal"
import { toast } from "sonner"
import ConfirmationDialog from "../ui/confirmation-dialog"

function UserManagement() {
  const { users, isLoadingUsers, loadUsers, deleteUser, addUser } = useAdminStore()
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role: "User"
  })

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    
    try {
      await deleteUser(userToDelete)
      toast.success("User deleted successfully")
    } catch (error) {
      toast.error("Failed to delete user")
    } finally {
      setUserToDelete(null)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addUser(newUser)
      toast.success("User created successfully")
      setIsAddUserOpen(false)
      setNewUser({ email: "", password: "", role: "User" })
    } catch (error) {
      console.error(error)
      toast.error("Failed to create user")
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">User Management</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">Manage user accounts and roles</p>
        </div>
        <Button 
          onClick={() => setIsAddUserOpen(true)}
          className="bg-black dark:bg-white text-white dark:text-black"
        >
          + Add User
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Created</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-zinc-600 dark:text-zinc-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-zinc-600 dark:text-zinc-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.role === "Admin" ? (
                          <>
                            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-zinc-900 dark:text-zinc-50 font-medium">{user.role}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4 text-zinc-400" />
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{user.role}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isAddUserOpen} 
        onClose={() => setIsAddUserOpen(false)} 
        title="Create New User"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 mt-6"
          >
            Create User
          </Button>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete User"
        variant="danger"
      />
    </div>
  )
}

export default UserManagement
