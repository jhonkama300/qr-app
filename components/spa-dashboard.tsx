"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { LogOut, Home, Scan, DoorOpen, Table, Utensils, Users, Database, Eye, Package, Activity, AlertTriangle } from "lucide-react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TableMealInventory, MealInventory } from "@/lib/firestore-service"

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
  const { user, loading, userRole, isAdmin, isBufete, mesaAsignada, fullName, logout } = useAuth()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [currentView, setCurrentView] = useState<ViewType>(initialView)
  const [scannerKey, setScannerKey] = useState(0)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

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
    if (!isBufete || !mesaAsignada) return

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
    if (!isBufete || !mesaAsignada) return

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
    if (!isBufete) return

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
    if (!isBufete) return

    const tablesRef = collection(db, "table_meal_inventory")

    const unsubscribe = onSnapshot(tablesRef, (snapshot) => {
      const tables: TableMealInventory[] = []
      let activeCount = 0

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as TableMealInventory
        tables.push({ id: docSnap.id, ...data })
        if (data.activa) activeCount++
      })

      tables.sort((a, b) => a.numeroMesa - b.numeroMesa)
      setMesasEstado(tables)
      setMesasActivas(activeCount)
      setTotalMesas(tables.length)
    })

    return () => unsubscribe()
  }, [isBufete])

  useEffect(() => {
    if (userRole !== "operativo" || currentView !== "estado-mesas") return

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

  if (!user) return null

  const roleStyles: Record<string, string> = {
    administrador: "from-rose-500 to-pink-600",
    operativo: "from-blue-500 to-indigo-600",
    bufete: "from-emerald-500 to-green-600",
  }
  const roleInfo = { gradient: roleStyles[userRole || ""] || "from-gray-500 to-gray-600" }

  const getViewIcon = () => {
    const cls = "size-4 text-white"
    switch (currentView) {
      case "inicio": return <Home className={cls} />
      case "escanear": return <Scan className={cls} />
      case "control-acceso": return <DoorOpen className={cls} />
      case "inventario": return <Package className={cls} />
      case "bufetes-gestion": return <Utensils className={cls} />
      case "control-bufetes": return <Table className={cls} />
      case "estado-mesas": return <Eye className={cls} />
      case "usuarios": return <Users className={cls} />
      case "base-datos": return <Database className={cls} />
      default: return <Home className={cls} />
    }
  }

  const getBreadcrumbTitle = () => {
    switch (currentView) {
      case "inicio": return "Inicio"
      case "escanear":
        if (userRole === "bufete") return `Entrega de Comida - Mesa ${mesaAsignada}`
        if (userRole === "operativo") return "Control de Acceso al Evento"
        return "Escanear QR"
      case "control-acceso": return "Control de Acceso"
      case "inventario": return "Inventario de Comidas"
      case "bufetes-gestion": return `Gestión de Mesas${mesaAsignada ? ` - Mesa ${mesaAsignada}` : ""}`
      case "control-bufetes": return "Control de Mesas (Admin)"
      case "estado-mesas": return "Estado de Mesas (Solo Lectura)"
      case "usuarios": return "Usuarios"
      case "base-datos": return "Base de Datos"
      default: return "Dashboard"
    }
  }

  const handleViewChange = (newView: ViewType) => {
    if (currentView === "escanear" && newView !== "escanear") {
      setScannerKey((prev) => prev + 1)
    }
    setCurrentView(newView)
  }

  const handleLogout = () => setShowLogoutModal(true)

  const confirmLogout = () => {
    logout()
    router.push("/")
    setShowLogoutModal(false)
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
        if (userRole === "bufete") return <BuffeteScanner key={`bufete-${scannerKey}`} />
        if (userRole === "operativo") return <OperativoScanner key={`operativo-${scannerKey}`} />
        return (
          <div className="flex flex-1 flex-col items-center justify-center p-4">
            <BarcodeScanner key={`admin-${scannerKey}`} />
          </div>
        )
      case "control-acceso":
        if (!isAdmin && userRole !== "operativo") {
          return (
            <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground">Solo administradores y operativos pueden acceder a esta sección.</p>
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
                <h3 className="text-xs font-semibold mb-1 text-green-900">Total de platos</h3>
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
                        <Card key={mesa.id} className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"} ${isLow && mesa.activa ? "ring-2 ring-orange-300" : ""}`}>
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
                              <span className={`text-sm font-semibold ${isLow ? "text-orange-600" : "text-green-600"}`}>{mesa.comidasDisponibles}</span>
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
              <Badge variant="outline" className="text-sm">Solo Lectura</Badge>
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
                      <div className="text-xl md:text-2xl font-bold text-orange-900">{operativoMealInventory.totalComidas}</div>
                      <p className="text-xs text-orange-700">Total Asignado</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-lg">
                      <div className="text-xl md:text-2xl font-bold text-red-700">{operativoMealInventory.comidasConsumidas}</div>
                      <p className="text-xs text-red-600">Ya Entregadas</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-lg">
                      <div className={`text-xl md:text-2xl font-bold ${isLowInventory ? "text-red-700" : "text-green-700"}`}>
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
                    <Progress value={(operativoMealInventory.comidasConsumidas / operativoMealInventory.totalComidas) * 100} className="h-3" />
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
                  <div className="text-2xl font-bold">{operativoMesasActivas}/{operativoMesasEstado.length}</div>
                  <p className="text-xs text-muted-foreground">Mesas habilitadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Totales</CardTitle>
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{operativoMesasEstado.reduce((sum, m) => sum + m.totalComidas, 0)}</div>
                  <p className="text-xs text-muted-foreground">En todas las mesas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Entregadas</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{operativoMesasEstado.reduce((sum, m) => sum + m.comidasConsumidas, 0)}</div>
                  <p className="text-xs text-muted-foreground">Total consumidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comidas Disponibles</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{operativoMesasEstado.reduce((sum, m) => sum + m.comidasDisponibles, 0)}</div>
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
                        <Card key={mesa.id} className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"} ${isLow && mesa.activa ? "ring-2 ring-orange-300" : ""}`}>
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
                                <div className={`text-sm font-bold ${isLow ? "text-orange-600" : "text-green-600"}`}>{mesa.comidasDisponibles}</div>
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
        <header className="flex h-14 md:h-16 shrink-0 items-center border-b px-4 md:px-6">
          {isMobile ? (
            <>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${roleInfo.gradient} shadow-sm shrink-0`}>
                  {getViewIcon()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate">{getBreadcrumbTitle()}</h1>
                  <p className="text-[10px] text-muted-foreground/60">Uparsistem · Control de Acceso</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-lime-500 to-green-600 text-white text-xs font-bold shadow-sm shrink-0">
                    {(fullName || user?.idNumber || "U")[0].toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2 border-b">
                    <p className="text-sm font-semibold truncate">{fullName || "Usuario"}</p>
                    <p className="text-xs text-muted-foreground">ID: {user?.idNumber || ""}</p>
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600 mt-1">
                    <LogOut className="size-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${roleInfo.gradient} shadow-sm shrink-0`}>
                {getViewIcon()}
              </div>
              <h1 className="text-base font-semibold text-foreground">{getBreadcrumbTitle()}</h1>
            </div>
          )}
        </header>
        <div className={isMobile ? "pb-16" : ""}>
          {renderCurrentView()}
        </div>
      </SidebarInset>
      {isMobile && (
        <MobileBottomNav currentView={currentView} onViewChange={handleViewChange} />
      )}
      <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700 text-white">
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
