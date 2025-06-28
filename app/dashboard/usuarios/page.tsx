import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminRoute } from "@/components/admin-route"
import { UserManagement } from "@/components/user-management"

export default function UsuariosPage() {
  return (
    <DashboardLayout>
      <AdminRoute>
        <UserManagement />
      </AdminRoute>
    </DashboardLayout>
  )
}
