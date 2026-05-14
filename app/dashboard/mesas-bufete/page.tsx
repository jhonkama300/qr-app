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

  if (!loading && !isBufete) {
    redirect("/dashboard")
  }

  useEffect(() => {
    const mesasIniciales: MesaStatus[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      nombre: `Mesa ${i + 1}`,
      estudiantesAtendidos: Math.floor(Math.random() * 50),
      ultimoEscaneo: null,
      activa: true,
    }))
    setMesas(mesasIniciales)
  }, [])

  const toggleMesa = (id: number) => {
    setMesas((prev) => prev.map((mesa) => (mesa.id === id ? { ...mesa, activa: !mesa.activa } : mesa)))
  }

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

  return (
    <div className="space-y-3 md:space-y-6 p-2 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base md:text-2xl font-bold text-gray-900 leading-tight">Gestión de Mesas - Bufete</h1>
          <p className="text-[10px] md:text-sm text-gray-500 leading-tight mt-0.5">Control de las 10 mesas de entrega de comida</p>
        </div>
        <Badge className="text-xs bg-uparsistem-50 text-uparsistem-700 border-uparsistem-200">
          <Utensils className="w-3 h-3 mr-1" />
          Bufete Activo
        </Badge>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
        {mesas.map((mesa) => (
          <Card
            key={mesa.id}
            className={`transition-all duration-200 rounded-2xl ${mesa.activa ? "border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white" : "border-red-200/60 bg-gradient-to-br from-red-50/50 to-white opacity-60"}`}
          >
            <CardHeader className="pb-2 sm:pb-3 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base font-bold text-gray-900">{mesa.nombre}</CardTitle>
                <Badge variant={mesa.activa ? "default" : "destructive"} className="text-[10px] px-2 py-0.5 rounded-full">
                  {mesa.activa ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-400">Mesa de entrega de comida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-3 md:p-4 pt-0 md:pt-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                <span>{mesa.estudiantesAtendidos} estudiantes</span>
              </div>

              {mesa.ultimoEscaneo && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Último: {mesa.ultimoEscaneo}</span>
                </div>
              )}

              <Button
                onClick={() => toggleMesa(mesa.id)}
                variant={mesa.activa ? "destructive" : "default"}
                size="sm"
                className="w-full h-8 sm:h-9 text-xs sm:text-sm font-medium rounded-xl"
                aria-label={`${mesa.activa ? "Desactivar" : "Activar"} ${mesa.nombre}`}
              >
                {mesa.activa ? "Desactivar" : "Activar"} Mesa
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-2xl border-gray-200/60">
        <CardHeader className="p-3 md:p-6 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm md:text-lg font-bold text-gray-900">
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            Resumen del Bufete
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-center">
            <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200/50">
              <div className="text-xl md:text-2xl font-bold text-emerald-600">{mesas.filter((m) => m.activa).length}</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Mesas Activas</div>
            </div>
            <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-200/50">
              <div className="text-xl md:text-2xl font-bold text-blue-600">
                {mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)}
              </div>
              <div className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Total Atendidos</div>
            </div>
            <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200/50">
              <div className="text-xl md:text-2xl font-bold text-amber-600">
                {Math.round(
                  mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0) /
                    mesas.filter((m) => m.activa).length,
                ) || 0}
              </div>
              <div className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Promedio por Mesa</div>
            </div>
            <div className="bg-violet-50/80 rounded-xl p-3 border border-violet-200/50">
              <div className="text-xl md:text-2xl font-bold text-violet-600">10</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Mesas Totales</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}