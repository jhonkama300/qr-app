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
import { Loader2, Mail, Lock } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
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
        router.push("/dashboard")
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
    <Card className="w-full border-0 shadow-lg sm:border sm:shadow-md">
      <CardHeader className="space-y-2 px-4 pt-6 pb-4 sm:px-6 sm:pt-6 sm:pb-4">
        <CardTitle className="text-xl sm:text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
        <CardDescription className="text-center text-sm sm:text-base px-2">
          Ingresa tu correo electrónico y contraseña para acceder a tu cuenta
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
            <Label htmlFor="email" className="text-sm font-medium">
              Correo Electrónico
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 text-base sm:text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 text-base sm:text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-4 pb-6 sm:px-6 sm:pb-6">
          <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
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
  )
}
