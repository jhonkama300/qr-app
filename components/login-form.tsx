"use client"

import type React from "react"

import { useState } from "react"
import { validateLogin } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const user = await validateLogin(email, password)

      if (user) {
        login(user)
        console.log("Usuario autenticado:", user)

        if (user.hasDefaultPassword) {
          router.push("/change-password")
        } else {
          router.push("/dashboard")
        }
      } else {
        setError("Correo electrónico o contraseña incorrectos")
      }
    } catch (error: any) {
      console.error("Error de autenticación:", error)
      setError("Error al iniciar sesión. Intenta nuevamente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg sm:border sm:shadow-md bg-white">
        <CardHeader className="space-y-2 px-4 pt-6 pb-4 sm:px-6 sm:pt-6 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl font-bold text-center text-primary">Control de Acceso</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base px-2 text-primary/70">
            Sistema Uparsistem - Ingresa tus credenciales para acceder
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
              <Label htmlFor="email" className="text-sm font-medium text-primary">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10 text-base sm:text-sm border-primary/20 focus:border-primary"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-primary">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-10 text-base sm:text-sm border-primary/20 focus:border-primary"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary/60 hover:text-primary min-h-[40px] min-w-[40px] flex items-center justify-center"
                  disabled={loading}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-4 pb-6 sm:px-6 sm:pb-6">
            <Button
              type="submit"
              className="w-full h-10 text-base font-medium bg-primary hover:bg-primary/90 min-h-[44px]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
