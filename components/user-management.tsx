"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createUser, resetUserPassword } from "@/lib/auth-service"
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Loader2, Plus, Trash2, Shield, User, Mail, Scale, KeyRound } from "lucide-react"

interface UserData {
  id: string
  email: string
  role: "administrador" | "operativo" | "bufete"
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

  // Formulario de nuevo usuario
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role: "operativo" as "administrador" | "operativo" | "bufete",
  })

  // Cargar usuarios al montar el componente
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"))
      const usersData: UserData[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        usersData.push({
          id: doc.id,
          email: data.email,
          role: data.role,
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
      await createUser(newUser.email, newUser.password, newUser.role)
      setSuccess(`Usuario ${newUser.email} creado exitosamente`)
      setNewUser({ email: "", password: "", role: "operativo" })
      setIsDialogOpen(false)
      loadUsers()
    } catch (error: any) {
      console.error("Error al crear usuario:", error)
      setError(error.message || "Error al crear el usuario")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${email}?`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "users", userId))
      setSuccess(`Usuario ${email} eliminado exitosamente`)
      loadUsers()
    } catch (error) {
      console.error("Error al eliminar usuario:", error)
      setError("Error al eliminar el usuario")
    }
  }

  const handleRoleChange = async (userId: string, newRole: "administrador" | "operativo" | "bufete") => {
    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
      })
      setSuccess("Rol actualizado exitosamente")
      loadUsers()
    } catch (error) {
      console.error("Error al actualizar rol:", error)
      setError("Error al actualizar el rol")
    }
  }

  const handleResetPassword = async (userId: string, email: string) => {
    if (
      !confirm(`¿Estás seguro de restaurar la contraseña de ${email}? Se establecerá la contraseña predeterminada.`)
    ) {
      return
    }

    setResettingPassword(userId)
    try {
      await resetUserPassword(userId)
      setSuccess(`Contraseña de ${email} restaurada exitosamente. Nueva contraseña: Uparsistem123`)
    } catch (error) {
      console.error("Error al restaurar contraseña:", error)
      setError("Error al restaurar la contraseña")
    } finally {
      setResettingPassword(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Cargando usuarios...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los usuarios del sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>Ingresa los datos del nuevo usuario del sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
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
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Lista de Usuarios ({users.length})
          </CardTitle>
          <CardDescription>Usuarios registrados en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay usuarios registrados</p>
              <p className="text-sm text-muted-foreground">Crea el primer usuario para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/20 gap-3"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sidebar-primary/10">
                      {user.role === "administrador" ? (
                        <Shield className="w-5 h-5 text-red-600" />
                      ) : user.role === "bufete" ? (
                        <Scale className="w-5 h-5 text-green-600" />
                      ) : (
                        <User className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Creado: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select
                      value={user.role}
                      onValueChange={(value: "administrador" | "operativo" | "bufete") =>
                        handleRoleChange(user.id, value)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue />
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user.id, user.email)}
                      disabled={resettingPassword === user.id}
                      title="Restaurar contraseña"
                    >
                      {resettingPassword === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                    </Button>

                    <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id, user.email)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
