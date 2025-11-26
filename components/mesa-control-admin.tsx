"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { collection, query, where, doc, onSnapshot, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Utensils, Users, Activity, Package, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TableMealInventory, MealInventory } from "@/lib/firestore-service"

interface MesaStats {
  id: string
  numero: number
  nombre: string
  activa: boolean
  estudiantesAtendidos: number
  totalComidas: number
  comidasDisponibles: number
  comidasConsumidas: number
}

export function MesaControlAdmin() {
  const { user } = useAuth()
  const [mesas, setMesas] = useState<MesaStats[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [totalComidasPorEntregar, setTotalComidasPorEntregar] = useState(0)
  const [mealInventory, setMealInventory] = useState<MealInventory | null>(null)

  useEffect(() => {
    const tablesRef = collection(db, "table_meal_inventory")
    const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

    const unsubscribeTables = onSnapshot(tablesRef, (tablesSnapshot) => {
      const unsubscribeLogs = onSnapshot(accessLogsQuery, (logsSnapshot) => {
        const mesasData: MesaStats[] = []

        tablesSnapshot.forEach((docSnap) => {
          const tableData = docSnap.data() as TableMealInventory

          // Contar estudiantes atendidos por esta mesa
          const atendidos = logsSnapshot.docs.filter((logDoc) => {
            const data = logDoc.data()
            return data.mesaUsada === tableData.numeroMesa
          }).length

          mesasData.push({
            id: docSnap.id,
            numero: tableData.numeroMesa,
            nombre: tableData.nombreMesa,
            activa: tableData.activa,
            estudiantesAtendidos: atendidos,
            totalComidas: tableData.totalComidas,
            comidasDisponibles: tableData.comidasDisponibles,
            comidasConsumidas: tableData.comidasConsumidas,
          })
        })

        mesasData.sort((a, b) => a.numero - b.numero)
        setMesas(mesasData)
        setLoading(false)
      })

      return () => unsubscribeLogs()
    })

    return () => unsubscribeTables()
  }, [])

  // Escuchar inventario global
  useEffect(() => {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribe = onSnapshot(inventoryRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setMealInventory(docSnapshot.data() as MealInventory)
      }
    })

    return () => unsubscribe()
  }, [])

  // Escuchar cupos disponibles de estudiantes
  useEffect(() => {
    const estudiantesQuery = query(collection(db, "personas"))
    const unsubscribe = onSnapshot(estudiantesQuery, (snapshot) => {
      let totalBufetes = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        const cuposTotales = 2 + (data.cuposExtras || 0)
        const cuposConsumidos = data.cuposConsumidos || 0
        const cuposDisponibles = Math.max(0, cuposTotales - cuposConsumidos)
        totalBufetes += cuposDisponibles
      })

      setTotalComidasPorEntregar(totalBufetes)
    })

    return () => unsubscribe()
  }, [])

  const toggleMesaStatus = async (mesaId: string, numeroMesa: number) => {
    try {
      setUpdating(numeroMesa)

      const mesa = mesas.find((m) => m.id === mesaId)
      if (mesa) {
        await updateDoc(doc(db, "table_meal_inventory", mesaId), {
          activa: !mesa.activa,
          fechaActualizacion: new Date().toISOString(),
        })
      }

      setUpdating(null)
    } catch (error) {
      console.error("Error al actualizar mesa:", error)
      setUpdating(null)
    }
  }

  const toggleAllMesas = async (activate: boolean) => {
    try {
      for (const mesa of mesas) {
        await updateDoc(doc(db, "table_meal_inventory", mesa.id), {
          activa: activate,
          fechaActualizacion: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("Error al actualizar todas las mesas:", error)
    }
  }

  // Calcular estadísticas generales
  const totalEstudiantes = mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)
  const mesasActivas = mesas.filter((mesa) => mesa.activa).length
  const totalComidasMesas = mesas.reduce((sum, mesa) => sum + mesa.totalComidas, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">Cargando estadísticas de mesas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Control de Mesas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Administra el estado de las mesas registradas en el inventario de comidas
          </p>
        </div>
        <Badge variant="outline" className="text-xs sm:text-sm w-fit">
          Solo Administradores
        </Badge>
      </header>

      {mesas.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No hay mesas configuradas. Agrega mesas desde la sección de{" "}
            <span className="font-semibold">Inventario de Comidas</span>.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Comidas Entregadas</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{totalEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes atendidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Mesas Activas</CardTitle>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {mesasActivas}/{mesas.length}
            </div>
            <p className="text-xs text-muted-foreground">Mesas habilitadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-blue-700">Inventario Total Asignado</CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-blue-900">{totalComidasMesas}</div>
            <p className="text-xs text-blue-600">Comidas en todas las mesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-sm sm:text-base">Comidas por Entregar</CardTitle>
            <Utensils className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{totalComidasPorEntregar}</div>
            <p className="text-xs text-muted-foreground">Cupos disponibles totales</p>
          </CardContent>
        </Card>
      </section>

      {mesas.length > 0 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Estado de las Mesas</CardTitle>
            <CardDescription className="text-sm">
              Habilita o deshabilita mesas individualmente. Solo las mesas activas pueden atender estudiantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {mesas.map((mesa) => {
                const percentage = mesa.totalComidas > 0 ? (mesa.comidasDisponibles / mesa.totalComidas) * 100 : 0
                const isLow = percentage < 20

                return (
                  <Card
                    key={mesa.id}
                    className={`transition-all ${
                      mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    } ${isLow && mesa.activa ? "ring-2 ring-orange-300" : ""}`}
                  >
                    <CardHeader className="pb-2 p-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm sm:text-base">Mesa {mesa.numero}</CardTitle>
                        <Switch
                          checked={mesa.activa}
                          onCheckedChange={() => toggleMesaStatus(mesa.id, mesa.numero)}
                          disabled={updating === mesa.numero}
                          className="scale-75 sm:scale-90"
                          aria-label={`${mesa.activa ? "Desactivar" : "Activar"} Mesa ${mesa.numero}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{mesa.nombre}</p>
                    </CardHeader>
                    <CardContent className="pt-0 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Estado:</span>
                        <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                          {mesa.activa ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Atendidos:</span>
                        <span className="text-sm font-semibold">{mesa.estudiantesAtendidos}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Disponibles:</span>
                        <span className={`text-sm font-semibold ${isLow ? "text-orange-600" : "text-green-600"}`}>
                          {mesa.comidasDisponibles}
                        </span>
                      </div>
                      {isLow && mesa.activa && <p className="text-xs text-orange-600 font-medium">Stock bajo</p>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {mesas.length > 0 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Acciones Rápidas</CardTitle>
            <CardDescription className="text-sm">Controla todas las mesas de una vez</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                onClick={() => toggleAllMesas(true)}
                variant="default"
                size="sm"
                className="w-full sm:w-auto h-9 text-sm font-medium"
                aria-label="Activar todas las mesas"
              >
                Activar Todas las Mesas
              </Button>
              <Button
                onClick={() => toggleAllMesas(false)}
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto h-9 text-sm font-medium text-white"
                aria-label="Desactivar todas las mesas"
              >
                Desactivar Todas las Mesas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
