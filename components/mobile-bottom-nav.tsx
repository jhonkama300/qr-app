"use client"

import { Home, Scan, DoorOpen, Database, Users, Table, Utensils, Package, Eye, ChevronDown } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { useCallback, useState } from "react"

interface NavTab {
  path: string
  icon: React.ElementType
  label: string
  adminOnly?: boolean
  bufeteOnly?: boolean
  operativoOnly?: boolean
  adminOrOperativo?: boolean
}

const tabs: NavTab[] = [
  { path: "/dashboard", icon: Home, label: "Inicio", adminOnly: true },
  { path: "/dashboard/escanear", icon: Scan, label: "Escanear" },
  { path: "/dashboard/inventario", icon: Package, label: "Inventario", adminOnly: true },
  { path: "/dashboard/control-acceso", icon: DoorOpen, label: "Control", adminOrOperativo: true },
  { path: "/dashboard/base-datos", icon: Database, label: "Datos", adminOnly: true },
  { path: "/dashboard/usuarios", icon: Users, label: "Usuarios", adminOnly: true },
  { path: "/dashboard/bufetes", icon: Utensils, label: "Bufetes", bufeteOnly: true },
  { path: "/dashboard/control-bufetes", icon: Table, label: "Bufetes", adminOnly: true },
]

const roleIndicator: Record<string, string> = {
  administrador: "bg-green-600",
  operativo: "bg-blue-500",
  bufete: "bg-emerald-500",
}

const PRIMARY_COUNT = 4

export function MobileBottomNav() {
  const { activeRole, isAdmin, isBufete } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  const isOperativo = activeRole === "operativo"

  const navigate = useCallback((path: string) => {
    router.push(path)
    setExpanded(false)
  }, [router])

  const visibleTabs = tabs.filter((t) => {
    if (t.adminOnly && !isAdmin) return false
    if (t.bufeteOnly && !isBufete) return false
    if (t.operativoOnly && !isOperativo) return false
    if (t.adminOrOperativo && !isAdmin && !isOperativo) return false
    return true
  })

  const primaryTabs = visibleTabs.slice(0, PRIMARY_COUNT)
  const overflowTabs = visibleTabs.slice(PRIMARY_COUNT)

  return (
    <>
      {/* Dark overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ease-out will-change-opacity ${
          expanded
            ? "bg-black/60 backdrop-blur-sm opacity-100"
            : "bg-black/60 backdrop-blur-sm opacity-0 pointer-events-none"
        }`}
        onClick={() => setExpanded(false)}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className={`
          border-t border-gray-200 dark:border-gray-800
          transition-[border-radius,box-shadow,background-color] duration-300 ease-out will-change-[border-radius,box-shadow]
          ${expanded
            ? "bg-white dark:bg-gray-950 shadow-[0_-8px_30px_rgba(0,0,0,0.2)] rounded-t-2xl"
            : "bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          }`}>
          {/* First row - primary tabs */}
          <div className="flex items-center justify-around px-2 py-1">
            {primaryTabs.map((tab) => {
              const isActive = pathname === tab.path
              const Icon = tab.icon
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
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

            {overflowTabs.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-0 flex-1"
              >
                <div className="flex items-center justify-center size-6 rounded-lg text-muted-foreground/60">
                  <ChevronDown className={`size-5 transition-transform duration-300 ease-out will-change-transform ${expanded ? "rotate-180" : ""}`} />
                </div>
                <span className="text-[10px] font-medium leading-tight text-muted-foreground/50">Más</span>
              </button>
            )}
          </div>

          {/* Second row - overflow tabs */}
          {overflowTabs.length > 0 && (
            <div
              className={`overflow-hidden transition-[max-height] duration-300 ease-out will-change-[max-height] ${
                expanded ? "max-h-40" : "max-h-0"
              }`}
            >
              <div className={`transition-all duration-300 ease-out will-change-transform ${
                expanded ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}>
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
                  <div className="flex items-center justify-around">
                    {overflowTabs.map((tab) => {
                      const isActive = pathname === tab.path
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.path}
                          onClick={() => navigate(tab.path)}
                          className="relative flex flex-col items-center gap-1 py-2 px-3 min-w-0 flex-1"
                        >
                          {isActive && (
                            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${roleIndicator[activeRole || ""] || "bg-primary"}`} />
                          )}
                          <div className={`flex items-center justify-center size-7 rounded-xl transition-colors duration-150 ${
                            isActive
                              ? "text-foreground bg-primary/10"
                              : "text-muted-foreground/70"
                          }`}>
                            <Icon className="size-5" />
                          </div>
                          <span className={`text-[11px] font-medium leading-tight transition-colors duration-150 ${
                            isActive ? "text-foreground font-semibold" : "text-muted-foreground/60"
                          }`}>
                            {tab.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
