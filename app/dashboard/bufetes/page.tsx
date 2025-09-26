"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Scale, FileText, Calendar, Users, Plus, Search, Filter } from "lucide-react"
import { useState } from "react"

interface Caso {
  id: string
  numero: string
  cliente: string
  tipo: string
  estado: "activo" | "pendiente" | "cerrado"
  fechaInicio: string
  fechaVencimiento?: string
  descripcion: string
  prioridad: "alta" | "media" | "baja"
}

interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string
  empresa?: string
  fechaRegistro: string
  casosActivos: number
}

export default function BufetesPage() {
  const [activeTab, setActiveTab] = useState("casos")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("todos")

  // Datos de ejemplo
  const casos: Caso[] = [
    {
      id: "1",
      numero: "CASO-2024-001",
      cliente: "Empresa ABC S.A.",
      tipo: "Laboral",
      estado: "activo",
      fechaInicio: "2024-01-15",
      fechaVencimiento: "2024-03-15",
      descripcion: "Demanda por despido injustificado",
      prioridad: "alta",
    },
    {
      id: "2",
      numero: "CASO-2024-002",
      cliente: "Juan Pérez",
      tipo: "Civil",
      estado: "pendiente",
      fechaInicio: "2024-02-01",
      descripcion: "Reclamación de daños y perjuicios",
      prioridad: "media",
    },
    {
      id: "3",
      numero: "CASO-2024-003",
      cliente: "María González",
      tipo: "Familiar",
      estado: "cerrado",
      fechaInicio: "2023-12-10",
      descripcion: "Proceso de divorcio",
      prioridad: "baja",
    },
  ]

  const clientes: Cliente[] = [
    {
      id: "1",
      nombre: "Empresa ABC S.A.",
      email: "contacto@empresaabc.com",
      telefono: "+34 123 456 789",
      empresa: "Empresa ABC S.A.",
      fechaRegistro: "2023-06-15",
      casosActivos: 2,
    },
    {
      id: "2",
      nombre: "Juan Pérez",
      email: "juan.perez@email.com",
      telefono: "+34 987 654 321",
      fechaRegistro: "2024-01-20",
      casosActivos: 1,
    },
    {
      id: "3",
      nombre: "María González",
      email: "maria.gonzalez@email.com",
      telefono: "+34 555 123 456",
      fechaRegistro: "2023-12-01",
      casosActivos: 0,
    },
  ]

  const getEstadoBadge = (estado: string) => {
    const variants = {
      activo: "bg-green-100 text-green-800",
      pendiente: "bg-yellow-100 text-yellow-800",
      cerrado: "bg-gray-100 text-gray-800",
    }
    return variants[estado as keyof typeof variants] || variants.pendiente
  }

  const getPrioridadBadge = (prioridad: string) => {
    const variants = {
      alta: "bg-red-100 text-red-800",
      media: "bg-orange-100 text-orange-800",
      baja: "bg-blue-100 text-blue-800",
    }
    return variants[prioridad as keyof typeof variants] || variants.media
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Bufetes</h1>
          <p className="text-muted-foreground">Administra casos legales, clientes y documentos de tu bufete</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Caso
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Activos</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 desde el mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">+1 desde el mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Pendientes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">-1 desde la semana pasada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">+5 esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Contenido principal con tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="casos">Casos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="casos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Casos</CardTitle>
              <CardDescription>Administra todos los casos legales de tu bufete</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros y búsqueda */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar casos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                    <SelectItem value="cerrado">Cerrados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla de casos */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Caso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casos.map((caso) => (
                    <TableRow key={caso.id}>
                      <TableCell className="font-medium">{caso.numero}</TableCell>
                      <TableCell>{caso.cliente}</TableCell>
                      <TableCell>{caso.tipo}</TableCell>
                      <TableCell>
                        <Badge className={getEstadoBadge(caso.estado)}>{caso.estado}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPrioridadBadge(caso.prioridad)}>{caso.prioridad}</Badge>
                      </TableCell>
                      <TableCell>{caso.fechaInicio}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Clientes</CardTitle>
              <CardDescription>Administra la información de tus clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Casos Activos</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nombre}</TableCell>
                      <TableCell>{cliente.email}</TableCell>
                      <TableCell>{cliente.telefono}</TableCell>
                      <TableCell>{cliente.empresa || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cliente.casosActivos}</Badge>
                      </TableCell>
                      <TableCell>{cliente.fechaRegistro}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Ver Perfil
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Documentos</CardTitle>
              <CardDescription>Organiza y administra todos los documentos legales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Gestión de Documentos</h3>
                <p className="text-muted-foreground">Funcionalidad de documentos en desarrollo</p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Subir Documento
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendario de Audiencias</CardTitle>
              <CardDescription>Programa y gestiona fechas importantes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Calendario Legal</h3>
                <p className="text-muted-foreground">Funcionalidad de calendario en desarrollo</p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Cita
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
