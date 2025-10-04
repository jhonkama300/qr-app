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
import { Loader2, Award as IdCard, Lock, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginForm() {
  const [idNumber, setIdNumber] = useState("")
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
      const user = await validateLogin(idNumber, password)

      if (user) {
        login(user)
        console.log("Usuario autenticado:", user)

        if (user.hasDefaultPassword) {
          router.push("/change-password")
        } else {
          router.push("/dashboard")
        }
      } else {
        setError("Número de identificación o contraseña incorrectos")
      }
    } catch (error: any) {
      console.error("Error de autenticación:", error)
      setError("Error al iniciar sesión. Intenta nuevamente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
        <source src="/videos/background.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/40" />

      <Card className="relative z-10 w-full max-w-[95vw] sm:max-w-md border-0 shadow-2xl sm:border sm:shadow-xl bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-2 sm:space-y-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 text-center">
          <div className="flex justify-center mb-1 sm:mb-2">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 p-2 shadow-lg">
              <Image
                src="/images/logoupar.png"
                alt="Logo Uparsistem"
                width={56}
                height={56}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
          </div>
          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Control de Acceso
          </CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm px-2 text-green-700/80 font-medium">
            Sistema Uparsistem
          </CardDescription>
          <p className="text-[10px] sm:text-xs text-green-600/70">Ingresa tus credenciales para acceder al sistema</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
            {error && (
              <Alert variant="destructive" className="text-sm border-red-200 bg-red-50 py-2">
                <AlertDescription className="text-xs sm:text-sm text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="idNumber" className="text-xs sm:text-sm font-semibold text-green-800">
                Número de Identificación
              </Label>
              <div className="relative">
                <IdCard className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600/60" />
                <Input
                  id="idNumber"
                  type="text"
                  placeholder="1234567890"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="pl-9 sm:pl-10 h-9 sm:h-10 text-sm border-green-200 focus:border-green-500 focus:ring-green-500/20 bg-green-50/50"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-green-800">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 sm:pl-10 pr-9 sm:pr-10 h-9 sm:h-10 text-sm border-green-200 focus:border-green-500 focus:ring-green-500/20 bg-green-50/50"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 text-green-600/60 hover:text-green-600 transition-colors"
                  disabled={loading}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
            <Button
              type="submit"
              className="w-full h-9 sm:h-10 text-sm font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200"
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
