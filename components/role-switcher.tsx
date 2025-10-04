"use client"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Shield, Users, Scale, ChevronDown, Check } from "lucide-react"

export function RoleSwitcher() {
  const { activeRole, availableRoles, switchRole } = useAuth()

  // Don't show the switcher if user only has one role
  if (availableRoles.length <= 1) {
    return null
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "administrador":
        return <Shield className="h-4 w-4" />
      case "operativo":
        return <Users className="h-4 w-4" />
      case "bufete":
        return <Scale className="h-4 w-4" />
      default:
        return null
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "administrador":
        return "Administrador"
      case "operativo":
        return "Operativo"
      case "bufete":
        return "Bufete"
      default:
        return role
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          {getRoleIcon(activeRole || "")}
          <span>{getRoleLabel(activeRole || "")}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Cambiar Rol</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableRoles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => switchRole(role)}
            className="gap-2 cursor-pointer"
            disabled={role === activeRole}
          >
            <div className="flex items-center gap-2 flex-1">
              {getRoleIcon(role)}
              <span>{getRoleLabel(role)}</span>
            </div>
            {role === activeRole && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
