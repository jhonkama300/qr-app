import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminRoute } from "@/components/admin-route"
import { MesaControlAdmin } from "@/components/mesa-control-admin"

export default function ControlBufetesPage() {
  return (
    <DashboardLayout>
      <AdminRoute>
        <MesaControlAdmin />
      </AdminRoute>
    </DashboardLayout>
  )
}
