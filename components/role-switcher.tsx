"use client"

import { useAuth } from "@/components/auth-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Shield, Users, Scale, ChevronDown, Check } from "lucide-react"

const roleConfig: Record<string, { icon: React.ElementType; label: string; gradient: string }> = {
  administrador: { icon: Shield, label: "Administrador", gradient: "from-rose-500 to-pink-600" },
  operativo: { icon: Users, label: "Operativo", gradient: "from-blue-500 to-indigo-600" },
  bufete: { icon: Scale, label: "Bufete", gradient: "from-emerald-500 to-green-600" },
}

export function RoleSwitcher() {
  const { activeRole, availableRoles, switchRole } = useAuth()

  if (availableRoles.length <= 1) return null

  const current = roleConfig[activeRole || ""]
  const Icon = current?.icon || Users

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-150 group">
          <div className={`flex size-6 items-center justify-center rounded-md bg-gradient-to-br ${current?.gradient || "from-gray-500 to-gray-600"} text-white`}>
            <Icon className="size-3" />
          </div>
          <span className="flex-1 text-left text-xs font-medium">{current?.label || activeRole}</span>
          <ChevronDown className="size-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cambiar Rol</div>
        <DropdownMenuSeparator />
        {availableRoles.map((role) => {
          const cfg = roleConfig[role]
          const RoleIcon = cfg?.icon || Users
          const isActive = role === activeRole
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => switchRole(role)}
              disabled={isActive}
              className="gap-2.5 py-2 cursor-pointer"
            >
              <div className={`flex size-6 items-center justify-center rounded-md bg-gradient-to-br ${cfg?.gradient || "from-gray-500 to-gray-600"} text-white shrink-0`}>
                <RoleIcon className="size-3" />
              </div>
              <span className="flex-1 text-sm">{cfg?.label || role}</span>
              {isActive && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
