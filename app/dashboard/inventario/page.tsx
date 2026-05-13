import { DashboardLayout } from "@/components/dashboard-layout"
import { MealInventoryManagement } from "@/components/meal-inventory-management"
import { Package } from "lucide-react"

export default function InventarioPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 space-y-3 md:space-y-6 p-2 md:p-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex size-9 md:size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-uparsistem-600 to-uparsistem-500 shadow-md shadow-uparsistem-600/20">
            <Package className="size-4 md:size-6 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-2xl font-bold text-uparsistem-800 dark:text-uparsistem-200 leading-tight">Gestión de Inventario</h1>
            <p className="text-[10px] md:text-sm text-uparsistem-700 dark:text-uparsistem-300 leading-tight mt-0.5">Administra el inventario global de comidas del evento</p>
          </div>
        </div>

        <MealInventoryManagement />
      </div>
    </DashboardLayout>
  )
}
