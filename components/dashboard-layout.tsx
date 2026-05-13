"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
import { LogOut, Home, Scan, DoorOpen, Table, Utensils, Users, Database, Eye, Package } from "lucide-react"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

const viewConfig: Record<string, { icon: React.ElementType; title: string }> = {
  "/dashboard": { icon: Home, title: "Inicio" },
  "/dashboard/escanear": { icon: Scan, title: "Escanear" },
  "/dashboard/control-acceso": { icon: DoorOpen, title: "Control de Acceso" },
  "/dashboard/inventario": { icon: Package, title: "Inventario de Comidas" },
  "/dashboard/bufetes": { icon: Utensils, title: "Gestión de Bufetes" },
  "/dashboard/control-bufetes": { icon: Table, title: "Control de Mesas" },
  "/dashboard/usuarios": { icon: Users, title: "Usuarios" },
  "/dashboard/base-datos": { icon: Database, title: "Base de Datos" },
  "/dashboard/mesas-bufete": { icon: Utensils, title: "Mesas Bufete" },
}

const roleGradients: Record<string, string> = {
  administrador: "from-rose-500 to-pink-600",
  operativo: "from-blue-500 to-indigo-600",
  bufete: "from-emerald-500 to-green-600",
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading, userRole, fullName, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading, router])

  const currentView = viewConfig[pathname] || viewConfig["/dashboard"]
  const gradient = roleGradients[userRole || ""] || "from-gray-500 to-gray-600"
  const Icon = currentView.icon

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center border-b px-4 md:px-6">
          {isMobile ? (
            <>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm shrink-0`}>
                  <Icon className="size-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-foreground truncate">{currentView.title}</h1>
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
                  <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="gap-2 text-red-600 focus:text-red-600 mt-1">
                    <LogOut className="size-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm shrink-0`}>
                <Icon className="size-4 text-white" />
              </div>
              <h1 className="text-base font-semibold text-foreground">{currentView.title}</h1>
            </div>
          )}
        </header>
        <div className={isMobile ? "pb-16" : ""}>
          {children}
        </div>
      </SidebarInset>
      {isMobile && <MobileBottomNav />}
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
            <AlertDialogAction onClick={() => { logout(); router.push("/"); setShowLogoutModal(false) }} className="bg-red-600 hover:bg-red-700 text-white">
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
