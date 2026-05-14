import { AdminRoute } from "@/components/admin-route"
import { DatabaseManagement } from "@/components/database-management"
import { Database } from "lucide-react"

export default function BaseDatosPage() {
  return (
    <AdminRoute>
      <div className="flex-1 space-y-3 md:space-y-6 p-2 md:p-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex size-9 md:size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-uparsistem-600 to-uparsistem-500 shadow-md shadow-uparsistem-600/20">
            <Database className="size-4 md:size-6 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-2xl font-bold text-gray-900 leading-tight">Base de Datos</h1>
            <p className="text-[10px] md:text-sm text-gray-500 leading-tight mt-0.5">Administra y gestiona los registros del sistema</p>
          </div>
        </div>
        <DatabaseManagement />
      </div>
    </AdminRoute>
  )
}