"use client"

import { Home, Scan, Shield, Database, Users, LogOut, User, Table, Utensils, ChevronLeft, DoorOpen, Package, Eye } from "lucide-react"
import { useState, useCallback } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
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
import { useAuth } from "@/components/auth-provider"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { RoleSwitcher } from "@/components/role-switcher"

interface NavItem {
  title: string
  path: string
  icon: React.ElementType
  adminOnly: boolean
  bufeteOnly: boolean
  operativoOnly: boolean
  adminOrOperativo?: boolean
  getDescription?: (role: string) => string
  description?: string
}

const items: NavItem[] = [
  {
    title: "Inicio",
    path: "/dashboard",
    icon: Home,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Escanear",
    path: "/dashboard/escanear",
    icon: Scan,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: false,
    getDescription: (userRole: string) => {
      if (userRole === "bufete") return "Entrega de Comida"
      if (userRole === "operativo") return "Control de Acceso"
      return "Escanear QR"
    },
  },
  {
    title: "Control Acceso",
    path: "/dashboard/control-acceso",
    icon: DoorOpen,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: false,
    adminOrOperativo: true,
  },
  {
    title: "Inventario de Platos",
    path: "/dashboard/inventario",
    icon: Package,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Gestión de Bufetes",
    path: "/dashboard/bufetes",
    icon: Utensils,
    adminOnly: false,
    bufeteOnly: true,
    operativoOnly: false,
  },
  {
    title: "Estado de Mesas",
    path: "/dashboard/bufetes",
    icon: Eye,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: true,
    description: "Vista de solo lectura",
  },
  {
    title: "Control platos",
    path: "/dashboard/control-bufetes",
    icon: Table,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Usuarios",
    path: "/dashboard/usuarios",
    icon: Users,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Base de Datos",
    path: "/dashboard/base-datos",
    icon: Database,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
]

const roleStyles: Record<string, { label: string; gradient: string; badge: string }> = {
  administrador: {
    label: "Admin",
    gradient: "from-rose-500 to-pink-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
  operativo: {
    label: "Operativo",
    gradient: "from-blue-500 to-indigo-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  bufete: {
    label: "Bufete",
    gradient: "from-emerald-500 to-green-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
}

export function AppSidebar() {
  const { user, activeRole, isAdmin, isBufete, logout, fullName } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { toggleSidebar, state, setOpenMobile, isMobile } = useSidebar()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isCollapsed = state === "collapsed"

  const handleLogout = () => {
    if (isMobile) setOpenMobile(false)
    setTimeout(() => setShowLogoutConfirm(true), 300)
  }

  const confirmLogout = () => {
    logout()
    router.push("/")
    setShowLogoutConfirm(false)
  }

  const navigate = useCallback((path: string) => {
    router.push(path)
    if (isMobile) setOpenMobile(false)
  }, [router, isMobile, setOpenMobile])

  const isOperativo = activeRole === "operativo"
  const roleInfo = roleStyles[activeRole || ""] || roleStyles.operativo

  const visibleItems = items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.bufeteOnly && !isBufete) return false
    if (item.operativoOnly && !isOperativo) return false
    if (item.adminOrOperativo && !isAdmin && !isOperativo) return false
    return true
  })

  return (
    <>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="relative p-3 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${roleInfo.gradient} shadow-md`}>
              <User className="size-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold truncate text-sidebar-foreground">Uparsistem</p>
              <p className="text-[11px] truncate text-sidebar-foreground/60">Control de Acceso</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleInfo.badge} shrink-0 group-data-[collapsible=icon]:hidden`}>
              {roleInfo.label}
            </span>
          </div>
          <div className="mt-2 px-1 group-data-[collapsible=icon]:hidden">
            <RoleSwitcher />
          </div>
          <button
            onClick={toggleSidebar}
            className="
              absolute -right-3 top-5 z-20
              flex size-6 items-center justify-center
              rounded-full border border-sidebar-border bg-sidebar
              text-sidebar-foreground/50 hover:text-sidebar-foreground hover:border-sidebar-foreground/30
              shadow-sm hover:shadow-md
              transition-all duration-200
              group-data-[collapsible=icon]:rotate-180
              group-data-[collapsible=icon]:-right-3 group-data-[collapsible=icon]:top-5
            "
            aria-label={isCollapsed ? "Expandir sidebar" : "Contraer sidebar"}
          >
            <ChevronLeft className="size-3.5 transition-transform duration-200" />
          </button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="px-1.5 space-y-0.5 group-data-[collapsible=icon]:px-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.path
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={isActive}
                        onClick={() => navigate(item.path)}
                        className="relative h-11 px-3 rounded-lg cursor-pointer group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-11"
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                        )}
                        <div className={`flex items-center justify-center size-7 rounded-md shrink-0 ${
                          isActive ? "bg-sidebar-primary/15" : "bg-sidebar-primary/5"
                        }`}>
                          <item.icon className={`size-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"}`} />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                          <span className="text-sm leading-tight">{item.title}</span>
                          {item.path === "/dashboard/escanear" && item.getDescription && (
                            <span className="text-[10px] text-sidebar-foreground/50 leading-tight mt-px">
                              {item.getDescription(activeRole || "")}
                            </span>
                          )}
                          {item.description && (
                            <span className="text-[10px] text-sidebar-foreground/50 leading-tight mt-px">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-sidebar-border/50 group-data-[collapsible=icon]:p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/5 group-hover:bg-red-100 dark:group-hover:bg-red-950/50 transition-colors">
              <LogOut className="size-4" />
            </div>
            <div className="flex-1 text-left min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium truncate">{fullName || user?.idNumber || "Usuario"}</p>
              <p className="text-[10px] truncate text-sidebar-foreground/40">
                {user?.idNumber || ""} · {roleInfo.label}
              </p>
            </div>
          </button>
        </SidebarFooter>

      </Sidebar>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
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
    </>
  )
}
