"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { LogOut, Home, Scan, DoorOpen, Table, Utensils, Users, Database } from "lucide-react"
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
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

// Importar todos los componentes de las vistas
import { DashboardStats } from "@/components/dashboard-stats"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { AccessControl } from "@/components/access-control"
import { UserManagement } from "@/components/user-management"
import { DatabaseManagement } from "@/components/database-management"
import { MesaControlAdmin } from "@/components/mesa-control-admin"
import { BuffeteScanner } from "@/components/bufete-scanner"
import { OperativoScanner } from "@/components/operativo-scanner"

export type ViewType =
  | "inicio"
  | "escanear"
  | "control-acceso"
  | "bufetes-gestion"
  | "control-bufetes"
  | "usuarios"
  | "base-datos"

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
  const [totalMesas] = useState(10)
  const [bufetesEstado, setBuffetesEstado] = useState<
    Array<{
      numero: number
      activa: boolean
      atendidos: number
    }>
  >([])

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

    console.log("[v0] Setting up real-time listener for mesa", mesaAsignada)

    const logsQuery = query(
      collection(db, "access_logs"),
      where("mesaUsada", "==", mesaAsignada),
      where("status", "==", "granted"),
    )

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const count = snapshot.size
      console.log("[v0] Meals delivered count updated:", count)
      setEstudiantesAtendidos(count)
    })

    return () => unsubscribe()
  }, [isBufete, mesaAsignada])

  useEffect(() => {
    if (!isBufete || !mesaAsignada) {
      return
    }

    console.log("[v0] Setting up real-time listener for mesa status", mesaAsignada)

    const mesaConfigQuery = query(collection(db, "mesas_config"), where("numero", "==", mesaAsignada))

    const unsubscribe = onSnapshot(mesaConfigQuery, (snapshot) => {
      if (!snapshot.empty) {
        const mesaData = snapshot.docs[0].data()
        const isActive = mesaData.activa ?? true
        console.log("[v0] Mesa active status updated:", isActive)
        setMesaActiva(isActive)
      }
    })

    return () => unsubscribe()
  }, [isBufete, mesaAsignada])

  useEffect(() => {
    if (!isBufete) {
      return
    }

    console.log("[v0] Setting up real-time listener for total meals delivered")

    const logsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const count = snapshot.size
      console.log("[v0] Total meals delivered count updated:", count)
      setTotalComidasEntregadas(count)
    })

    return () => unsubscribe()
  }, [isBufete])

  useEffect(() => {
    if (!isBufete) {
      return
    }

    console.log("[v0] Setting up real-time listener for active mesas")

    const mesasConfigQuery = query(collection(db, "mesas_config"))

    const unsubscribe = onSnapshot(mesasConfigQuery, (snapshot) => {
      const activeMesas = snapshot.docs.filter((doc) => {
        const data = doc.data()
        return data.activa === true
      }).length
      console.log("[v0] Active mesas count updated:", activeMesas)
      setMesasActivas(activeMesas)
    })

    return () => unsubscribe()
  }, [isBufete])

  useEffect(() => {
    if (!isBufete) {
      return
    }

    console.log("[v0] Setting up real-time listener for all bufetes status")

    const mesasConfigQuery = query(collection(db, "mesas_config"))
    const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

    // Listener para configuración de mesas
    const unsubscribeMesas = onSnapshot(mesasConfigQuery, (mesasSnapshot) => {
      // Listener para logs de acceso
      const unsubscribeLogs = onSnapshot(accessLogsQuery, (logsSnapshot) => {
        const bufetesData: Array<{
          numero: number
          activa: boolean
          atendidos: number
        }> = []

        // Procesar cada bufete del 1 al 10
        for (let i = 1; i <= 10; i++) {
          // Buscar configuración del bufete
          const mesaDoc = mesasSnapshot.docs.find((doc) => doc.data().numero === i)
          const activa = mesaDoc?.data().activa ?? true

          // Contar estudiantes atendidos por este bufete
          const atendidos = logsSnapshot.docs.filter((doc) => {
            const data = doc.data()
            return data.mesaUsada === i
          }).length

          bufetesData.push({
            numero: i,
            activa,
            atendidos,
          })
        }

        console.log("[v0] Bufetes status updated:", bufetesData)
        setBuffetesEstado(bufetesData)
      })

      return () => unsubscribeLogs()
    })

    return () => unsubscribeMesas()
  }, [isBufete])

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

  const roleStyles: Record<string, string> = {
    administrador: "from-rose-500 to-pink-600",
    operativo: "from-blue-500 to-indigo-600",
    bufete: "from-emerald-500 to-green-600",
  }
  const roleInfo = { gradient: roleStyles[userRole || ""] || "from-gray-500 to-gray-600" }

  const getViewIcon = () => {
    const className = "size-4 text-white"
    switch (currentView) {
      case "inicio": return <Home className={className} />
      case "escanear": return <Scan className={className} />
      case "control-acceso": return <DoorOpen className={className} />
      case "bufetes-gestion": return <Utensils className={className} />
      case "control-bufetes": return <Table className={className} />
      case "usuarios": return <Users className={className} />
      case "base-datos": return <Database className={className} />
      default: return <Home className={className} />
    }
  }

  const getBreadcrumbTitle = () => {
    switch (currentView) {
      case "inicio":
        return "Inicio"
      case "escanear":
        if (userRole === "bufete") {
          return `Entrega de Comida - Bufete ${mesaAsignada}`
        } else if (userRole === "operativo") {
          return "Control de Acceso al Evento"
        } else {
          return "Escanear QR"
        }
      case "control-acceso":
        return "Control de Acceso"
      case "bufetes-gestion":
        return `Gestión de Bufetes${mesaAsignada ? ` - Bufete ${mesaAsignada}` : ""}`
      case "control-bufetes":
        return "Control de Bufetes"
      case "usuarios":
        return "Usuarios"
      case "base-datos":
        return "Base de Datos"
      default:
        return "Dashboard"
    }
  }

  const handleViewChange = (newView: ViewType) => {
    console.log("[v0] Changing view from", currentView, "to", newView)

    if (currentView === "escanear" && newView !== "escanear") {
      console.log("[v0] Leaving scanner view, forcing unmount")
      setScannerKey((prev) => prev + 1)
    }

    setCurrentView(newView)
  }

  const handleLogout = () => {
    setShowLogoutModal(true)
  }

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
      case "bufetes-gestion":
        if (!isBufete) {
          setCurrentView("inicio")
          return <DashboardStats currentUserRole={userRole} />
        }
        return (
          <div className="flex flex-col gap-3 p-3 md:p-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <h3 className="text-xs font-semibold mb-1 text-muted-foreground">Bufete Asignado</h3>
                <div className="text-xl md:text-2xl font-bold text-primary">Bufete {mesaAsignada || "N/A"}</div>
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
                <h3 className="text-xs font-semibold mb-1 text-blue-900">Bufetes Activos</h3>
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
                <CardTitle className="text-lg sm:text-xl">Estado de los Bufetes</CardTitle>
                <CardDescription className="text-sm">
                  Habilita o deshabilita bufetes individualmente. Solo los bufetes activos pueden atender estudiantes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {bufetesEstado.map((bufete) => (
                    <Card
                      key={bufete.numero}
                      className={`transition-all ${
                        bufete.activa ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <CardHeader className="pb-2 p-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm sm:text-base">Bufete {bufete.numero}</CardTitle>
                          <Switch
                            checked={bufete.activa}
                            disabled={true}
                            className="scale-75 sm:scale-90"
                            aria-label={`Estado Bufete ${bufete.numero}`}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Estado:</span>
                          <Badge variant={bufete.activa ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                            {bufete.activa ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Atendidos:</span>
                          <span className="text-sm font-semibold">{bufete.atendidos}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 p-4">
              <h3 className="font-semibold mb-4">Instrucciones para Bufete {mesaAsignada}</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Solo puedes entregar comida a estudiantes autenticados</p>
                <p>• Cada estudiante tiene 2 cupos predeterminados + cupos extras</p>
                <p>• Al escanear exitosamente, se consume 1 cupo automáticamente</p>
                <p>• No se puede entregar comida a estudiantes ya escaneados</p>
                <p>• Usa la vista "Escanear" para procesar entregas de comida</p>
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
      default:
        return <DashboardStats currentUserRole={userRole} />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onViewChange={handleViewChange} />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center border-b px-4 md:px-6">
          {/* Mobile: icon + view name + avatar */}
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
            /* PC: just the view title, clean */
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
