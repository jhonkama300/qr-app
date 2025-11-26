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
import { Package, RefreshCw, Settings, AlertTriangle, Plus, Utensils, Edit, Trash2 } from "lucide-react"
import { doc, onSnapshot, collection } from "firebase/firestore"
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
import { Progress } from "@/components/ui/progress"
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
    if (
      !confirm(
        `¿Estás seguro de eliminar la Mesa ${mesa.numeroMesa}? Esta acción no se puede deshacer.\n\nMesa: ${mesa.nombreMesa}\nComidas consumidas: ${mesa.comidasConsumidas}`,
      )
    ) {
      return
    }

    setUpdating(true)
    setError("")
    setSuccess("")

    try {
      await deleteTableMealInventory(mesa.numeroMesa)
      setSuccess(`Mesa ${mesa.numeroMesa} eliminada exitosamente`)
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

    if (isNaN(numero) || numero < 1 || numero > 10) {
      setError("El número de mesa debe estar entre 1 y 10")
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
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventario Global de Comidas
          </CardTitle>
          <CardDescription>Control centralizado del inventario de comidas disponibles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Total Asignado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-800">{inventory.totalComidas}</div>
                <p className="text-xs text-blue-600 mt-1">comidas en total</p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Comidas Entregadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-800">{inventory.comidasConsumidas}</div>
                <p className="text-xs text-red-600 mt-1">{percentageUsed.toFixed(1)}% del total</p>
              </CardContent>
            </Card>

            <Card className={`${isLowStock ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium ${isLowStock ? "text-orange-600" : "text-green-600"}`}>
                  Comidas Disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isLowStock ? "text-orange-800" : "text-green-800"}`}>
                  {inventory.comidasDisponibles}
                </div>
                <p className={`text-xs mt-1 ${isLowStock ? "text-orange-600" : "text-green-600"}`}>
                  {percentageAvailable.toFixed(1)}% disponible
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progreso de entregas</span>
              <span className="font-medium">
                {inventory.comidasConsumidas} / {inventory.totalComidas}
              </span>
            </div>
            <Progress value={percentageUsed} className="h-3" />
          </div>

          {isLowStock && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ¡Advertencia! El inventario está bajo ({percentageAvailable.toFixed(1)}% disponible). Considera
                reabastecer pronto.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsUpdateDialogOpen(true)} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Actualizar Total
            </Button>
            <Button onClick={() => setIsResetDialogOpen(true)} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reiniciar Inventario
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Última actualización: {new Date(inventory.fechaActualizacion).toLocaleString("es-CO")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Inventario por Mesa
              </CardTitle>
              <CardDescription>Gestiona el inventario de comidas asignado a cada mesa</CardDescription>
            </div>
            <Button onClick={() => setIsAddTableDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Mesa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tableInventories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Utensils className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay mesas configuradas aún</p>
              <p className="text-sm">Haz clic en "Nueva Mesa" para comenzar</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-600">Total por Mesas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-800">{totalTableMeals}</div>
                    <p className="text-xs text-purple-600 mt-1">comidas asignadas</p>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-600">Consumidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-800">{totalTableConsumed}</div>
                    <p className="text-xs text-red-600 mt-1">comidas entregadas</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">Disponibles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-800">{totalTableAvailable}</div>
                    <p className="text-xs text-green-600 mt-1">comidas restantes</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {tableInventories.map((table) => {
                  const tablePercentage = (table.comidasDisponibles / table.totalComidas) * 100
                  const isTableLow = tablePercentage < 20

                  return (
                    <Card
                      key={table.id}
                      className={`${isTableLow && table.activa ? "border-orange-300 bg-orange-50" : ""}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Mesa {table.numeroMesa}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(table)}
                              disabled={updating}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTable(table)}
                              disabled={updating}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-sm">{table.nombreMesa}</CardDescription>
                        <Badge variant={table.activa ? "default" : "secondary"} className="w-fit mt-2">
                          {table.activa ? "Activa" : "Inactiva"}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-lg font-bold text-blue-600">{table.totalComidas}</div>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-600">{table.comidasConsumidas}</div>
                            <p className="text-xs text-muted-foreground">Usadas</p>
                          </div>
                          <div>
                            <div className={`text-lg font-bold ${isTableLow ? "text-orange-600" : "text-green-600"}`}>
                              {table.comidasDisponibles}
                            </div>
                            <p className="text-xs text-muted-foreground">Quedan</p>
                          </div>
                        </div>

                        <Progress value={tablePercentage} className="h-2" />

                        <Button
                          onClick={() => {
                            setSelectedTable(table.numeroMesa)
                            setIsAddMealsDialogOpen(true)
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar Comidas
                        </Button>

                        {isTableLow && table.activa && (
                          <Alert className="py-2">
                            <AlertTriangle className="h-3 w-3" />
                            <AlertDescription className="text-xs">Stock bajo</AlertDescription>
                          </Alert>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Total de Comidas</DialogTitle>
            <DialogDescription>
              Modifica la cantidad total de comidas disponibles. Las comidas ya consumidas (
              {inventory.comidasConsumidas}) se mantendrán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newTotal">Nueva cantidad total</Label>
              <Input
                id="newTotal"
                type="number"
                placeholder={`Actual: ${inventory.totalComidas}`}
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                min={inventory.comidasConsumidas}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo permitido: {inventory.comidasConsumidas} (comidas ya consumidas)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)} disabled={updating}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTotal} disabled={updating}>
              {updating ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar Inventario</DialogTitle>
            <DialogDescription>
              Esto reiniciará el contador de comidas consumidas a 0 y establecerá un nuevo total. ¡Esta acción no se
              puede deshacer!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} disabled={updating}>
              Cancelar
            </Button>
            <Button onClick={handleResetInventory} disabled={updating} variant="destructive">
              {updating ? "Reiniciando..." : "Reiniciar Inventario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTableDialogOpen} onOpenChange={setIsAddTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Mesa</DialogTitle>
            <DialogDescription>
              Asigna comidas a una mesa específica para un mejor control del inventario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Número de Mesa (1-10)</Label>
              <Input
                id="tableNumber"
                type="number"
                placeholder="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min={1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableName">Nombre de la Mesa</Label>
              <Input
                id="tableName"
                type="text"
                placeholder="ej: Bufete Principal, Mesa Norte"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableMeals">Cantidad de Comidas</Label>
              <Input
                id="tableMeals"
                type="number"
                placeholder="240"
                value={tableMeals}
                onChange={(e) => setTableMeals(e.target.value)}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTableDialogOpen(false)} disabled={updating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTable} disabled={updating}>
              {updating ? "Configurando..." : "Configurar Mesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditTableDialogOpen} onOpenChange={setIsEditTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mesa {editingTable?.numeroMesa}</DialogTitle>
            <DialogDescription>Modifica la configuración de la mesa seleccionada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editTableName">Nombre de la Mesa</Label>
              <Input
                id="editTableName"
                type="text"
                placeholder="ej: Bufete Principal"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTableMeals">Total de Comidas</Label>
              <Input
                id="editTableMeals"
                type="number"
                placeholder="240"
                value={tableMeals}
                onChange={(e) => setTableMeals(e.target.value)}
                min={editingTable?.comidasConsumidas || 0}
              />
              {editingTable && (
                <p className="text-xs text-muted-foreground">
                  Comidas ya consumidas: {editingTable.comidasConsumidas}. Disponibles después del cambio:{" "}
                  {Math.max(0, Number.parseInt(tableMeals || "0") - editingTable.comidasConsumidas)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTableDialogOpen(false)} disabled={updating}>
              Cancelar
            </Button>
            <Button onClick={handleEditTable} disabled={updating}>
              {updating ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMealsDialogOpen} onOpenChange={setIsAddMealsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Comidas a Mesa {selectedTable}</DialogTitle>
            <DialogDescription>Incrementa el inventario de comidas disponibles en esta mesa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mealsToAdd">Cantidad a Agregar</Label>
              <Input
                id="mealsToAdd"
                type="number"
                placeholder="240"
                value={mealsToAdd}
                onChange={(e) => setMealsToAdd(e.target.value)}
                min={1}
              />
              <p className="text-xs text-muted-foreground">Esta cantidad se sumará al inventario actual de la mesa</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMealsDialogOpen(false)
                setSelectedTable(null)
                setMealsToAdd("")
              }}
              disabled={updating}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddMealsToTable} disabled={updating}>
              {updating ? "Agregando..." : "Agregar Comidas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
