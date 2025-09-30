"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createUser, resetUserPassword } from "@/lib/auth-service"
import { collection, getDocs, deleteDoc, doc, updateDoc, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, Shield, User, Award as IdCard, Scale, KeyRound } from "lucide-react"

interface UserData {
  id: string
  idNumber: string
  fullName: string
  role: "administrador" | "operativo" | "bufete"
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

  const [mesasActivas, setMesasActivas] = useState<number[]>([])

  const [newUser, setNewUser] = useState({
    idNumber: "",
    fullName: "",
    password: "",
    role: "operativo" as "administrador" | "operativo" | "bufete",
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
        usersData.push({
          id: doc.id,
          idNumber: data.idNumber,
          fullName: data.fullName,
          role: data.role,
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
      if (newUser.role === "bufete" && !mesasActivas.includes(newUser.mesaAsignada)) {
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
        newUser.role,
        newUser.role === "bufete" ? newUser.mesaAsignada : undefined,
      )
      setSuccess(`Usuario ${newUser.fullName} creado exitosamente`)
      setNewUser({ idNumber: "", fullName: "", password: "", role: "operativo", mesaAsignada: 1 })
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
    if (!confirm(`¿Estás seguro de eliminar al usuario ${fullName}?`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "users", userId))
      setSuccess(`Usuario ${fullName} eliminado exitosamente`)
      loadUsers()
    } catch (error) {
      console.error("Error al eliminar usuario:", error)
      setError("Error al eliminar el usuario")
    }
  }

  const handleRoleChange = async (userId: string, newRole: "administrador" | "operativo" | "bufete") => {
    try {
      const updateData: any = { role: newRole }
      if (newRole === "bufete") {
        updateData.mesaAsignada = 1
      } else {
        updateData.mesaAsignada = null
      }

      await updateDoc(doc(db, "users", userId), updateData)
      setSuccess("Rol actualizado exitosamente")
      loadUsers()
    } catch (error) {
      console.error("Error al actualizar rol:", error)
      setError("Error al actualizar el rol")
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
    if (
      !confirm(`¿Estás seguro de restaurar la contraseña de ${fullName}? Se establecerá la contraseña predeterminada.`)
    ) {
      return
    }

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
                  <Label htmlFor="role">Tipo de Usuario</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: "administrador" | "operativo" | "bufete") =>
                      setNewUser({ ...newUser, role: value })
                    }
                    disabled={creating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo de usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operativo">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Operativo
                        </div>
                      </SelectItem>
                      <SelectItem value="administrador">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Administrador
                        </div>
                      </SelectItem>
                      <SelectItem value="bufete">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4" />
                          Bufete
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUser.role === "bufete" && (
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
                  {/* User info section */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {getRoleIcon(user.role)}
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
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                          {user.role === "administrador"
                            ? "Administrador"
                            : user.role === "bufete"
                              ? "Bufete"
                              : "Operativo"}
                        </span>
                        {user.role === "bufete" && user.mesaAsignada && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Mesa {user.mesaAsignada}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions section - individual buttons */}
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    {/* Role and Mesa controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Rol</Label>
                        <Select
                          value={user.role}
                          onValueChange={(value: "administrador" | "operativo" | "bufete") =>
                            handleRoleChange(user.id, value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operativo">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                Operativo
                              </div>
                            </SelectItem>
                            <SelectItem value="administrador">
                              <div className="flex items-center gap-2">
                                <Shield className="w-3 h-3" />
                                Administrador
                              </div>
                            </SelectItem>
                            <SelectItem value="bufete">
                              <div className="flex items-center gap-2">
                                <Scale className="w-3 h-3" />
                                Bufete
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {user.role === "bufete" && (
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
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
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
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
