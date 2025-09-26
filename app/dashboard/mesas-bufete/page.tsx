"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Utensils, Clock, CheckCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { redirect } from "next/navigation"

interface MesaStatus {
  id: number
  nombre: string
  estudiantesAtendidos: number
  ultimoEscaneo: string | null
  activa: boolean
}

export default function MesasBuffetePage() {
  const { isBufete, loading } = useAuth()
  const [mesas, setMesas] = useState<MesaStatus[]>([])

  // Redirigir si no es bufete
  if (!loading && !isBufete) {
    redirect("/dashboard")
  }

  useEffect(() => {
    // Inicializar las 10 mesas
    const mesasIniciales: MesaStatus[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      nombre: `Mesa ${i + 1}`,
      estudiantesAtendidos: Math.floor(Math.random() * 50), // Datos de ejemplo
      ultimoEscaneo: null,
      activa: true,
    }))
    setMesas(mesasIniciales)
  }, [])

  const toggleMesa = (id: number) => {
    setMesas((prev) => prev.map((mesa) => (mesa.id === id ? { ...mesa, activa: !mesa.activa } : mesa)))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Mesas - Bufete</h1>
          <p className="text-muted-foreground">Control de las 10 mesas de entrega de comida</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Utensils className="w-4 h-4 mr-2" />
          Bufete Activo
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {mesas.map((mesa) => (
          <Card
            key={mesa.id}
            className={`transition-all duration-200 ${mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{mesa.nombre}</CardTitle>
                <Badge variant={mesa.activa ? "default" : "destructive"}>{mesa.activa ? "Activa" : "Inactiva"}</Badge>
              </div>
              <CardDescription className="text-sm">Mesa de entrega de comida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-blue-500" />
                <span>{mesa.estudiantesAtendidos} estudiantes</span>
              </div>

              {mesa.ultimoEscaneo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Último: {mesa.ultimoEscaneo}</span>
                </div>
              )}

              <Button
                onClick={() => toggleMesa(mesa.id)}
                variant={mesa.activa ? "destructive" : "default"}
                size="sm"
                className="w-full"
              >
                {mesa.activa ? "Desactivar" : "Activar"} Mesa
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Resumen del Bufete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{mesas.filter((m) => m.activa).length}</div>
              <div className="text-sm text-muted-foreground">Mesas Activas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Atendidos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(
                  mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0) /
                    mesas.filter((m) => m.activa).length,
                ) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Promedio por Mesa</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">10</div>
              <div className="text-sm text-muted-foreground">Mesas Totales</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
