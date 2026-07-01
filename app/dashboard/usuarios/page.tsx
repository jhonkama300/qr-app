import { AdminRoute } from "@/components/admin-route"
import { UserManagement } from "@/components/user-management"

export default function UsuariosPage() {
  return (
    <AdminRoute>
      <div className="flex-1 p-2 md:p-6">
        <UserManagement />
      </div>
    </AdminRoute>
  )
}