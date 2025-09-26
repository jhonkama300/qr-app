"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@/lib/auth-service"

interface AuthContextType {
  user: User | null
  userRole: "administrador" | "operativo" | "bufete" | null
  isAdmin: boolean
  isBufete: boolean
  loading: boolean
  login: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  isAdmin: false,
  isBufete: false,
  loading: true,
  login: () => {},
  logout: () => {},
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser")
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
      } catch (error) {
        console.error("Error al cargar sesión guardada:", error)
        localStorage.removeItem("currentUser")
      }
    }
    setLoading(false)
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem("currentUser", JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
  }

  const userRole = user?.role || null
  const isAdmin = userRole === "administrador"
  const isBufete = userRole === "bufete"

  return (
    <AuthContext.Provider value={{ user, userRole, isAdmin, isBufete, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
