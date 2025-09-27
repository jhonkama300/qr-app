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
import Image from "next/image"

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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-green-100 to-green-200 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl sm:border sm:shadow-xl bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-4 px-6 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 p-2 shadow-lg">
              <Image
                src="/images/logoupar.png"
                alt="Logo Uparsistem"
                width={64}
                height={64}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Control de Acceso
          </CardTitle>
          <CardDescription className="text-center text-base px-2 text-green-700/80 font-medium">
            Sistema Uparsistem
          </CardDescription>
          <p className="text-sm text-green-600/70">Ingresa tus credenciales para acceder al sistema</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 px-6">
            {error && (
              <Alert variant="destructive" className="text-sm border-red-200 bg-red-50">
                <AlertDescription className="text-sm text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-green-800">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 text-base border-green-200 focus:border-green-500 focus:ring-green-500/20 bg-green-50/50"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-semibold text-green-800">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-12 h-12 text-base border-green-200 focus:border-green-500 focus:ring-green-500/20 bg-green-50/50"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600/60 hover:text-green-600 min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors"
                  disabled={loading}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-6 pb-8">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 min-h-[48px]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
