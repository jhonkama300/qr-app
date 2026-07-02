"use client"

import { useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { LogOut, Home, Scan, DoorOpen, Table, Utensils, Users, Database, Package, Shield, Check, Scale, Eye } from "lucide-react"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
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
  "/dashboard/consultas": { icon: Eye, title: "Consultas" },
  "/dashboard/mesas-bufete": { icon: Utensils, title: "Mesas Bufete" },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, fullName, logout, activeRole, availableRoles, switchRole } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading, router])

  useEffect(() => {
    if (!loading && activeRole === "consultor" && pathname !== "/dashboard/consultas") {
      router.push("/dashboard/consultas")
    }
  }, [loading, activeRole, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/20">
        <div className="text-center">
          <div className="relative mx-auto w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-2 border-t-uparsistem-500 animate-spin" />
          </div>
          <p className="mt-3 text-sm text-gray-400 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const currentView = viewConfig[pathname] || viewConfig["/dashboard"]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center border-b border-gray-100 bg-white/80 backdrop-blur-sm px-4 md:px-6">
          {isMobile ? (
            <>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 shadow-sm shadow-uparsistem-500/20 shrink-0">
                  <img src="/logo.webp" alt="Uparsistem" className="h-6 w-auto brightness-0 invert" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-gray-900 truncate">{currentView.title}</h1>
                  <p className="text-[10px] text-gray-400 font-medium">Uparsistem</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                  activeRole === "administrador"
                    ? "bg-uparsistem-50 text-uparsistem-700 border-uparsistem-200"
                    : activeRole === "bufete"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : activeRole === "consultor"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {activeRole === "administrador" ? "Admin" : activeRole === "bufete" ? "Bufete" : activeRole === "consultor" ? "Consultor" : "Operativo"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 text-white text-xs font-bold shadow-sm shadow-uparsistem-500/20 shrink-0">
                      {(fullName || user?.idNumber || "U")[0].toUpperCase()}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-3 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold truncate text-gray-900">{fullName || "Usuario"}</p>
                      <p className="text-xs text-gray-400">ID: {user?.idNumber || ""}</p>
                    </div>
                    {availableRoles.length > 1 && (
                      <>
                        <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cambiar Rol</div>
                        {availableRoles.map((role) => {
                          const isActive = role === activeRole
                          const RoleIcon = role === "administrador" ? Shield : role === "bufete" ? Scale : role === "consultor" ? Eye : Users
                          const roleGrad = role === "administrador" ? "from-uparsistem-500 to-uparsistem-600" : role === "bufete" ? "from-emerald-500 to-green-600" : role === "consultor" ? "from-purple-500 to-purple-600" : "from-blue-500 to-indigo-600"
                          return (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => switchRole(role)}
                              disabled={isActive}
                              className="gap-2.5 py-2 cursor-pointer rounded-lg"
                            >
                              <div className={`flex size-6 items-center justify-center rounded-lg bg-gradient-to-br ${roleGrad} text-white shrink-0 shadow-sm`}>
                                <RoleIcon className="size-3" />
                              </div>
                              <span className="flex-1 capitalize text-sm">{role}</span>
                              {isActive && <Check className="size-3.5 text-uparsistem-600" />}
                            </DropdownMenuItem>
                          )
                        })}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="gap-2.5 text-red-600 focus:text-red-600 rounded-lg mt-1">
                      <LogOut className="size-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 shadow-sm shadow-uparsistem-500/20 shrink-0">
                <img src="/logo.webp" alt="Uparsistem" className="h-6 w-auto brightness-0 invert" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-gray-900 truncate">{currentView.title}</h1>
                <p className="text-[10px] text-gray-400 font-medium">Uparsistem · Control de Acceso</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-gray-50 transition-colors shrink-0">
                    <span className="text-sm text-gray-500 font-medium hidden lg:block">{fullName || ""}</span>
                    <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 text-white text-xs font-bold shadow-sm shadow-uparsistem-500/20 shrink-0">
                      {(fullName || user?.idNumber || "U")[0].toUpperCase()}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold truncate text-gray-900">{fullName || "Usuario"}</p>
                    <p className="text-xs text-gray-400">ID: {user?.idNumber || ""}</p>
                  </div>
                  {availableRoles.length > 1 && (
                    <>
                      <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cambiar Rol</div>
                      {availableRoles.map((role) => {
                        const isActive = role === activeRole
                        const RoleIcon = role === "administrador" ? Shield : role === "bufete" ? Scale : Users
                        const roleGrad = role === "administrador" ? "from-uparsistem-500 to-uparsistem-600" : role === "bufete" ? "from-emerald-500 to-green-600" : "from-blue-500 to-indigo-600"
                        return (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => switchRole(role)}
                            disabled={isActive}
                            className="gap-2.5 py-2 cursor-pointer rounded-lg"
                          >
                            <div className={`flex size-6 items-center justify-center rounded-lg bg-gradient-to-br ${roleGrad} text-white shrink-0 shadow-sm`}>
                              <RoleIcon className="size-3" />
                            </div>
                            <span className="flex-1 capitalize text-sm">{role}</span>
                            {isActive && <Check className="size-3.5 text-uparsistem-600" />}
                          </DropdownMenuItem>
                        )
                      })}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowLogoutModal(true)} className="gap-2.5 text-red-600 focus:text-red-600 rounded-lg mt-1">
                    <LogOut className="size-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
        <div className={isMobile ? "pb-16" : ""}>
          {children}
        </div>
      </SidebarInset>
      {isMobile && <MobileBottomNav />}
      <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { logout(); router.push("/"); setShowLogoutModal(false) }} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}