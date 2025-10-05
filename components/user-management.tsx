"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Loader2, Plus, Trash2, Shield, User, Award as IdCard, Scale, KeyRound, Edit } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserData {
  id: string
  idNumber: string
  fullName: string
  roles: ("administrador" | "operativo" | "bufete")[]
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

        let roles: ("administrador" | "operativo" | "bufete")[]
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")
    setSuccess("")

    try {
      const selectedRoles: ("administrador" | "operativo" | "bufete")[] = []
      if (newUser.roles.administrador) selectedRoles.push("administrador")
      if (newUser.roles.operativo) selectedRoles.push("operativo")
      if (newUser.roles.bufete) selectedRoles.push("bufete")

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
        roles: { administrador: false, operativo: true, bufete: false },
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
    currentRoles: ("administrador" | "operativo" | "bufete")[],
  ) => {
    try {
      let newRoles: ("administrador" | "operativo" | "bufete")[]

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
    setIsEditDialogOpen(true)
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setCreating(true)
    setError("")
    setSuccess("")

    try {
      const updateData: any = {
        idNumber: editForm.idNumber,
        fullName: editForm.fullName,
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
      default:
        return <User className="w-3.5 h-3.5 text-blue-600" />
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      administrador: "bg-red-100 text-red-800",
      bufete: "bg-green-100 text-green-800",
      operativo: "bg-blue-100 text-blue-800",
    }
    return colors[role as keyof typeof colors] || colors.operativo
  }

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4">
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
    <main className="flex flex-1 flex-col gap-4 p-4">
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

      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
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
                      className="pl-10"
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
                      className="pl-10"
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
                <Button type="submit" disabled={creating} className="w-full">
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

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No hay usuarios registrados</p>
              <p className="text-sm text-muted-foreground">Crea el primer usuario para comenzar</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {getRoleIcon(user.roles[0])}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{user.fullName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>ID: {user.idNumber}</span>
                        <span>•</span>
                        <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(role)}`}
                          >
                            {role === "administrador" ? "Administrador" : role === "bufete" ? "Bufete" : "Operativo"}
                          </span>
                        ))}
                        {user.roles.includes("bufete") && user.mesaAsignada && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Mesa {user.mesaAsignada}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Roles</Label>
                      <div className="space-y-2 border rounded-lg p-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${user.id}-operativo`}
                            checked={user.roles.includes("operativo")}
                            onCheckedChange={() => handleRoleToggle(user.id, "operativo", user.roles)}
                          />
                          <label
                            htmlFor={`${user.id}-operativo`}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <User className="w-3 h-3" />
                            Operativo
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${user.id}-administrador`}
                            checked={user.roles.includes("administrador")}
                            onCheckedChange={() => handleRoleToggle(user.id, "administrador", user.roles)}
                          />
                          <label
                            htmlFor={`${user.id}-administrador`}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <Shield className="w-3 h-3" />
                            Administrador
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${user.id}-bufete`}
                            checked={user.roles.includes("bufete")}
                            onCheckedChange={() => handleRoleToggle(user.id, "bufete", user.roles)}
                          />
                          <label
                            htmlFor={`${user.id}-bufete`}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <Scale className="w-3 h-3" />
                            Bufete
                          </label>
                        </div>
                      </div>
                    </div>

                    {user.roles.includes("bufete") && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mesa</Label>
                        <Select
                          value={user.mesaAsignada?.toString() || ""}
                          onValueChange={(value) => handleMesaChange(user.id, Number.parseInt(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Seleccionar mesa" />
                          </SelectTrigger>
                          <SelectContent>
                            {mesasActivas.map((mesa) => (
                              <SelectItem key={mesa} value={mesa.toString()}>
                                Mesa {mesa}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(user)}
                        className="flex-1 h-8 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(user.id, user.fullName)}
                        disabled={resettingPassword === user.id}
                        className="flex-1 h-8 text-xs"
                      >
                        {resettingPassword === user.id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <KeyRound className="w-3 h-3 mr-1" />
                        )}
                        {resettingPassword === user.id ? "Restaurando..." : "Restaurar"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.fullName)}
                        className="h-8 px-3"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
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
                    className="pl-10"
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
                    className="pl-10"
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
                />
                <p className="text-xs text-muted-foreground">
                  Deja este campo vacío si no deseas cambiar la contraseña
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={creating} className="w-full">
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
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
