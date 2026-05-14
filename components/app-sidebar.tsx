"use client"

import { Home, Scan, Shield, Database, Users, LogOut, User, Table, Utensils, ChevronLeft, DoorOpen, Package, Eye, LayoutDashboard } from "lucide-react"
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
  iconColor?: string
}

const items: NavItem[] = [
  {
    title: "Inicio",
    path: "/dashboard",
    icon: LayoutDashboard,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-uparsistem-600",
  },
  {
    title: "Escanear",
    path: "/dashboard/escanear",
    icon: Scan,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-blue-500",
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
    iconColor: "text-amber-500",
  },
  {
    title: "Inventario de Platos",
    path: "/dashboard/inventario",
    icon: Package,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-orange-500",
  },
  {
    title: "Gestión de Bufetes",
    path: "/dashboard/bufetes",
    icon: Utensils,
    adminOnly: false,
    bufeteOnly: true,
    operativoOnly: false,
    iconColor: "text-emerald-500",
  },
  {
    title: "Estado de Mesas",
    path: "/dashboard/bufetes",
    icon: Eye,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: true,
    iconColor: "text-cyan-500",
    description: "Vista de solo lectura",
  },
  {
    title: "Control platos",
    path: "/dashboard/control-bufetes",
    icon: Table,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-violet-500",
  },
  {
    title: "Usuarios",
    path: "/dashboard/usuarios",
    icon: Users,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-pink-500",
  },
  {
    title: "Base de Datos",
    path: "/dashboard/base-datos",
    icon: Database,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
    iconColor: "text-indigo-500",
  },
]

const roleStyles: Record<string, { label: string; bg: string; text: string; border: string; gradient: string }> = {
  administrador: {
    label: "Admin",
    bg: "bg-uparsistem-50",
    text: "text-uparsistem-700",
    border: "border-uparsistem-200",
    gradient: "from-uparsistem-500 to-uparsistem-600",
  },
  operativo: {
    label: "Operativo",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    gradient: "from-blue-500 to-indigo-600",
  },
  bufete: {
    label: "Bufete",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-green-600",
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
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 shadow-sm shadow-uparsistem-500/20 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:rounded-lg">
              <img src="/logo.webp" alt="Uparsistem" className="h-7 w-auto group-data-[collapsible=icon]:h-5 brightness-0 invert" />
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-bold text-sidebar-foreground tracking-tight">Uparsistem</p>
              <p className="text-[10px] text-sidebar-foreground/50 font-medium">Control de Acceso</p>
            </div>
          </div>
          <div className="mt-2.5 px-1 group-data-[collapsible=icon]:hidden">
            <RoleSwitcher />
          </div>

          <button
            onClick={toggleSidebar}
            className="
              absolute -right-3 top-5 z-20
              flex size-6 items-center justify-center
              rounded-full border border-sidebar-border/80 bg-sidebar text-sidebar-foreground/40
              hover:text-sidebar-foreground hover:border-sidebar-foreground/20 hover:bg-sidebar-accent
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

        <SidebarContent className="px-1">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {visibleItems.map((item, index) => {
                  const isActive = pathname === item.path && (item.path !== "/dashboard/bufetes" || !item.description)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={isActive}
                        onClick={() => navigate(item.path)}
                        tooltip={item.title}
                        className="relative h-11 px-3 rounded-xl cursor-pointer transition-all duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:rounded-lg"
                      >
                        {isActive && (
                          <>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-uparsistem-500 group-data-[collapsible=icon]:hidden" />
                            <div className="absolute inset-0 rounded-xl bg-uparsistem-500/[0.06] group-data-[collapsible=icon]:rounded-lg" />
                          </>
                        )}
                        <div className={`relative flex items-center justify-center size-8 rounded-lg shrink-0 transition-all duration-200 ${
                          isActive
                            ? `bg-gradient-to-br ${roleInfo.gradient} shadow-sm ${item.iconColor ? '' : ''}`
                            : "bg-sidebar-accent/50 group-hover/bg-sidebar-accent"
                        }`}>
                          <item.icon className={`size-4 ${
                            isActive ? "text-white" : item.iconColor || "text-sidebar-foreground/50"
                          } transition-colors duration-200`} />
                        </div>
                        <div className="relative flex flex-col flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                          <span className={`text-sm leading-tight font-medium ${isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/70"}`}>
                            {item.title}
                          </span>
                          {item.path === "/dashboard/escanear" && item.getDescription && (
                            <span className="text-[10px] text-sidebar-foreground/40 leading-tight mt-px">
                              {item.getDescription(activeRole || "")}
                            </span>
                          )}
                          {item.description && (
                            <span className="text-[10px] text-sidebar-foreground/40 leading-tight mt-px">
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

        <SidebarFooter className="p-3 border-t border-sidebar-border/40 group-data-[collapsible=icon]:p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/50 group-hover:bg-red-100 dark:group-hover:bg-red-950/50 transition-all duration-200">
              <LogOut className="size-4" />
            </div>
            <div className="flex-1 text-left min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium truncate">{fullName || user?.idNumber || "Usuario"}</p>
              <p className="text-[10px] truncate text-sidebar-foreground/35">
                {user?.idNumber || ""} · {roleInfo.label}
              </p>
            </div>
          </button>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}