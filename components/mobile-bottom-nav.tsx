"use client"

import { Home, Scan, DoorOpen, Database, Users, Table, Utensils, Package, Eye } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import type { ViewType } from "@/components/spa-dashboard"

interface MobileBottomNavProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

interface NavTab {
  view: ViewType
  icon: React.ElementType
  label: string
  adminOnly?: boolean
  bufeteOnly?: boolean
  operativoOnly?: boolean
  adminOrOperativo?: boolean
}

const tabs: NavTab[] = [
  { view: "inicio", icon: Home, label: "Inicio", adminOnly: true },
  { view: "escanear", icon: Scan, label: "Escanear" },
  { view: "inventario", icon: Package, label: "Inventario", adminOnly: true },
  { view: "control-acceso", icon: DoorOpen, label: "Control", adminOrOperativo: true },
  { view: "bufetes-gestion", icon: Utensils, label: "Bufetes", bufeteOnly: true },
  { view: "control-bufetes", icon: Table, label: "Mesas", adminOnly: true },
  { view: "estado-mesas", icon: Eye, label: "Estado", operativoOnly: true },
  { view: "usuarios", icon: Users, label: "Usuarios", adminOnly: true },
  { view: "base-datos", icon: Database, label: "Datos", adminOnly: true },
]

const roleIndicator: Record<string, string> = {
  administrador: "bg-rose-500",
  operativo: "bg-blue-500",
  bufete: "bg-emerald-500",
}

export function MobileBottomNav({ currentView, onViewChange }: MobileBottomNavProps) {
  const { activeRole, isAdmin, isBufete } = useAuth()
  const isOperativo = activeRole === "operativo"

  const visibleTabs = tabs.filter((t) => {
    if (t.adminOnly && !isAdmin) return false
    if (t.bufeteOnly && !isBufete) return false
    if (t.operativoOnly && !isOperativo) return false
    if (t.adminOrOperativo && !isAdmin && !isOperativo) return false
    return true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-2 py-1">
          {visibleTabs.slice(0, 5).map((tab) => {
            const isActive = currentView === tab.view
            const Icon = tab.icon
            return (
              <button
                key={tab.view}
                onClick={() => onViewChange(tab.view)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-0 flex-1"
              >
                {isActive && (
                  <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${roleIndicator[activeRole || ""] || "bg-primary"}`} />
                )}
                <div className={`flex items-center justify-center size-6 rounded-lg transition-colors duration-150 ${
                  isActive ? "text-foreground" : "text-muted-foreground/60"
                }`}>
                  <Icon className="size-5" />
                </div>
                <span className={`text-[10px] font-medium leading-tight transition-colors duration-150 ${
                  isActive ? "text-foreground" : "text-muted-foreground/50"
                }`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
