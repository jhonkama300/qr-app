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
  const { user, loading, userRole, isAdmin, isBufete, mesaAsignada } = useAuth()
  const router = useRouter()
  const [currentView, setCurrentView] = useState<ViewType>(initialView)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

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
        return "Control de Bufetes (Admin)"
      case "usuarios":
        return "Usuarios"
      case "base-datos":
        return "Base de Datos"
      default:
        return "Dashboard"
    }
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case "inicio":
        if (!isAdmin) {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
              </div>
            </div>
          )
        }
        return <DashboardStats />
      case "escanear":
        if (userRole === "bufete") {
          return <BuffeteScanner />
        } else if (userRole === "operativo") {
          return <OperativoScanner />
        } else if (userRole === "administrador") {
          // Administradores pueden usar cualquier escáner, por defecto el general
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <BarcodeScanner />
            </div>
          )
        } else {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
              <BarcodeScanner />
            </div>
          )
        }
      case "control-acceso":
        if (!isAdmin && userRole !== "operativo") {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-4">
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
          return <DashboardStats />
        }
        return (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="aspect-video rounded-xl bg-muted/50 p-4">
                <h3 className="font-semibold mb-2">Bufete Asignado</h3>
                <div className="text-2xl font-bold text-primary">Bufete {mesaAsignada || "No asignado"}</div>
              </div>
              <div className="aspect-video rounded-xl bg-muted/50 p-4">
                <h3 className="font-semibold mb-2">Estado</h3>
                <div className="text-lg font-medium text-green-600">Activo</div>
              </div>
              <div className="aspect-video rounded-xl bg-muted/50 p-4">
                <h3 className="font-semibold mb-2">Estudiantes Atendidos</h3>
                <div className="text-2xl font-bold">0</div>
              </div>
            </div>
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
          return <DashboardStats />
        }
        return <MesaControlAdmin />
      case "usuarios":
        if (!isAdmin) {
          setCurrentView("inicio")
          return <DashboardStats />
        }
        return <UserManagement />
      case "base-datos":
        if (!isAdmin) {
          setCurrentView("inicio")
          return <DashboardStats />
        }
        return <DatabaseManagement />
      default:
        return <DashboardStats />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
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
                    setCurrentView("inicio")
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
        <div className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4 mobile-optimized">{renderCurrentView()}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
