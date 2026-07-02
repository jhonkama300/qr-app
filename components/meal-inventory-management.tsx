"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDesc,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Package, RefreshCw, Settings, AlertTriangle, Plus, Utensils, Edit, Trash2 } from "lucide-react"
import { doc, onSnapshot, collection, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  updateMealInventory,
  resetMealInventory,
  createOrUpdateTableMealInventory,
  addMealsToTable,
  deleteTableMealInventory,
  type MealInventory,
  type TableMealInventory,
} from "@/lib/firestore-service"
import { Badge } from "@/components/ui/badge"

export function MealInventoryManagement() {
  const [inventory, setInventory] = useState<MealInventory | null>(null)
  const [tableInventories, setTableInventories] = useState<TableMealInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isAddTableDialogOpen, setIsAddTableDialogOpen] = useState(false)
  const [isAddMealsDialogOpen, setIsAddMealsDialogOpen] = useState(false)
  const [isEditTableDialogOpen, setIsEditTableDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<TableMealInventory | null>(null)
  const [deletingTable, setDeletingTable] = useState<TableMealInventory | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [newTotal, setNewTotal] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [tableName, setTableName] = useState("")
  const [tableMeals, setTableMeals] = useState("")
  const [mealsToAdd, setMealsToAdd] = useState("")
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribe = onSnapshot(inventoryRef, (doc) => {
      if (doc.exists()) {
        setInventory(doc.data() as MealInventory)
      } else {
        const defaultInventory: MealInventory = {
          totalComidas: 2400,
          comidasConsumidas: 0,
          comidasDisponibles: 2400,
          fechaActualizacion: new Date().toISOString(),
        }
        setInventory(defaultInventory)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const tablesRef = collection(db, "table_meal_inventory")
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const tables: TableMealInventory[] = []
      snapshot.forEach((doc) => {
        tables.push({ id: doc.id, ...doc.data() } as TableMealInventory)
      })
      setTableInventories(tables.sort((a, b) => a.numeroMesa - b.numeroMesa))
    })

    return () => unsubscribe()
  }, [])

  const handleEditTable = async () => {
    if (!editingTable) return

    const meals = Number.parseInt(tableMeals)

    if (isNaN(meals) || meals < 0) {
      setError("Por favor ingresa una cantidad válida de comidas")
      return
    }

    if (!tableName.trim()) {
      setError("Por favor ingresa un nombre para la mesa")
      return
    }

    if (meals < editingTable.comidasConsumidas) {
      setError(`El total no puede ser menor a las comidas ya consumidas (${editingTable.comidasConsumidas})`)
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await createOrUpdateTableMealInventory(editingTable.numeroMesa, tableName, meals, editingTable.activa)
      setSuccess(`Mesa ${editingTable.numeroMesa} actualizada exitosamente`)
      setIsEditTableDialogOpen(false)
      setEditingTable(null)
      setTableName("")
      setTableMeals("")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al actualizar la mesa")
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteTable = async (mesa: TableMealInventory) => {
    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await deleteTableMealInventory(mesa.numeroMesa)
      setSuccess(`Mesa ${mesa.numeroMesa} eliminada exitosamente`)
      setIsDeleteDialogOpen(false)
      setDeletingTable(null)
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al eliminar la mesa")
    } finally {
      setUpdating(false)
    }
  }

  const openEditDialog = (table: TableMealInventory) => {
    setEditingTable(table)
    setTableName(table.nombreMesa)
    setTableMeals(table.totalComidas.toString())
    setIsEditTableDialogOpen(true)
  }

  const handleUpdateTotal = async () => {
    const total = Number.parseInt(newTotal)
    if (isNaN(total) || total < 0) {
      setError("Por favor ingresa un número válido")
      return
    }

    if (inventory && total < inventory.comidasConsumidas) {
      setError("El total no puede ser menor a las comidas ya consumidas")
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await updateMealInventory(total)
      setSuccess(`Inventario actualizado a ${total} comidas`)
      setIsUpdateDialogOpen(false)
      setNewTotal("")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al actualizar el inventario")
    } finally {
      setUpdating(false)
    }
  }

  const handleResetInventory = async () => {
    const total = Number.parseInt(newTotal) || 2400
    if (isNaN(total) || total < 0) {
      setError("Por favor ingresa un número válido")
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await resetMealInventory(total)
      setSuccess(`Inventario reiniciado a ${total} comidas`)
      setIsResetDialogOpen(false)
      setNewTotal("")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al reiniciar el inventario")
    } finally {
      setUpdating(false)
    }
  }

  const handleCreateTable = async () => {
    const numero = Number.parseInt(tableNumber)
    const meals = Number.parseInt(tableMeals)

    if (isNaN(numero) || numero < 1) {
      setError("El número de mesa debe ser mayor o igual a 1")
      return
    }

    if (isNaN(meals) || meals < 0) {
      setError("Por favor ingresa una cantidad válida de comidas")
      return
    }

    if (!tableName.trim()) {
      setError("Por favor ingresa un nombre para la mesa")
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await createOrUpdateTableMealInventory(numero, tableName, meals, true)
      await setDoc(doc(db, "mesas_config", `mesa_${numero}`), {
        numero,
        nombre: tableName,
        activa: true,
        fechaActualizacion: new Date().toISOString(),
      })
      setSuccess(`Mesa ${numero} configurada con ${meals} comidas`)
      setIsAddTableDialogOpen(false)
      setTableNumber("")
      setTableName("")
      setTableMeals("")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al configurar la mesa")
    } finally {
      setUpdating(false)
    }
  }

  const handleAddMealsToTable = async () => {
    if (selectedTable === null) return

    const meals = Number.parseInt(mealsToAdd)
    if (isNaN(meals) || meals <= 0) {
      setError("Por favor ingresa una cantidad válida mayor a 0")
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await addMealsToTable(selectedTable, meals)
      setSuccess(`Se agregaron ${meals} comidas a la Mesa ${selectedTable}`)
      setIsAddMealsDialogOpen(false)
      setMealsToAdd("")
      setSelectedTable(null)
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setError("Error al agregar comidas a la mesa")
    } finally {
      setUpdating(false)
    }
  }

  if (loading || !inventory) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Cargando inventario...</div>
        </CardContent>
      </Card>
    )
  }

  const percentageUsed = (inventory.comidasConsumidas / inventory.totalComidas) * 100
  const percentageAvailable = (inventory.comidasDisponibles / inventory.totalComidas) * 100
  const isLowStock = percentageAvailable < 20

  const totalTableMeals = tableInventories.reduce((sum, table) => sum + table.totalComidas, 0)
  const totalTableConsumed = tableInventories.reduce((sum, table) => sum + table.comidasConsumidas, 0)
  const totalTableAvailable = tableInventories.reduce((sum, table) => sum + table.comidasDisponibles, 0)

  return (
    <div className="space-y-3 md:space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm border-uparsistem-100 dark:border-uparsistem-900/20">
        <CardHeader className="p-3 md:p-5 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-uparsistem-600" />
            Inventario Global de Comidas
          </CardTitle>
          <CardDescription className="text-[10px] md:text-sm">Control centralizado del inventario de comidas disponibles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 md:space-y-4 p-3 md:p-5 pt-0 md:pt-0">
          <div className="flex gap-2 md:gap-3">
            <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-2.5 md:p-4">
              <div className="relative">
                <span className="text-[9px] md:text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Total</span>
                <div className="text-xl md:text-3xl font-bold text-blue-800 dark:text-blue-200">{inventory.totalComidas}</div>
                <p className="text-[8px] md:text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">comidas registradas</p>
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-b from-red-100 to-red-200 dark:from-red-950/30 dark:to-red-900/20 border border-red-200 dark:border-red-800/30 p-2.5 md:p-4">
              <div className="relative">
                <span className="text-[9px] md:text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider">Entregadas</span>
                <div className="text-xl md:text-3xl font-bold text-red-800 dark:text-red-200">{inventory.comidasConsumidas}</div>
                <p className="text-[8px] md:text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">{percentageUsed.toFixed(1)}% del total</p>
              </div>
            </div>
            <div className={`flex-1 relative overflow-hidden rounded-xl border p-2.5 md:p-4 ${
              isLowStock
                ? "bg-gradient-to-b from-orange-100 to-orange-200 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800/30"
                : "bg-gradient-to-b from-green-100 to-green-200 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800/30"
            }`}>
              <div className="relative">
                <span className={`text-[9px] md:text-xs font-semibold uppercase tracking-wider ${isLowStock ? "text-orange-700 dark:text-orange-300" : "text-green-700 dark:text-green-300"}`}>Disponibles</span>
                <div className={`text-xl md:text-3xl font-bold ${isLowStock ? "text-orange-800 dark:text-orange-200" : "text-green-800 dark:text-green-200"}`}>
                  {inventory.comidasDisponibles}
                </div>
                <p className={`text-[8px] md:text-[10px] mt-0.5 ${isLowStock ? "text-orange-600/70 dark:text-orange-400/70" : "text-green-600/70 dark:text-green-400/70"}`}>
                  {percentageAvailable.toFixed(1)}% disponible
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] md:text-xs">
              <span className="text-muted-foreground">Disponibilidad</span>
              <span className="font-semibold text-uparsistem-700 dark:text-uparsistem-300">
                {inventory.comidasDisponibles} / {inventory.totalComidas}
              </span>
            </div>
            <div className="relative h-2 md:h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percentageAvailable}%`,
                  background: percentageAvailable <= 25
                    ? "linear-gradient(90deg, #f87171 0%, #ef4444 100%)"
                    : percentageAvailable <= 60
                      ? "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)"
                      : "linear-gradient(90deg, #4aaa16 0%, #286b04 100%)"
                }}
              />
              <div className="absolute inset-0 flex justify-around px-1 pointer-events-none">
                <div className="w-px h-full bg-white/30" />
                <div className="w-px h-full bg-white/30" />
                <div className="w-px h-full bg-white/30" />
                <div className="w-px h-full bg-white/30" />
              </div>
            </div>
          </div>

          {isLowStock && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="size-3 md:size-4 text-red-600 shrink-0" />
              <p className="text-[10px] md:text-xs text-red-700 dark:text-red-400">
                ¡Advertencia! Inventario bajo ({percentageAvailable.toFixed(1)}% disponible). Considera reabastecer.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 md:gap-2 pt-1">
            <Button onClick={() => setIsUpdateDialogOpen(true)} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1">
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
              Reiniciar
            </Button>
          </div>

          <div className="text-[8px] md:text-xs text-muted-foreground pt-0.5">
            Última actualización: {new Date(inventory.fechaActualizacion).toLocaleString("es-CO")}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-uparsistem-100 dark:border-uparsistem-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
                <Utensils className="h-4 w-4 md:h-5 md:w-5 text-uparsistem-600" />
                Inventario por Mesa
              </CardTitle>
              <CardDescription className="text-[10px] md:text-sm">Gestiona el inventario de comidas asignado a cada mesa</CardDescription>
            </div>
            <Button onClick={() => setIsAddTableDialogOpen(true)} size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-2 border-uparsistem-600 bg-white text-uparsistem-700 hover:bg-uparsistem-600 hover:text-white">
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden md:inline">Nueva Mesa</span>
              <span className="md:hidden">Nueva</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-5 pt-0 md:pt-0">
          {tableInventories.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <Utensils className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 md:mb-3 opacity-30" />
              <p className="text-xs md:text-sm font-medium">No hay mesas configuradas aún</p>
              <p className="text-[10px] md:text-sm">Haz clic en "Nueva Mesa" para comenzar</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 md:gap-3">
                <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-2.5 md:p-4">
                  <div className="relative">
                    <span className="text-[9px] md:text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Total</span>
                    <div className="text-base md:text-xl font-bold text-blue-800 dark:text-blue-200 mt-0.5">{totalTableMeals}</div>
                    <p className="text-[8px] md:text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">comidas asignadas</p>
                  </div>
                </div>
                <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-b from-red-100 to-red-200 dark:from-red-950/30 dark:to-red-900/20 border border-red-200 dark:border-red-800/30 p-2.5 md:p-4">
                  <div className="relative">
                    <span className="text-[9px] md:text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider">Consumidas</span>
                    <div className="text-base md:text-xl font-bold text-red-800 dark:text-red-200 mt-0.5">{totalTableConsumed}</div>
                    <p className="text-[8px] md:text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">entregadas</p>
                  </div>
                </div>
                <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-b from-emerald-100 to-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 p-2.5 md:p-4">
                  <div className="relative">
                    <span className="text-[9px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Disponibles</span>
                    <div className="text-base md:text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">{totalTableAvailable}</div>
                    <p className="text-[8px] md:text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">restantes</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
                {tableInventories.map((table) => {
                  const tablePercentage = (table.comidasDisponibles / table.totalComidas) * 100
                  const isTableLow = tablePercentage < 20

                  return (
                    <Card
                      key={table.id}
                      className={`relative overflow-hidden shadow-sm border ${
                        !table.activa
                          ? "border-gray-200 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-900/80"
                          : isTableLow
                            ? "border-orange-200 dark:border-orange-800/40 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-950/15 dark:to-gray-900"
                            : "border-uparsistem-200/70 dark:border-uparsistem-800/40 bg-gradient-to-br from-uparsistem-50/60 to-white dark:from-uparsistem-950/10 dark:to-gray-900"
                      }`}
                    >
                      {/* Top accent line */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                        !table.activa ? "bg-gray-400"
                        : isTableLow ? "bg-orange-400"
                        : "bg-uparsistem-500"
                      }`} />
                      <CardHeader className="p-2.5 md:p-3 pb-1 md:pb-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CardTitle className={`text-sm md:text-base font-bold truncate ${!table.activa ? "text-gray-500 dark:text-gray-400" : ""}`}>
                              Mesa {table.numeroMesa}
                            </CardTitle>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => openEditDialog(table)} disabled={updating}>
                              <Edit className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => { setDeletingTable(table); setIsDeleteDialogOpen(true) }} disabled={updating}>
                              <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className={`text-[9px] md:text-xs truncate mt-0.5 ${!table.activa ? "text-gray-400 dark:text-gray-500" : ""}`}>{table.nombreMesa}</CardDescription>
                      </CardHeader>
                      <CardContent className={`p-2.5 md:p-3 pt-0 md:pt-0 space-y-1.5 md:space-y-2 ${!table.activa ? "opacity-60" : ""}`}>
                        <div className="flex gap-1.5 md:gap-2 w-full">
                          <div className={`flex-1 min-w-0 text-center rounded-md py-1 md:py-1.5 px-1 ${
                            !table.activa ? "bg-gray-100 dark:bg-gray-800" : "bg-blue-50/80 dark:bg-blue-950/20"
                          }`}>
                            <div className={`text-sm md:text-base font-bold ${!table.activa ? "text-gray-500" : "text-blue-700 dark:text-blue-300"}`}>{table.totalComidas}</div>
                            <p className="text-[7px] md:text-[10px] text-muted-foreground truncate">Total</p>
                          </div>
                          <div className={`flex-1 min-w-0 text-center rounded-md py-1 md:py-1.5 px-1 ${
                            !table.activa ? "bg-gray-100 dark:bg-gray-800" : "bg-red-50/80 dark:bg-red-950/20"
                          }`}>
                            <div className={`text-sm md:text-base font-bold ${!table.activa ? "text-gray-500" : "text-red-700 dark:text-red-300"}`}>{table.comidasConsumidas}</div>
                            <p className="text-[7px] md:text-[10px] text-muted-foreground truncate">Usadas</p>
                          </div>
                          <div className={`flex-1 min-w-0 text-center rounded-md py-1 md:py-1.5 px-1 ${
                            !table.activa ? "bg-gray-100 dark:bg-gray-800"
                            : isTableLow ? "bg-orange-50/80 dark:bg-orange-950/20" : "bg-green-50/80 dark:bg-green-950/20"
                          }`}>
                            <div className={`text-sm md:text-base font-bold truncate ${
                              !table.activa ? "text-gray-500"
                              : isTableLow ? "text-orange-700 dark:text-orange-300" : "text-green-700 dark:text-green-300"
                            }`}>
                              {table.comidasDisponibles}
                            </div>
                            <p className="text-[7px] md:text-[10px] text-muted-foreground truncate">Quedan</p>
                          </div>
                        </div>

                        <div className="relative h-1.5 md:h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${tablePercentage}%`,
                              background: tablePercentage <= 25
                                ? "linear-gradient(90deg, #f87171 0%, #ef4444 100%)"
                                : tablePercentage <= 60
                                  ? "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)"
                                  : "linear-gradient(90deg, #4aaa16 0%, #286b04 100%)"
                            }}
                          />
                          <div className={`absolute inset-0 flex justify-around px-0.5 pointer-events-none ${!table.activa ? "opacity-40" : ""}`}>
                            <div className="w-px h-full bg-white/30" />
                            <div className="w-px h-full bg-white/30" />
                            <div className="w-px h-full bg-white/30" />
                            <div className="w-px h-full bg-white/30" />
                          </div>
                        </div>

                        {table.activa && (
                        <Button
                          onClick={() => {
                            setSelectedTable(table.numeroMesa)
                            setIsAddMealsDialogOpen(true)
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full h-7 md:h-8 text-[9px] md:text-xs gap-1 border-2 border-uparsistem-600 bg-white text-uparsistem-700 hover:bg-uparsistem-600 hover:text-white"
                        >
                          <Plus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          Agregar
                        </Button>
                        )}

                        {isTableLow && table.activa && (
                          <div className="flex items-center gap-1 text-[9px] md:text-xs text-orange-700 dark:text-orange-300 font-medium">
                            <AlertTriangle className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" />
                            <span className="truncate">Stock bajo</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-uparsistem-600 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-uparsistem-700">Actualizar Total de Comidas</DialogTitle>
            <DialogDescription>
              Modifica la cantidad total de comidas disponibles. Las comidas ya consumidas (
              {inventory.comidasConsumidas}) se mantendrán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="newTotal" className="text-sm font-medium">Nueva cantidad total</Label>
              <Input
                id="newTotal"
                type="number"
                placeholder={`Actual: ${inventory.totalComidas}`}
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                min={inventory.comidasConsumidas}
                className="border-uparsistem-200 focus-visible:ring-uparsistem-500"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo permitido: {inventory.comidasConsumidas} (comidas ya consumidas)
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)} disabled={updating} className="border-uparsistem-200">
              Cancelar
            </Button>
            <Button onClick={handleUpdateTotal} disabled={updating} className="bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              {updating ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-uparsistem-600 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-uparsistem-700">Reiniciar Inventario</DialogTitle>
            <DialogDescription>
              Esto reiniciará el contador de comidas consumidas a 0 y establecerá un nuevo total. ¡Esta acción no se
              puede deshacer!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Advertencia: Esto NO afecta los registros de estudiantes individuales. Solo reinicia el inventario
                global.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="resetTotal">Nuevo total de comidas</Label>
              <Input
                id="resetTotal"
                type="number"
                placeholder="2400"
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                min={0}
              />
            </div>
          </div>
           <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={updating} className="border-uparsistem-200">
              Cancelar
            </Button>
            <Button onClick={handleResetInventory} disabled={updating} variant="destructive">
              {updating ? "Reiniciando..." : "Reiniciar Inventario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTableDialogOpen} onOpenChange={setIsAddTableDialogOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-uparsistem-600 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-uparsistem-700">Configurar Mesa</DialogTitle>
            <DialogDescription>
              Asigna comidas a una mesa específica para un mejor control del inventario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tableNumber" className="text-sm font-medium">Número de Mesa</Label>
              <Input id="tableNumber" type="number" placeholder="1" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} min={1} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tableName" className="text-sm font-medium">Nombre de la Mesa</Label>
              <Input id="tableName" type="text" placeholder="ej: Bufete Principal, Mesa Norte" value={tableName} onChange={(e) => setTableName(e.target.value)} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tableMeals" className="text-sm font-medium">Cantidad de Comidas</Label>
              <Input id="tableMeals" type="number" placeholder="240" value={tableMeals} onChange={(e) => setTableMeals(e.target.value)} min={0} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddTableDialogOpen(false)} disabled={updating} className="border-uparsistem-200">
              Cancelar
            </Button>
            <Button onClick={handleCreateTable} disabled={updating} className="bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              {updating ? "Configurando..." : "Configurar Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditTableDialogOpen} onOpenChange={setIsEditTableDialogOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-uparsistem-600 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-uparsistem-700">Editar Mesa {editingTable?.numeroMesa}</DialogTitle>
            <DialogDescription>Modifica la configuración de la mesa seleccionada</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTableName" className="text-sm font-medium">Nombre de la Mesa</Label>
              <Input id="editTableName" type="text" placeholder="ej: Bufete Principal" value={tableName} onChange={(e) => setTableName(e.target.value)} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editTableMeals" className="text-sm font-medium">Total de Comidas</Label>
              <Input id="editTableMeals" type="number" placeholder="240" value={tableMeals} onChange={(e) => setTableMeals(e.target.value)} min={editingTable?.comidasConsumidas || 0} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
              {editingTable && (
                <p className="text-xs text-muted-foreground">
                  Comidas ya consumidas: {editingTable.comidasConsumidas}. Disponibles después del cambio:{" "}
                  {Math.max(0, Number.parseInt(tableMeals || "0") - editingTable.comidasConsumidas)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditTableDialogOpen(false)} disabled={updating} className="border-uparsistem-200">
              Cancelar
            </Button>
            <Button onClick={handleEditTable} disabled={updating} className="bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              {updating ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMealsDialogOpen} onOpenChange={setIsAddMealsDialogOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-uparsistem-600 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-uparsistem-700">Agregar Comidas a Mesa {selectedTable}</DialogTitle>
            <DialogDescription>Incrementa el inventario de comidas disponibles en esta mesa</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="mealsToAdd" className="text-sm font-medium">Cantidad a Agregar</Label>
              <Input id="mealsToAdd" type="number" placeholder="240" value={mealsToAdd} onChange={(e) => setMealsToAdd(e.target.value)} min={1} className="border-uparsistem-200 focus-visible:ring-uparsistem-500" />
              <p className="text-xs text-muted-foreground">Esta cantidad se sumará al inventario actual de la mesa</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsAddMealsDialogOpen(false); setSelectedTable(null); setMealsToAdd("") }} disabled={updating} className="border-uparsistem-200">
              Cancelar
            </Button>
            <Button onClick={handleAddMealsToTable} disabled={updating} className="bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              {updating ? "Agregando..." : "Agregar Comidas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-t-4 border-t-red-500 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Eliminar Mesa {deletingTable?.numeroMesa}</AlertDialogTitle>
            <AlertDialogDesc>
              ¿Estás seguro de eliminar la Mesa <strong>{deletingTable?.numeroMesa} - {deletingTable?.nombreMesa}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDesc>
          </AlertDialogHeader>
          {deletingTable && (
            <div className="text-sm text-muted-foreground space-y-1 bg-red-50 dark:bg-red-950/10 rounded-lg p-3 border border-red-100 dark:border-red-900/30">
              <p><span className="font-medium">Total comidas:</span> {deletingTable.totalComidas}</p>
              <p><span className="font-medium">Consumidas:</span> {deletingTable.comidasConsumidas}</p>
              <p><span className="font-medium">Disponibles:</span> {deletingTable.comidasDisponibles}</p>
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-uparsistem-200" onClick={() => { setDeletingTable(null) }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingTable && handleDeleteTable(deletingTable)} className="bg-red-600 hover:bg-red-700 text-white">
              {updating ? "Eliminando..." : "Eliminar Mesa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
