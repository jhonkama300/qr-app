"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Utensils, Eye, Package, Users, Activity } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import type { TableMealInventory, MealInventory } from "@/lib/firestore-service"

// Importar todos los componentes de las vistas
import { DashboardStats } from "@/components/dashboard-stats"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { AccessControl } from "@/components/access-control"
import { UserManagement } from "@/components/user-management"
import { DatabaseManagement } from "@/components/database-management"
import { MesaControlAdmin } from "@/components/mesa-control-admin"
import { BuffeteScanner } from "@/components/bufete-scanner"
import { OperativoScanner } from "@/components/operativo-scanner"
import { MealInventoryManagement } from "@/components/meal-inventory-management"

export type ViewType =
  | "inicio"
  | "escanear"
  | "control-acceso"
  | "inventario"
  | "bufetes-gestion"
  | "control-bufetes"
  | "usuarios"
  | "base-datos"
  | "estado-mesas"

interface SPADashboardProps {
  initialView?: ViewType
}

export function SPADashboard({ initialView = "inicio" }: SPADashboardProps) {
  const { user, loading, userRole, isAdmin, isBufete, mesaAsignada } = useAuth()
  const router = useRouter()
  const [currentView, setCurrentView] = useState<ViewType>(initialView)
  const [scannerKey, setScannerKey] = useState(0)

  const [estudiantesAtendidos, setEstudiantesAtendidos] = useState(0)
  const [mesaActiva, setMesaActiva] = useState(true)
  const [totalComidasEntregadas, setTotalComidasEntregadas] = useState(0)
  const [mesasActivas, setMesasActivas] = useState(0)
  const [totalMesas, setTotalMesas] = useState(0)
  const [mesasEstado, setMesasEstado] = useState<TableMealInventory[]>([])

  const [operativoMesasEstado, setOperativoMesasEstado] = useState<TableMealInventory[]>([])
  const [operativoMealInventory, setOperativoMealInventory] = useState<MealInventory | null>(null)

  useEffect(() => {
    if (!loading && user && userRole === "operativo") {
      setCurrentView("escanear")
    }
  }, [user, loading, userRole])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!isBufete || !mesaAsignada) {
      return
    }

    const logsQuery = query(
      collection(db, "access_logs"),
      where("mesaUsada", "==", mesaAsignada),
      where("status", "==", "granted"),
    )

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const count = snapshot.size
      setEstudiantesAtendidos(count)
    })

    return () => unsubscribe()
  }, [isBufete, mesaAsignada])

  useEffect(() => {
    if (!isBufete || !mesaAsignada) {
      return
    }

    const mesaRef = doc(db, "table_meal_inventory", `mesa_${mesaAsignada}`)

    const unsubscribe = onSnapshot(mesaRef, (snapshot) => {
      if (snapshot.exists()) {
        const mesaData = snapshot.data() as TableMealInventory
        setMesaActiva(mesaData.activa ?? true)
      }
    })

    return () => unsubscribe()
  }, [isBufete, mesaAsignada])

  useEffect(() => {
    if (!isBufete) {
      return
    }

    // Solo contar accesos granted que fueron registrados por rol bufete (entrega de comidas)
    const logsQuery = query(
      collection(db, "access_logs"),
      where("status", "==", "granted"),
      where("grantedByUserRole", "==", "bufete"),
    )

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const count = snapshot.size
      setTotalComidasEntregadas(count)
    })

    return () => unsubscribe()
  }, [isBufete])

  useEffect(() => {
    if (!isBufete) {
      return
    }

    const tablesRef = collection(db, "table_meal_inventory")

    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const tables: TableMealInventory[] = []
      let activeCount = 0

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TableMealInventory
        tables.push({ id: docSnap.id, ...data })
        if (data.activa) {
          activeCount++
        }
      })

      tables.sort((a, b) => a.numeroMesa - b.numeroMesa)
      setMesasEstado(tables)
      setMesasActivas(activeCount)
      setTotalMesas(tables.length)
    })

    return () => unsubscribe()
  }, [isBufete])

  useEffect(() => {
    if (userRole !== "operativo" || currentView !== "estado-mesas") {
      return
    }

    const tablesRef = collection(db, "table_meal_inventory")
    const unsubscribeTables = onSnapshot(tablesRef, (snapshot) => {
      const tables: TableMealInventory[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TableMealInventory
        tables.push({ id: docSnap.id, ...data })
      })
      tables.sort((a, b) => a.numeroMesa - b.numeroMesa)
      setOperativoMesasEstado(tables)
    })

    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribeInventory = onSnapshot(inventoryRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setOperativoMealInventory(docSnapshot.data() as MealInventory)
      }
    })

    return () => {
      unsubscribeTables()
      unsubscribeInventory()
    }
  }, [userRole, currentView])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getBreadcrumbTitle = () => {
    switch (currentView) {
      case "inicio":
        return "Inicio"
      case "escanear":
        if (userRole === "bufete") {
          return `Entrega de Comida - Mesa ${mesaAsignada}`
        } else if (userRole === "operativo") {
          return "Control de Acceso al Evento"
        } else {
          return "Escanear QR"
        }
      case "control-acceso":
        return "Control de Acceso"
      case "inventario":
        return "Inventario de Comidas"
      case "bufetes-gestion":
        return `Gestión de Mesas${mesaAsignada ? ` - Mesa ${mesaAsignada}` : ""}`
      case "control-bufetes":
        return "Control de Mesas (Admin)"
      case "usuarios":
        return "Usuarios"
      case "base-datos":
        return "Base de Datos"
      case "estado-mesas":
        return "Estado de Mesas (Solo Lectura)"
      default:
        return "Dashboard"
    }
  }

  const handleViewChange = (newView: ViewType) => {
    if (currentView === "escanear" && newView !== "escanear") {
      setScannerKey((prev) => prev + 1)
    }

    setCurrentView(newView)
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case "inicio":
        if (!isAdmin) {
          return (
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
              </div>
            </div>
          )
        }
        return <DashboardStats currentUserRole={userRole} />
      case "escanear":
        if (userRole === "bufete") {
          return <BuffeteScanner key={`bufete-${scannerKey}`} />
        } else if (userRole === "operativo") {
          return <OperativoScanner key={`operativo-${scannerKey}`} />
        } else if (userRole === "administrador") {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <BarcodeScanner key={`admin-${scannerKey}`} />
            </div>
          )
        } else {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <BarcodeScanner key={`general-${scannerKey}`} />
            </div>
          )
        }
      case "control-acceso":
        if (!isAdmin && userRole !== "operativo") {
          return (
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground">
                  Solo administradores y operativos pueden acceder a esta sección.
                </p>
              </div>
            </div>
          )
        }
        return <AccessControl />
      case "inventario":
        if (!isAdmin) {
          return (
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground">Solo administradores pueden acceder a esta sección.</p>
              </div>
            </div>
          )
        }
        return (
          <div className="flex-1 space-y-6 p-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>
              <p className="text-muted-foreground">Administra el inventario global de comidas del evento</p>
            </div>
            <MealInventoryManagement />
          </div>
        )
      case "bufetes-gestion":
        if (!isBufete) {
          setCurrentView("inicio")
          return <DashboardStats currentUserRole={userRole} />
        }
        return (
          <div className="flex flex-col gap-3 p-3 md:p-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <h3 className="text-xs font-semibold mb-1 text-muted-foreground">Mesa Asignada</h3>
                <div className="text-xl md:text-2xl font-bold text-primary">Mesa {mesaAsignada || "N/A"}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <h3 className="text-xs font-semibold mb-1 text-muted-foreground">Estado</h3>
                <div className={`text-lg md:text-xl font-bold ${mesaActiva ? "text-green-600" : "text-red-600"}`}>
                  {mesaActiva ? "Activo" : "Inactivo"}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 col-span-2 md:col-span-1">
                <h3 className="text-xs font-semibold mb-1 text-muted-foreground">Graduados Atendidos</h3>
                <div className="text-xl md:text-2xl font-bold">{estudiantesAtendidos}</div>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <h3 className="text-xs font-semibold mb-1 text-blue-900">Mesas Activas</h3>
                <div className="text-lg md:text-xl font-bold text-blue-600">
                  {mesasActivas}/{totalMesas}
                </div>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <h3 className="text-xs font-semibold mb-1 text-green-900">Total Comidas</h3>
                <div className="text-lg md:text-xl font-bold text-green-600">{totalComidasEntregadas}</div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl">Estado de las Mesas</CardTitle>
                <CardDescription className="text-sm">
                  Visualiza el estado de cada mesa registrada en el inventario de comidas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mesasEstado.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No hay mesas configuradas</p>
                    <p className="text-sm">Las mesas se configuran desde el Inventario de Comidas</p>
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    {mesasEstado.map((mesa) => {
                      const percentage = mesa.totalComidas > 0 ? (mesa.comidasDisponibles / mesa.totalComidas) * 100 : 0
                      const isLow = percentage < 20

                      return (
                        <Card
                          key={mesa.id}
                          className={`transition-all ${
                            mesa.activa ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                          } ${isLow && mesa.activa ? "ring-2 ring-orange-300" : ""}`}
                        >
                          <CardHeader className="pb-2 p-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm sm:text-base">Mesa {mesa.numeroMesa}</CardTitle>
                              <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                                {mesa.activa ? "Activa" : "Inactiva"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{mesa.nombreMesa}</p>
                          </CardHeader>
                          <CardContent className="pt-0 p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Disponibles:</span>
                              <span className={`text-sm font-semibold ${isLow ? "text-orange-600" : "text-green-600"}`}>
                                {mesa.comidasDisponibles}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Total:</span>
                              <span className="text-sm font-semibold">{mesa.totalComidas}</span>
                            </div>
                            {isLow && mesa.activa && <p className="text-xs text-orange-600 font-medium">Stock bajo</p>}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 p-4">
              <h3 className="font-semibold mb-4">Instrucciones para Mesa {mesaAsignada}</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>- Solo puedes entregar comida a estudiantes autenticados</p>
                <p>- Cada estudiante tiene 2 cupos predeterminados + cupos extras</p>
                <p>- Al escanear exitosamente, se consume 1 cupo automáticamente</p>
                <p>- No se puede entregar comida a estudiantes ya escaneados</p>
                <p>- Usa la vista "Escanear" para procesar entregas de comida</p>
              </div>
            </div>
          </div>
        )
      case "control-bufetes":
        if (!isAdmin) {
          setCurrentView("inicio")
          return <DashboardStats currentUserRole={userRole} />
        }
        return <MesaControlAdmin />
      case "usuarios":
        if (!isAdmin) {
          setCurrentView("inicio")
          return <DashboardStats currentUserRole={userRole} />
        }
        return <UserManagement />
      case "base-datos":
        if (!isAdmin) {
          setCurrentView("inicio")
          return <DashboardStats currentUserRole={userRole} />
        }
        return <DatabaseManagement />
      case "estado-mesas":
        if (userRole !== "operativo") {
          setCurrentView("escanear")
          return <OperativoScanner key={`operativo-${scannerKey}`} />
        }

        const operativoMesasActivas = operativoMesasEstado.filter((m) => m.activa).length
        const inventoryPercentage = operativoMealInventory
          ? (operativoMealInventory.comidasDisponibles / operativoMealInventory.totalComidas) * 100
          : 100
        const isLowInventory = inventoryPercentage < 20

        return (
          <div className="flex-1 space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Eye className="h-6 w-6 md:h-8 md:w-8" />
                  Estado de Mesas
                </h1>
                <p className="text-muted-foreground">Vista de solo lectura del estado de las mesas del bufete</p>
              </div>
              <Badge variant="outline" className="text-sm">
                Solo Lectura
              </Badge>
            </div>

            {isLowInventory && operativoMealInventory && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Inventario bajo ({inventoryPercentage.toFixed(1)}% disponible). Quedan{" "}
                  {operativoMealInventory.comidasDisponibles} de {operativoMealInventory.totalComidas} comidas.
                </AlertDescription>
              </Alert>
            )}

            {operativoMealInventory && (
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <Package className="h-5 w-5" />
                    Inventario Global de Comidas
                  </CardTitle>
                  <CardDescription className="text-orange-700">Estado actual del stock de comidas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white/50 rounded-lg">
                      <div className="text-xl md:text-2xl font-bold text-orange-900">
                        {operativoMealInventory.totalComidas}
                      </div>
                      <p className="text-xs text-orange-700">Total Asignado</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-lg">
                      <div className="text-xl md:text-2xl font-bold text-red-700">
                        {operativoMealInventory.comidasConsumidas}
                      </div>
                      <p className="text-xs text-red-600">Ya Entregadas</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-lg">
                      <div
                        className={`text-xl md:text-2xl font-bold ${isLowInventory ? "text-red-700" : "text-green-700"}`}
                      >
                        {operativoMealInventory.comidasDisponibles}
                      </div>
                      <p className={`text-xs ${isLowInventory ? "text-red-600" : "text-green-600"}`}>Disponibles</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-800">Progreso de entregas</span>
                      <span className="font-medium text-orange-900">
                        {operativoMealInventory.comidasConsumidas} / {operativoMealInventory.totalComidas}
                      </span>
                    </div>
                    <Progress
                      value={(operativoMealInventory.comidasConsumidas / operativoMealInventory.totalComidas) * 100}
                      className="h-3"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mesas Activas</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {operativoMesasActivas}/{operativoMesasEstado.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Mesas habilitadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Totales</CardTitle>
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {operativoMesasEstado.reduce((sum, m) => sum + m.totalComidas, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">En todas las mesas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Entregadas</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {operativoMesasEstado.reduce((sum, m) => sum + m.comidasConsumidas, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total consumidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Disponibles</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {operativoMesasEstado.reduce((sum, m) => sum + m.comidasDisponibles, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Por entregar</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5" />
                  Estado de las Mesas en Tiempo Real
                </CardTitle>
                <CardDescription>Visualiza el inventario disponible en cada mesa (solo lectura)</CardDescription>
              </CardHeader>
              <CardContent>
                {operativoMesasEstado.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No hay mesas configuradas</p>
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    {operativoMesasEstado.map((mesa) => {
                      const percentage = mesa.totalComidas > 0 ? (mesa.comidasDisponibles / mesa.totalComidas) * 100 : 0
                      const isLow = percentage < 20

                      return (
                        <Card
                          key={mesa.id}
                          className={`transition-all ${
                            mesa.activa ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                          } ${isLow && mesa.activa ? "ring-2 ring-orange-300" : ""}`}
                        >
                          <CardHeader className="pb-2 p-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm sm:text-base">Mesa {mesa.numeroMesa}</CardTitle>
                              <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                                {mesa.activa ? "Activa" : "Inactiva"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{mesa.nombreMesa}</p>
                          </CardHeader>
                          <CardContent className="pt-0 p-3 space-y-2">
                            <div className="grid grid-cols-3 gap-1 text-center">
                              <div>
                                <div className="text-sm font-bold text-blue-600">{mesa.totalComidas}</div>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-red-600">{mesa.comidasConsumidas}</div>
                                <p className="text-xs text-muted-foreground">Usadas</p>
                              </div>
                              <div>
                                <div className={`text-sm font-bold ${isLow ? "text-orange-600" : "text-green-600"}`}>
                                  {mesa.comidasDisponibles}
                                </div>
                                <p className="text-xs text-muted-foreground">Quedan</p>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                            {isLow && mesa.activa && <p className="text-xs text-orange-600 text-center">Stock bajo</p>}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800 text-sm">Información</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700">
                  Esta es una vista de solo lectura. Los datos se actualizan en tiempo real pero no puedes modificar
                  ningún valor. Para realizar cambios, contacta a un administrador.
                </p>
              </CardContent>
            </Card>
          </div>
        )
      default:
        return <DashboardStats currentUserRole={userRole} />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onViewChange={handleViewChange} />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 border-b px-2 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    handleViewChange("inicio")
                  }}
                >
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm md:text-base">{getBreadcrumbTitle()}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {renderCurrentView()}
      </SidebarInset>
    </SidebarProvider>
  )
}
