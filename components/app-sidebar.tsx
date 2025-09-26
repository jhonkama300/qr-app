"use client"

import { Home, Scan, Shield, Database, Users, LogOut, User, ChevronUp, Scale } from "lucide-react"

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

// Elementos del menú principal
const items = [
  {
    title: "Inicio",
    url: "/dashboard",
    icon: Home,
    adminOnly: false,
    bufeteOnly: false,
  },
  {
    title: "Escanear",
    url: "/dashboard/escanear",
    icon: Scan,
    adminOnly: false,
    bufeteOnly: false,
  },
  {
    title: "Control de Acceso",
    url: "/dashboard/control-acceso",
    icon: Shield,
    adminOnly: false,
    bufeteOnly: false,
  },
  {
    title: "Usuarios",
    url: "/dashboard/usuarios",
    icon: Users,
    adminOnly: true,
    bufeteOnly: false,
  },
  {
    title: "Base de Datos",
    url: "/dashboard/base-datos",
    icon: Database,
    adminOnly: true,
    bufeteOnly: false,
  },
  {
    title: "Gestión Bufetes",
    url: "/dashboard/bufetes",
    icon: Scale,
    adminOnly: false,
    bufeteOnly: true,
  },
]

export function AppSidebar() {
  const { user, userRole, isAdmin, isBufete, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const userName = user?.email?.split("@")[0] || "Usuario"

  const visibleItems = items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.bufeteOnly && !isBufete) return false
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
                <span className="truncate font-semibold">Mi Aplicación</span>
                <span className="truncate text-xs">
                  {isAdmin ? "Administrador" : isBufete ? "Bufete" : "Dashboard"}
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
                    asChild
                    size="lg"
                    className="h-14 px-4 py-3 border border-sidebar-border rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/20 transition-all duration-200 shadow-sm"
                  >
                    <a href={item.url} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sidebar-primary/10">
                        <item.icon className="w-5 h-5" />
                        {item.adminOnly && isAdmin && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                        )}
                        {item.bufeteOnly && isBufete && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                      <span className="font-medium text-base">{item.title}</span>
                      {item.adminOnly && isAdmin && (
                        <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Admin</span>
                      )}
                      {item.bufeteOnly && isBufete && (
                        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Bufete
                        </span>
                      )}
                    </a>
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
