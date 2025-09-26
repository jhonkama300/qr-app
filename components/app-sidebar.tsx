"use client"

import { Home, Scan, Shield, Database, Users, LogOut, User, ChevronUp, Settings, Utensils } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import type { ViewType } from "@/components/spa-dashboard"

interface AppSidebarProps {
  currentView?: ViewType
  onViewChange?: (view: ViewType) => void
}

const items = [
  {
    title: "Inicio",
    view: "inicio" as ViewType,
    icon: Home,
    adminOnly: false,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Escanear",
    view: "escanear" as ViewType,
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
    title: "Control de Acceso",
    view: "control-acceso" as ViewType,
    icon: Shield,
    adminOnly: true, // Solo administradores pueden ver el control general
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Gestión de Mesas",
    view: "mesas-bufete" as ViewType,
    icon: Utensils, // Icono más apropiado para bufete
    adminOnly: false,
    bufeteOnly: true, // Solo para rol bufete
    operativoOnly: false,
  },
  {
    title: "Control de Mesas",
    view: "control-mesas" as ViewType,
    icon: Settings,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Usuarios",
    view: "usuarios" as ViewType,
    icon: Users,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
  {
    title: "Base de Datos",
    view: "base-datos" as ViewType,
    icon: Database,
    adminOnly: true,
    bufeteOnly: false,
    operativoOnly: false,
  },
]

export function AppSidebar({ currentView = "inicio", onViewChange }: AppSidebarProps) {
  const { user, userRole, isAdmin, isBufete, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const handleViewChange = (view: ViewType) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const userName = user?.email?.split("@")[0] || "Usuario"
  const isOperativo = userRole === "operativo"

  const visibleItems = items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.bufeteOnly && !isBufete) return false
    if (item.operativoOnly && !isOperativo) return false
    return true
  })

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <User className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Control de Acceso QR</span>
                <span className="truncate text-xs">
                  {isAdmin
                    ? "Administrador - Control Total"
                    : isBufete
                      ? "Bufete - Entrega de Comida"
                      : isOperativo
                        ? "Operativo - Control de Acceso"
                        : "Dashboard"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    size="lg"
                    className={`h-14 px-4 py-3 border border-sidebar-border rounded-lg transition-all duration-200 shadow-sm cursor-pointer ${
                      currentView === item.view
                        ? "bg-sidebar-accent border-sidebar-accent-foreground/20"
                        : "bg-sidebar-accent/50 hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/20"
                    }`}
                    onClick={() => handleViewChange(item.view)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sidebar-primary/10 relative">
                        <item.icon className="w-5 h-5" />
                        {item.adminOnly && isAdmin && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                        )}
                        {item.bufeteOnly && isBufete && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        {item.operativoOnly && isOperativo && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="font-medium text-base">{item.title}</span>
                        {item.view === "escanear" && item.getDescription && (
                          <span className="text-xs text-muted-foreground">{item.getDescription(userRole || "")}</span>
                        )}
                      </div>
                      {item.adminOnly && isAdmin && (
                        <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Admin</span>
                      )}
                      {item.bufeteOnly && isBufete && (
                        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Bufete
                        </span>
                      )}
                      {item.operativoOnly && isOperativo && (
                        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Operativo
                        </span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <User className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {userName}
                      {isAdmin && " (Admin)"}
                      {isBufete && " (Bufete)"}
                      {isOperativo && " (Operativo)"}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email} • {userRole}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
                    <User className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {userName}
                      {isAdmin && " (Admin)"}
                      {isBufete && " (Bufete)"}
                      {isOperativo && " (Operativo)"}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email} • {userRole}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="gap-2 p-2 text-red-600 focus:text-red-600">
                  <LogOut className="size-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
