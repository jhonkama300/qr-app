"use client"

import { Home, Scan, DoorOpen, Database, Users, Table, Utensils, Package, Eye, ChevronDown, LayoutDashboard } from "lucide-react"
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
  consultorOnly?: boolean
  adminOrOperativo?: boolean
  iconColor?: string
}

const tabs: NavTab[] = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Inicio", adminOnly: true, iconColor: "text-uparsistem-600" },
  { path: "/dashboard/escanear", icon: Scan, label: "Escanear", iconColor: "text-blue-500" },
  { path: "/dashboard/inventario", icon: Package, label: "Inventario", adminOnly: true, iconColor: "text-orange-500" },
  { path: "/dashboard/control-acceso", icon: DoorOpen, label: "Control", adminOrOperativo: true, iconColor: "text-amber-500" },
  { path: "/dashboard/base-datos", icon: Database, label: "Datos", adminOnly: true, iconColor: "text-indigo-500" },
  { path: "/dashboard/usuarios", icon: Users, label: "Usuarios", adminOnly: true, iconColor: "text-pink-500" },
  { path: "/dashboard/bufetes", icon: Utensils, label: "Bufetes", bufeteOnly: true, iconColor: "text-emerald-500" },
  { path: "/dashboard/control-bufetes", icon: Table, label: "Bufetes", adminOnly: true, iconColor: "text-violet-500" },
  { path: "/dashboard/bufetes", icon: Eye, label: "Mesas", operativoOnly: true, iconColor: "text-cyan-500" },
  { path: "/dashboard/consultas", icon: Eye, label: "Consultas", consultorOnly: true, iconColor: "text-purple-500" },
]

const PRIMARY_COUNT = 4

export function MobileBottomNav() {
  const { activeRole, isAdmin, isBufete, isConsultor } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  const isOperativo = activeRole === "operativo"

  const navigate = useCallback((path: string) => {
    router.push(path)
    setExpanded(false)
  }, [router])

  const visibleTabs = tabs.filter((t) => {
    if (isConsultor) return !!t.consultorOnly
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
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ease-out ${
          expanded
            ? "bg-black/40 backdrop-blur-sm opacity-100"
            : "bg-black/40 backdrop-blur-sm opacity-0 pointer-events-none"
        }`}
        onClick={() => setExpanded(false)}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className={`
          transition-[border-radius,box-shadow,background-color] duration-300 ease-out
          ${expanded
            ? "bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.1)] rounded-t-2xl"
            : "bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] border-t border-gray-100"
          }`}>
          {/* Primary tabs */}
          <div className="flex items-center justify-around px-2 py-1.5">
            {primaryTabs.map((tab) => {
              const isActive = pathname === tab.path
              const Icon = tab.icon
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-0 flex-1 rounded-xl transition-all duration-200 ${
                    isActive ? "bg-uparsistem-50" : ""
                  }`}
                >
                  {isActive && (
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-uparsistem-500" />
                  )}
                  <div className={`flex items-center justify-center size-7 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-uparsistem-500 shadow-sm shadow-uparsistem-500/30"
                      : ""
                  }`}>
                    <Icon className={`size-4 transition-colors duration-200 ${
                      isActive ? "text-white" : tab.iconColor || "text-gray-400"
                    }`} />
                  </div>
                  <span className={`text-[10px] font-medium leading-tight transition-colors duration-200 ${
                    isActive ? "text-uparsistem-700" : "text-gray-400"
                  }`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}

            {overflowTabs.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-0 flex-1 rounded-xl transition-all duration-200"
              >
                <div className={`flex items-center justify-center size-7 rounded-lg transition-all duration-200 ${
                  expanded ? "bg-gray-100" : ""
                }`}>
                  <ChevronDown className={`size-4 text-gray-400 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                </div>
                <span className={`text-[10px] font-medium leading-tight transition-colors duration-200 ${
                  expanded ? "text-uparsistem-700" : "text-gray-400"
                }`}>
                  Más
                </span>
              </button>
            )}
          </div>

          {/* Overflow tabs */}
          {overflowTabs.length > 0 && (
            <div
              className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
                expanded ? "max-h-40" : "max-h-0"
              }`}
            >
              <div className={`transition-all duration-300 ease-out ${
                expanded ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}>
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-around">
                    {overflowTabs.map((tab) => {
                      const isActive = pathname === tab.path
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.path}
                          onClick={() => navigate(tab.path)}
                          className={`relative flex flex-col items-center gap-1 py-2 px-3 min-w-0 flex-1 rounded-xl transition-all duration-200 ${
                            isActive ? "bg-uparsistem-50" : ""
                          }`}
                        >
                          <div className={`flex items-center justify-center size-8 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-uparsistem-500 shadow-sm shadow-uparsistem-500/30"
                              : "bg-gray-50"
                          }`}>
                            <Icon className={`size-4 transition-colors duration-200 ${
                              isActive ? "text-white" : tab.iconColor || "text-gray-400"
                            }`} />
                          </div>
                          <span className={`text-[11px] font-medium leading-tight transition-colors duration-200 ${
                            isActive ? "text-uparsistem-700 font-semibold" : "text-gray-400"
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

        {/* Safe area spacer for notched phones */}
        <div className="h-[env(safe-area-inset-bottom)] bg-white" />
      </nav>
    </>
  )
}