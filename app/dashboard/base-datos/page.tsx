import { AdminRoute } from "@/components/admin-route"
import { DatabaseManagement } from "@/components/database-management"

export default function BaseDatosPage() {
  return (
    <AdminRoute>
      <div className="flex-1 p-2 md:p-6">
        <DatabaseManagement />
      </div>
    </AdminRoute>
  )
}