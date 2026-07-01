import { AdminRoute } from "@/components/admin-route"
import { MesaControlAdmin } from "@/components/mesa-control-admin"

export default function ControlBufetesPage() {
  return (
    <AdminRoute>
      <div className="flex-1 p-2 md:p-6">
        <MesaControlAdmin />
      </div>
    </AdminRoute>
  )
}