"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Utensils, Clock, CheckCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { redirect } from "next/navigation"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { updateDoc, doc } from "firebase/firestore"

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
  const [dbLoading, setDbLoading] = useState(true)

  if (!loading && !isBufete) {
    redirect("/dashboard")
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "table_meal_inventory"), (snapshot) => {
      const tables: MesaStatus[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: data.numeroMesa,
          nombre: data.nombreMesa || `Mesa ${data.numeroMesa}`,
          estudiantesAtendidos: data.comidasConsumidas || 0,
          ultimoEscaneo: data.fechaActualizacion || null,
          activa: data.activa !== false,
        }
      })
      tables.sort((a, b) => a.id - b.id)
      setMesas(tables)
      setDbLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const toggleMesa = async (id: number) => {
    const mesa = mesas.find((m) => m.id === id)
    if (!mesa) return
    try {
      await updateDoc(doc(db, "table_meal_inventory", `mesa_${id}`), {
        activa: !mesa.activa,
      })
    } catch (error) {
      console.error("Error al cambiar estado de mesa:", error)
    }
  }

  if (loading || dbLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="relative mx-auto w-10 h-10">
            <Loader2 className="size-10 animate-spin text-uparsistem-500" />
          </div>
          <p className="mt-3 text-sm text-gray-400 font-medium">Cargando mesas...</p>
        </div>
      </div>
    )
  }

  const totalAtendidos = mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)
  const mesasActivas = mesas.filter((m) => m.activa)
  const promedio = mesasActivas.length > 0 ? Math.round(totalAtendidos / mesasActivas.length) : 0

  return (
    <div className="space-y-3 md:space-y-6 p-2 md:p-6">
      {/* Empty state */}
      {mesas.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center">
          <div className="size-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Utensils className="size-8 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No hay mesas configuradas</p>
          <p className="text-xs text-gray-400 mt-1">Ve a Inventario para crear mesas</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
          {mesas.map((mesa) => (
            <Card
              key={mesa.id}
              className={`transition-all duration-200 rounded-xl overflow-hidden border-0 shadow-sm ${
                mesa.activa
                  ? "bg-white ring-1 ring-emerald-100"
                  : "bg-gray-50/80 ring-1 ring-gray-200 opacity-65"
              }`}
            >
              <div className={`h-1.5 ${mesa.activa ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gray-300"}`} />
              <CardHeader className="pb-2 p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm md:text-base font-bold ${mesa.activa ? "text-gray-900" : "text-gray-500"}`}>{mesa.nombre}</CardTitle>
                  <div className={`size-2 rounded-full ${mesa.activa ? "bg-emerald-500" : "bg-gray-400"}`} />
                </div>
                <CardDescription className="text-[10px] md:text-xs text-gray-400 flex items-center gap-1">
                  <Utensils className="size-3" />
                  Entrega de comida
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 md:p-4 pt-0 md:pt-0">
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <div className="size-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Users className="size-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{mesa.estudiantesAtendidos}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Atendidos</p>
                  </div>
                </div>

                {mesa.ultimoEscaneo && (
                  <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-400">
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate">{new Date(mesa.ultimoEscaneo).toLocaleString()}</span>
                  </div>
                )}

                <Button
                  onClick={() => toggleMesa(mesa.id)}
                  variant={mesa.activa ? "outline" : "default"}
                  size="sm"
                  className={`w-full h-8 text-xs font-medium rounded-lg ${
                    mesa.activa
                      ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                  }`}
                >
                  {mesa.activa ? "Desactivar" : "Activar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Summary */}
      {mesas.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-gray-100 overflow-hidden">
          <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3">
            <h2 className="flex items-center gap-2 text-sm md:text-base font-bold text-gray-900">
              <CheckCircle className="size-4 md:size-5 text-emerald-500" />
              Resumen del Bufete
            </h2>
          </div>
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white p-3 md:p-4 ring-1 ring-emerald-100/50">
                <p className="text-2xl md:text-3xl font-black text-emerald-600">{mesasActivas.length}</p>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Mesas Activas</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white p-3 md:p-4 ring-1 ring-blue-100/50">
                <p className="text-2xl md:text-3xl font-black text-blue-600">{totalAtendidos}</p>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Total Atendidos</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white p-3 md:p-4 ring-1 ring-amber-100/50">
                <p className="text-2xl md:text-3xl font-black text-amber-600">{promedio}</p>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Promedio por Mesa</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-violet-50 to-white p-3 md:p-4 ring-1 ring-violet-100/50">
                <p className="text-2xl md:text-3xl font-black text-violet-600">{mesas.length}</p>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Mesas Totales</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}