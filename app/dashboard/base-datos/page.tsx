import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminRoute } from "@/components/admin-route"
import { DatabaseManagement } from "@/components/database-management"

export default function BaseDatosPage() {
  return (
    <DashboardLayout>
      <AdminRoute>
        <DatabaseManagement />
      </AdminRoute>
    </DashboardLayout>
  )
}
