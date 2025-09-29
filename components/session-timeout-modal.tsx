"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"

interface SessionTimeoutModalProps {
  isOpen: boolean
  onClose: () => void
  onExtendSession: () => void
}

export function SessionTimeoutModal({ isOpen, onClose, onExtendSession }: SessionTimeoutModalProps) {
  const { logout } = useAuth()
  const router = useRouter()
  const [countdown, setCountdown] = useState(60)

  useEffect(() => {
    if (!isOpen) {
      setCountdown(60)
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto logout cuando llega a 0
          logout()
          router.push("/")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, logout, router])

  const handleExtendSession = () => {
    onExtendSession()
    onClose()
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            Sesión por Expirar
          </DialogTitle>
          <DialogDescription>Tu sesión está a punto de expirar por inactividad.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Tu sesión expirará automáticamente en <strong>{countdown} segundos</strong> si no realizas ninguna acción.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground text-center">¿Deseas continuar trabajando o cerrar sesión?</div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleExtendSession} className="flex-1">
            Continuar Sesión
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
