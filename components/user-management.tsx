"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { createUser, resetUserPassword, changePassword } from "@/lib/auth-service"
import { collection, getDocs, deleteDoc, doc, updateDoc, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, Trash2, Shield, User, Award as IdCard, Scale, KeyRound, Edit, Search, Eye } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface UserData {
  id: string
  idNumber: string
  fullName: string
  roles: ("administrador" | "operativo" | "bufete" | "consultor")[]
  mesaAsignada?: number
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editForm, setEditForm] = useState({
    idNumber: "",
    fullName: "",
    password: "",
  })
  const [editRoles, setEditRoles] = useState({
    administrador: false,
    operativo: false,
    bufete: false,
    consultor: false,
  })
  const [editMesaAsignada, setEditMesaAsignada] = useState(1)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<"todos" | "administrador" | "operativo" | "bufete" | "consultor">(
    "todos",
  )
  const [activeTab, setActiveTab] = useState<"todos" | "administrador" | "operativo" | "bufete" | "consultor">("todos")

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  })

  const [mesasActivas, setMesasActivas] = useState<number[]>([])

  const [newUser, setNewUser] = useState({
    idNumber: "",
    fullName: "",
    password: "",
    roles: {
      administrador: false,
      operativo: true,
      bufete: false,
      consultor: false,
    },
    mesaAsignada: 1,
  })

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    loadMesasActivas()
  }, [])

  const loadMesasActivas = async () => {
    try {
      const mesasQuery = query(collection(db, "mesas_config"))
      const mesasSnapshot = await getDocs(mesasQuery)
      const activas: number[] = []

      mesasSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.activa) {
          activas.push(data.numero)
        }
      })

      setMesasActivas(activas.sort((a, b) => a - b))
    } catch (error) {
      console.error("Error al cargar mesas activas:", error)
    }
  }

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"))
      const usersData: UserData[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()

        let roles: ("administrador" | "operativo" | "bufete" | "consultor")[]
        if (Array.isArray(data.roles)) {
          roles = data.roles
        } else if (data.role) {
          roles = [data.role]
        } else {
          roles = ["operativo"]
        }

        usersData.push({
          id: doc.id,
          idNumber: data.idNumber,
          fullName: data.fullName,
          roles: roles,
          mesaAsignada: data.mesaAsignada,
          createdAt: data.createdAt,
        })
      })
      setUsers(usersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error("Error al cargar usuarios:", error)
      setError("Error al cargar la lista de usuarios")
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    let filtered = users

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) => user.fullName.toLowerCase().includes(query) || user.idNumber.toLowerCase().includes(query),
      )
    }

    // Filtrar por tab activo
    if (activeTab !== "todos") {
      filtered = filtered.filter((user) => user.roles.includes(activeTab))
    }

    return filtered
  }, [users, searchQuery, activeTab])

  const userStats = useMemo(() => {
    return {
      total: users.length,
      administradores: users.filter((u) => u.roles.includes("administrador")).length,
      operativos: users.filter((u) => u.roles.includes("operativo")).length,
      bufetes: users.filter((u) => u.roles.includes("bufete")).length,
      consultores: users.filter((u) => u.roles.includes("consultor")).length,
    }
  }, [users])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")
    setSuccess("")

    try {
      const selectedRoles: ("administrador" | "operativo" | "bufete" | "consultor")[] = []
      if (newUser.roles.administrador) selectedRoles.push("administrador")
      if (newUser.roles.operativo) selectedRoles.push("operativo")
      if (newUser.roles.bufete) selectedRoles.push("bufete")
      if (newUser.roles.consultor) selectedRoles.push("consultor")

      if (selectedRoles.length === 0) {
        setError("Debes seleccionar al menos un rol")
        setCreating(false)
        return
      }

      if (newUser.roles.bufete && !mesasActivas.includes(newUser.mesaAsignada)) {
        setError(
          `No se puede asignar la Mesa ${newUser.mesaAsignada} porque está inactiva. Por favor, selecciona una mesa activa.`,
        )
        setCreating(false)
        return
      }

      await createUser(
        newUser.idNumber,
        newUser.fullName,
        newUser.password,
        selectedRoles,
        newUser.roles.bufete ? newUser.mesaAsignada : undefined,
      )
      setSuccess(`Usuario ${newUser.fullName} creado exitosamente`)
      setNewUser({
        idNumber: "",
        fullName: "",
        password: "",
        roles: { administrador: false, operativo: true, bufete: false, consultor: false },
        mesaAsignada: 1,
      })
      setIsDialogOpen(false)
      loadUsers()
    } catch (error: any) {
      console.error("Error al crear usuario:", error)
      setError(error.message || "Error al crear el usuario")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, fullName: string) => {
    setConfirmDialog({
      open: true,
      title: "¿Eliminar usuario?",
      description: `¿Estás seguro de eliminar al usuario ${fullName}? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "users", userId))
          setSuccess(`Usuario ${fullName} eliminado exitosamente`)
          loadUsers()
        } catch (error) {
          console.error("Error al eliminar usuario:", error)
          setError("Error al eliminar el usuario")
        }
      },
    })
  }

  const handleRoleToggle = async (
    userId: string,
    role: "administrador" | "operativo" | "bufete",
    currentRoles: ("administrador" | "operativo" | "bufete" | "consultor")[],
  ) => {
    try {
      let newRoles: ("administrador" | "operativo" | "bufete" | "consultor")[]

      if (currentRoles.includes(role)) {
        // Remove role
        newRoles = currentRoles.filter((r) => r !== role)
        if (newRoles.length === 0) {
          setError("El usuario debe tener al menos un rol")
          return
        }
      } else {
        // Add role
        newRoles = [...currentRoles, role]
      }

      const updateData: any = { roles: newRoles }

      // If removing bufete role, clear mesa assignment
      if (role === "bufete" && currentRoles.includes("bufete") && !newRoles.includes("bufete")) {
        updateData.mesaAsignada = null
      }

      // If adding bufete role and no mesa assigned, set default
      if (role === "bufete" && !currentRoles.includes("bufete") && newRoles.includes("bufete")) {
        updateData.mesaAsignada = mesasActivas[0] || 1
      }

      await updateDoc(doc(db, "users", userId), updateData)
      setSuccess("Roles actualizados exitosamente")
      loadUsers()
    } catch (error) {
      console.error("Error al actualizar roles:", error)
      setError("Error al actualizar los roles")
    }
  }

  const handleMesaChange = async (userId: string, newMesa: number) => {
    try {
      if (!mesasActivas.includes(newMesa)) {
        setError(`No se puede asignar la Mesa ${newMesa} porque está inactiva. Por favor, selecciona una mesa activa.`)
        return
      }

      await updateDoc(doc(db, "users", userId), {
        mesaAsignada: newMesa,
      })
      setSuccess("Mesa asignada actualizada exitosamente")
      loadUsers()
    } catch (error) {
      console.error("Error al actualizar mesa:", error)
      setError("Error al actualizar la mesa asignada")
    }
  }

  const handleResetPassword = async (userId: string, fullName: string) => {
    setConfirmDialog({
      open: true,
      title: "¿Restaurar contraseña?",
      description: `¿Estás seguro de restaurar la contraseña de ${fullName}? Se establecerá la contraseña predeterminada: Uparsistem123`,
      onConfirm: async () => {
        setResettingPassword(userId)
        try {
          await resetUserPassword(userId)
          setSuccess(`Contraseña de ${fullName} restaurada exitosamente. Nueva contraseña: Uparsistem123`)
        } catch (error) {
          console.error("Error al restaurar contraseña:", error)
          setError("Error al restaurar la contraseña")
        } finally {
          setResettingPassword(null)
        }
      },
    })
  }

  const handleOpenEditDialog = (user: UserData) => {
    setEditingUser(user)
    setEditForm({
      idNumber: user.idNumber,
      fullName: user.fullName,
      password: "",
    })
    setEditRoles({
      administrador: user.roles.includes("administrador"),
      operativo: user.roles.includes("operativo"),
      bufete: user.roles.includes("bufete"),
      consultor: user.roles.includes("consultor"),
    })
    setEditMesaAsignada(user.mesaAsignada || 1)
    setIsEditDialogOpen(true)
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setCreating(true)
    setError("")
    setSuccess("")

    try {
      const selectedRoles: ("administrador" | "operativo" | "bufete" | "consultor")[] = []
      if (editRoles.administrador) selectedRoles.push("administrador")
      if (editRoles.operativo) selectedRoles.push("operativo")
      if (editRoles.bufete) selectedRoles.push("bufete")
      if (editRoles.consultor) selectedRoles.push("consultor")

      if (selectedRoles.length === 0) {
        setError("El usuario debe tener al menos un rol")
        setCreating(false)
        return
      }

      if (editRoles.bufete && !mesasActivas.includes(editMesaAsignada) && editingUser.roles.includes("bufete")) {
        setError(`La Mesa ${editMesaAsignada} está inactiva. Selecciona una mesa activa.`)
        setCreating(false)
        return
      }

      const updateData: any = {
        idNumber: editForm.idNumber,
        fullName: editForm.fullName,
        roles: selectedRoles,
      }

      if (editRoles.bufete) {
        updateData.mesaAsignada = editMesaAsignada
      } else {
        updateData.mesaAsignada = null
      }

      if (editForm.password.trim()) {
        await changePassword(editingUser.id, editForm.password)
      }

      await updateDoc(doc(db, "users", editingUser.id), updateData)

      setSuccess(`Usuario ${editForm.fullName} actualizado exitosamente`)
      setIsEditDialogOpen(false)
      setEditingUser(null)
      loadUsers()
    } catch (error: any) {
      console.error("Error al editar usuario:", error)
      setError(error.message || "Error al editar el usuario")
    } finally {
      setCreating(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "administrador":
        return <Shield className="w-3.5 h-3.5 text-red-600" />
      case "bufete":
        return <Scale className="w-3.5 h-3.5 text-green-600" />
      case "consultor":
        return <Eye className="w-3.5 h-3.5 text-purple-600" />
      default:
        return <User className="w-3.5 h-3.5 text-blue-600" />
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      administrador: "bg-red-100 text-red-800",
      bufete: "bg-green-100 text-green-800",
      operativo: "bg-blue-100 text-blue-800",
      consultor: "bg-purple-100 text-purple-800",
    }
    return colors[role as keyof typeof colors] || colors.operativo
  }

  if (loading) {
    return (
    <main className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Cargando usuarios...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4 w-full min-w-0 overflow-hidden">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <header className="flex items-center justify-between gap-2 md:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-xl font-bold">Gestión de Usuarios</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto border-t-4 border-t-uparsistem-600 rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-uparsistem-700">Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>Ingresa los datos del nuevo usuario del sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="idNumber">Número de Identificación</Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="idNumber"
                      type="text"
                      placeholder="1234567890"
                      value={newUser.idNumber}
                      onChange={(e) => setNewUser({ ...newUser, idNumber: e.target.value })}
                      className="pl-10 border-uparsistem-200 focus-visible:ring-uparsistem-500"
                      required
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Juan Pérez"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      className="pl-10 border-uparsistem-200 focus-visible:ring-uparsistem-500"
                      required
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    disabled={creating}
                    minLength={6}
                    className="border-uparsistem-200 focus-visible:ring-uparsistem-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Roles del Usuario (selecciona uno o más)</Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="role-operativo"
                        checked={newUser.roles.operativo}
                        onCheckedChange={(checked) =>
                          setNewUser({ ...newUser, roles: { ...newUser.roles, operativo: checked as boolean } })
                        }
                        disabled={creating}
                      />
                      <label htmlFor="role-operativo" className="flex items-center gap-2 text-sm cursor-pointer">
                        <User className="w-4 h-4" />
                        Operativo
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="role-administrador"
                        checked={newUser.roles.administrador}
                        onCheckedChange={(checked) =>
                          setNewUser({ ...newUser, roles: { ...newUser.roles, administrador: checked as boolean } })
                        }
                        disabled={creating}
                      />
                      <label htmlFor="role-administrador" className="flex items-center gap-2 text-sm cursor-pointer">
                        <Shield className="w-4 h-4" />
                        Administrador
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="role-bufete"
                        checked={newUser.roles.bufete}
                        onCheckedChange={(checked) =>
                          setNewUser({ ...newUser, roles: { ...newUser.roles, bufete: checked as boolean } })
                        }
                        disabled={creating}
                      />
                      <label htmlFor="role-bufete" className="flex items-center gap-2 text-sm cursor-pointer">
                        <Scale className="w-4 h-4" />
                        Bufete
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="role-consultor"
                        checked={newUser.roles.consultor}
                        onCheckedChange={(checked) =>
                          setNewUser({ ...newUser, roles: { ...newUser.roles, consultor: checked as boolean } })
                        }
                        disabled={creating}
                      />
                      <label htmlFor="role-consultor" className="flex items-center gap-2 text-sm cursor-pointer">
                        <Eye className="w-4 h-4" />
                        Consultor
                      </label>
                    </div>
                  </div>
                </div>

                {newUser.roles.bufete && (
                  <div className="space-y-2">
                    <Label htmlFor="mesa">Mesa Asignada</Label>
                    <Select
                      value={newUser.mesaAsignada.toString()}
                      onValueChange={(value) => setNewUser({ ...newUser, mesaAsignada: Number.parseInt(value) })}
                      disabled={creating}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la mesa" />
                      </SelectTrigger>
                      <SelectContent>
                        {mesasActivas.length > 0 ? (
                          mesasActivas.map((mesa) => (
                            <SelectItem key={mesa} value={mesa.toString()}>
                              Mesa {mesa} (Activa)
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="0" disabled>
                            No hay mesas activas disponibles
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {mesasActivas.length === 0 && (
                      <p className="text-xs text-red-600">
                        No hay mesas activas. Contacta al administrador para activar mesas.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={creating} className="w-full bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Usuario"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nombre o identificación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          <Card>
            <CardContent className="p-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{userStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{userStats.administradores}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{userStats.operativos}</p>
                <p className="text-xs text-muted-foreground">Operativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{userStats.bufetes}</p>
                <p className="text-xs text-muted-foreground">Bufetes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{userStats.consultores}</p>
                <p className="text-xs text-muted-foreground">Consultores</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="todos" className="text-xs">
            Todos
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {userStats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="administrador" className="text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Admin
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {userStats.administradores}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="operativo" className="text-xs">
            <User className="w-3 h-3 mr-1" />
            Oper.
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {userStats.operativos}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="bufete" className="text-xs">
            <Scale className="w-3 h-3 mr-1" />
            Bufete
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {userStats.bufetes}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="consultor" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Consult.
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {userStats.consultores}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {searchQuery ? "No se encontraron usuarios" : "No hay usuarios en esta categoría"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Intenta con otra búsqueda" : "Crea el primer usuario para comenzar"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 md:space-y-2">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 rounded-lg border border-uparsistem-100/50 dark:border-uparsistem-900/20 bg-white dark:bg-gray-900">
                  <div className="flex size-7 md:size-10 shrink-0 items-center justify-center rounded-full bg-uparsistem-100 dark:bg-uparsistem-900/30 mt-0.5">
                    {getRoleIcon(user.roles[0])}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] md:text-sm font-semibold truncate">{user.fullName}</p>
                        <div className="flex items-center gap-1 text-[8px] md:text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="font-mono font-bold text-foreground">{user.idNumber}</span>
                          <span className="opacity-50">·</span>
                          <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                          {user.roles.map((role) => (
                            <span key={role} className={`text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRoleBadge(role)}`}>
                              {role === "administrador" ? "Admin" : role === "bufete" ? "Bufete" : role === "consultor" ? "Consultor" : "Operativo"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        <button className="size-6 md:size-7 flex items-center justify-center rounded-md hover:bg-uparsistem-50 text-muted-foreground hover:text-uparsistem-700 transition-colors" onClick={() => handleOpenEditDialog(user)}>
                          <Edit className="size-3 md:size-3.5" />
                        </button>
                        <button className="size-6 md:size-7 flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" onClick={() => handleDeleteUser(user.id, user.fullName)}>
                          <Trash2 className="size-3 md:size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md mx-auto border-t-4 border-t-uparsistem-600 rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-uparsistem-700">Editar Usuario</DialogTitle>
              <DialogDescription>Modifica los datos del usuario</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-idNumber">Número de Identificación</Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="edit-idNumber"
                      type="text"
                      placeholder="1234567890"
                      value={editForm.idNumber}
                      onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })}
                      className="pl-10 border-uparsistem-200 focus-visible:ring-uparsistem-500"
                      required
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-fullName">Nombre Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="edit-fullName"
                      type="text"
                      placeholder="Juan Pérez"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="pl-10 border-uparsistem-200 focus-visible:ring-uparsistem-500"
                      required
                      disabled={creating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="Dejar vacío para mantener la actual"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    disabled={creating}
                    minLength={6}
                    className="border-uparsistem-200 focus-visible:ring-uparsistem-500"
                  />
                <p className="text-xs text-muted-foreground">
                  Deja este campo vacío si no deseas cambiar la contraseña
                </p>
              </div>

              <div className="space-y-2">
                <Label>Roles del Usuario</Label>
                <div className="space-y-2 border rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-role-operativo"
                      checked={editRoles.operativo}
                      onCheckedChange={(checked) =>
                        setEditRoles({ ...editRoles, operativo: checked as boolean })
                      }
                      disabled={creating}
                    />
                    <label htmlFor="edit-role-operativo" className="flex items-center gap-2 text-sm cursor-pointer">
                      <User className="w-4 h-4" />
                      Operativo
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-role-administrador"
                      checked={editRoles.administrador}
                      onCheckedChange={(checked) =>
                        setEditRoles({ ...editRoles, administrador: checked as boolean })
                      }
                      disabled={creating}
                    />
                    <label htmlFor="edit-role-administrador" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Shield className="w-4 h-4" />
                      Administrador
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-role-bufete"
                      checked={editRoles.bufete}
                      onCheckedChange={(checked) =>
                        setEditRoles({ ...editRoles, bufete: checked as boolean })
                      }
                      disabled={creating}
                    />
                    <label htmlFor="edit-role-bufete" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Scale className="w-4 h-4" />
                      Bufete
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-role-consultor"
                      checked={editRoles.consultor}
                      onCheckedChange={(checked) =>
                        setEditRoles({ ...editRoles, consultor: checked as boolean })
                      }
                      disabled={creating}
                    />
                    <label htmlFor="edit-role-consultor" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Eye className="w-4 h-4" />
                      Consultor
                    </label>
                  </div>
                </div>
              </div>

              {editRoles.bufete && (
                <div className="space-y-2">
                  <Label htmlFor="edit-mesa">Mesa Asignada</Label>
                  <Select
                    value={editMesaAsignada.toString()}
                    onValueChange={(value) => setEditMesaAsignada(Number.parseInt(value))}
                    disabled={creating}
                  >
                    <SelectTrigger className="border-uparsistem-200 focus-visible:ring-uparsistem-500">
                      <SelectValue placeholder="Selecciona la mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {mesasActivas.length > 0 ? (
                        mesasActivas.map((mesa) => (
                          <SelectItem key={mesa} value={mesa.toString()}>
                            Mesa {mesa} (Activa)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="0" disabled>
                          No hay mesas activas disponibles
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {mesasActivas.length === 0 && (
                    <p className="text-xs text-red-600">
                      No hay mesas activas. Contacta al administrador para activar mesas.
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
                <Button type="submit" disabled={creating} className="w-full bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent className="border-t-4 border-t-uparsistem-600 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-uparsistem-700">{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog.onConfirm()
                setConfirmDialog({ ...confirmDialog, open: false })
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
