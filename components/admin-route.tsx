"use client"

import type React from "react"

import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/dashboard")
    }
  }, [user, isAdmin, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder a esta sección. Solo los administradores pueden ver este contenido.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
