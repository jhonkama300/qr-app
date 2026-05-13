"use client"

import { MealInventoryManagement } from "@/components/meal-inventory-management"

export default function InventarioPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>
        <p className="text-muted-foreground">Administra el inventario global de comidas del evento</p>
      </div>

      <MealInventoryManagement />
    </div>
  )
}
