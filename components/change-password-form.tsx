"use client"

import type React from "react"

import { useState } from "react"
import { changePassword } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Lock, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setLoading(false)
      return
    }

    if (newPassword === "Uparsistem123") {
      setError("No puedes usar la contraseña predeterminada del sistema")
      setLoading(false)
      return
    }

    try {
      if (user) {
        await changePassword(user.id, newPassword)
        alert("Contraseña cambiada exitosamente. Debes iniciar sesión nuevamente.")
        logout()
        router.push("/")
      }
    } catch (error: any) {
      console.error("Error al cambiar contraseña:", error)
      setError("Error al cambiar la contraseña. Intenta nuevamente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <Card className="w-full border-0 shadow-lg sm:border sm:shadow-md">
          <CardHeader className="space-y-2 px-4 pt-6 pb-4 sm:px-6 sm:pt-6 sm:pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-center text-red-600">
              Cambio de Contraseña Requerido
            </CardTitle>
            <CardDescription className="text-center text-sm sm:text-base px-2">
              Debes cambiar tu contraseña predeterminada antes de continuar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-4 sm:px-6">
              {error && (
                <Alert variant="destructive" className="text-sm">
                  <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  Nueva Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar Nueva Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-base sm:text-sm"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
                <AlertDescription className="text-xs sm:text-sm">
                  <strong>Requisitos:</strong>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>Mínimo 6 caracteres</li>
                    <li>No puede ser la contraseña predeterminada</li>
                    <li>Debe ser diferente a tu contraseña actual</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardContent className="px-4 pb-6 sm:px-6 sm:pb-6">
              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cambiando contraseña...
                  </>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
