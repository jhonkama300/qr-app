"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { DashboardStats } from "@/components/dashboard-stats"

export function SPADashboard() {
  const { user, loading, isAdmin, activeRole } = useAuth()
  const router = useRouter()
  const prevRoleRef = useRef(activeRole)

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/dashboard/escanear")
    }
  }, [loading, isAdmin, router])

  useEffect(() => {
    if (loading) return
    const prevRole = prevRoleRef.current
    if (prevRole && prevRole !== activeRole) {
      if (activeRole === "administrador") {
        router.replace("/dashboard")
      } else if (activeRole === "operativo" || activeRole === "bufete") {
        router.replace("/dashboard/escanear")
      }
    }
    prevRoleRef.current = activeRole
  }, [activeRole, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="relative mx-auto w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-2 border-t-uparsistem-500 animate-spin" />
          </div>
          <p className="mt-3 text-sm text-gray-400 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <DashboardStats currentUserRole={user?.roles?.[0]} userName={user?.fullName || user?.idNumber || ""} />
}