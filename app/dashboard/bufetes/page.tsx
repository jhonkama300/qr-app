"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Utensils, Users, Activity, Scale, Package, AlertTriangle, TrendingDown, UserPlus } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { MealInventory, TableMealInventory } from "@/lib/firestore-service"

interface MesaStats {
  numero: number
  activa: boolean
  estudiantesAtendidos: number
  ultimoAcceso?: string
}

export default function BufetesPage() {
  const { user, activeRole } = useAuth()
  const [mesas, setMesas] = useState<MesaStats[]>([])
  const [tableMealInventories, setTableMealInventories] = useState<TableMealInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [totalComidasPorEntregar, setTotalComidasPorEntregar] = useState(0)
  const [comidasEstudiantes, setComidasEstudiantes] = useState(0)
  const [comidasInvitados, setComidasInvitados] = useState(0)
  const [mealInventory, setMealInventory] = useState<MealInventory | null>(null)

  useEffect(() => {
    const tablesRef = collection(db, "table_meal_inventory")
    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const tables: TableMealInventory[] = []
      snapshot.forEach((doc) => {
        tables.push({ id: doc.id, ...doc.data() } as TableMealInventory)
      })
      setTableMealInventories(tables.sort((a, b) => a.numeroMesa - b.numeroMesa))
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (tableMealInventories.length === 0) {
      setMesas([])
      setLoading(false)
      return
    }

    const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

    const unsubscribe = onSnapshot(accessLogsQuery, (snapshot) => {
      const mesasStats: MesaStats[] = []

      tableMealInventories.forEach((tableInventory) => {
        const mesaLogs = snapshot.docs.filter((doc) => {
          const data = doc.data()
          return data.mesaUsada === tableInventory.numeroMesa
        })

        const estudiantesAtendidos = mesaLogs.length
        const ultimoAcceso = mesaLogs.length > 0 ? mesaLogs[mesaLogs.length - 1].data().timestamp : undefined

        mesasStats.push({
          numero: tableInventory.numeroMesa,
          activa: tableInventory.activa,
          estudiantesAtendidos,
          ultimoAcceso,
        })
      })

      setMesas(mesasStats)
      setLoading(false)
    })

    return unsubscribe
  }, [tableMealInventories])

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

      setComidasEstudiantes(totalBufetes)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const invitadosQuery = query(collection(db, "invitados"))
    const unsubscribe = onSnapshot(invitadosQuery, (snapshot) => {
      let totalInvitados = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        const cuposConsumidos = data.cuposConsumidos || 0
        const cuposDisponibles = Math.max(0, 1 - cuposConsumidos)
        totalInvitados += cuposDisponibles
      })

      setComidasInvitados(totalInvitados)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    setTotalComidasPorEntregar(comidasEstudiantes + comidasInvitados)
  }, [comidasEstudiantes, comidasInvitados])

  useEffect(() => {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribe = onSnapshot(inventoryRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setMealInventory(docSnapshot.data() as MealInventory)
      }
    })

    return unsubscribe
  }, [])

  const totalEstudiantes = mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)
  const mesasActivas = mesas.filter((mesa) => mesa.activa).length

  const inventoryPercentage = mealInventory
    ? (mealInventory.comidasDisponibles / mealInventory.totalComidas) * 100
    : 100
  const isLowInventory = inventoryPercentage < 20

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
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Mesas</h1>
          <p className="text-muted-foreground">Monitorea el estado y estadísticas de las mesas en tiempo real</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Rol: {activeRole}
        </Badge>
      </div>

      {isLowInventory && mealInventory && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ¡Advertencia! El inventario de comidas está bajo ({inventoryPercentage.toFixed(1)}% disponible). Solo quedan{" "}
            {mealInventory.comidasDisponibles} de {mealInventory.totalComidas} comidas.
          </AlertDescription>
        </Alert>
      )}

      {mealInventory && (
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Package className="h-5 w-5" />
              Inventario Global de Comidas
            </CardTitle>
            <CardDescription className="text-orange-700">
              Control centralizado del stock de comidas disponibles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white/50 rounded-lg">
                <div className="text-2xl font-bold text-orange-900">{mealInventory.totalComidas}</div>
                <p className="text-xs text-orange-700">Total Asignado</p>
              </div>
              <div className="text-center p-3 bg-white/50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{mealInventory.comidasConsumidas}</div>
                <p className="text-xs text-red-600">Ya Entregadas</p>
              </div>
              <div className="text-center p-3 bg-white/50 rounded-lg">
                <div className={`text-2xl font-bold ${isLowInventory ? "text-red-700" : "text-green-700"}`}>
                  {mealInventory.comidasDisponibles}
                </div>
                <p className={`text-xs ${isLowInventory ? "text-red-600" : "text-green-600"}`}>Disponibles</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-800">Progreso de entregas</span>
                <span className="font-medium text-orange-900">
                  {mealInventory.comidasConsumidas} / {mealInventory.totalComidas}
                </span>
              </div>
              <Progress value={(mealInventory.comidasConsumidas / mealInventory.totalComidas) * 100} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de platos Entregados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes atendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mesasActivas}/{tableMealInventories.length}
            </div>
            <p className="text-xs text-muted-foreground">Mesas habilitadas</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Inventario Total Asignado</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{mealInventory ? mealInventory.totalComidas : 0}</div>
            <p className="text-xs text-blue-600">Comidas en sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platos por Entregar</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalComidasPorEntregar}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{comidasEstudiantes}</span>
              </div>
              <span className="text-muted-foreground">+</span>
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <UserPlus className="h-3 w-3" />
                <span>{comidasInvitados}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estudiantes + Invitados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Estado de Inventario por Mesa
          </CardTitle>
          <CardDescription>Visualiza el inventario disponible en cada mesa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {tableMealInventories.map((table) => {
              const percentage = (table.comidasDisponibles / table.totalComidas) * 100
              const isLow = percentage < 20

              return (
                <Card
                  key={table.id}
                  className={`${isLow && table.activa ? "border-orange-300 bg-orange-50" : ""} ${
                    !table.activa ? "opacity-50" : ""
                  }`}
                >
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Mesa {table.numeroMesa}</CardTitle>
                      <Badge variant={table.activa ? "default" : "secondary"} className="text-xs">
                        {table.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{table.nombreMesa}</p>
                  </CardHeader>
                  <CardContent className="pt-0 p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div>
                        <div className="text-sm font-bold text-blue-600">{table.totalComidas}</div>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-red-600">{table.comidasConsumidas}</div>
                        <p className="text-xs text-muted-foreground">Usadas</p>
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${isLow ? "text-orange-600" : "text-green-600"}`}>
                          {table.comidasDisponibles}
                        </div>
                        <p className="text-xs text-muted-foreground">Quedan</p>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                    {isLow && table.activa && <p className="text-xs text-orange-600">⚠️ Stock bajo</p>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado de las Mesas en Tiempo Real</CardTitle>
          <CardDescription>
            Visualiza el estado actual de cada mesa y cuántos estudiantes han sido atendidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Utensils className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay mesas configuradas</p>
              <p className="text-sm">Agrega mesas en la sección de Inventario de Comidas</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {mesas.map((mesa) => (
                <Card
                  key={mesa.numero}
                  className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
                >
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Mesa {mesa.numero}</CardTitle>
                      <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs">
                        {mesa.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Comidas:</span>
                      <span className="text-lg font-bold text-primary">{mesa.estudiantesAtendidos}</span>
                    </div>
                    {mesa.activa && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-green-700">En servicio</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Mesas Operativas</h3>
              <p className="text-sm text-muted-foreground">
                Actualmente hay <span className="font-bold text-primary">{mesasActivas}</span> mesas activas de un total
                de {tableMealInventories.length} configuradas.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Actualización en Tiempo Real</h3>
              <p className="text-sm text-muted-foreground">
                Los contadores se actualizan automáticamente cuando se registra un nuevo acceso en cualquier mesa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
