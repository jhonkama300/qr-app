"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@/lib/auth-service"

interface AuthContextType {
  user: User | null
  activeRole: "administrador" | "operativo" | "bufete" | null
  availableRoles: ("administrador" | "operativo" | "bufete")[]
  userRole: "administrador" | "operativo" | "bufete" | null // Deprecated: use activeRole instead
  mesaAsignada: number | null
  fullName: string | null
  isAdmin: boolean
  isBufete: boolean
  loading: boolean
  login: (user: User) => void
  logout: () => void
  switchRole: (role: "administrador" | "operativo" | "bufete") => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  activeRole: null,
  availableRoles: [],
  userRole: null,
  mesaAsignada: null,
  fullName: null,
  isAdmin: false,
  isBufete: false,
  loading: true,
  login: () => {},
  logout: () => {},
  switchRole: () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [activeRole, setActiveRole] = useState<"administrador" | "operativo" | "bufete" | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser")
    const savedActiveRole = localStorage.getItem("activeRole")

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)

        // Set active role from localStorage or default to first available role
        if (savedActiveRole && userData.roles?.includes(savedActiveRole)) {
          setActiveRole(savedActiveRole)
        } else if (userData.roles && userData.roles.length > 0) {
          setActiveRole(userData.roles[0])
          localStorage.setItem("activeRole", userData.roles[0])
        }
      } catch (error) {
        console.error("Error al cargar sesión guardada:", error)
        localStorage.removeItem("currentUser")
        localStorage.removeItem("activeRole")
      }
    }
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem("currentUser", JSON.stringify(userData))

    // Set default active role to first available role
    if (userData.roles && userData.roles.length > 0) {
      const defaultRole = userData.roles[0]
      setActiveRole(defaultRole)
      localStorage.setItem("activeRole", defaultRole)
    }
  }

  const logout = () => {
    setUser(null)
    setActiveRole(null)
    localStorage.removeItem("currentUser")
    localStorage.removeItem("activeRole")
  }

  const switchRole = (role: "administrador" | "operativo" | "bufete") => {
    if (user?.roles?.includes(role)) {
      setActiveRole(role)
      localStorage.setItem("activeRole", role)
      // React will automatically re-render all components that use the context
    } else {
      console.error("Usuario no tiene acceso a este rol:", role)
    }
  }

  const availableRoles = user?.roles || []
  const mesaAsignada = user?.mesaAsignada || null
  const fullName = user?.fullName || null
  const isAdmin = activeRole === "administrador"
  const isBufete = activeRole === "bufete"

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        availableRoles,
        userRole: activeRole, // For backward compatibility
        mesaAsignada,
        fullName,
        isAdmin,
        isBufete,
        loading,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
