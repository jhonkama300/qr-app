"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import {
  Loader2,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  Search,
  User,
  AlertTriangle,
  RefreshCw,
  Shield,
  Hash,
} from "lucide-react"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "not_found" | "already_scanned"
  message: string
  timestamp: string
}

export function OperativoScanner() {
  const { user } = useAuth()
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()

  const [isScanning, setIsScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [manualId, setManualId] = useState("")
  const [showManualInput, setShowManualInput] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  const startCamera = async () => {
    try {
      setError("")
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsScanning(true)
      }
    } catch (error) {
      console.error("Error al acceder a la cámara:", error)
      setError("No se pudo acceder a la cámara. Verifica los permisos.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsScanning(false)
  }

  const processEventAccess = async (identificacion: string) => {
    try {
      setProcessing(true)
      setError("")

      // Verificar si ya fue escaneado para acceso al evento
      const alreadyScanned = await checkIfAlreadyScanned(identificacion)

      if (alreadyScanned) {
        setScanResult({
          identificacion,
          student: null,
          status: "already_scanned",
          message: "Esta persona ya ingresó al evento anteriormente",
          timestamp: new Date().toISOString(),
        })
        setShowResult(true)
        return
      }

      // Obtener datos del estudiante
      const student = await getStudentById(identificacion)

      if (!student) {
        setScanResult({
          identificacion,
          student: null,
          status: "not_found",
          message: "Persona no encontrada en la base de datos",
          timestamp: new Date().toISOString(),
        })
        setShowResult(true)
        return
      }

      // Marcar acceso exitoso al evento
      await markStudentAccess(identificacion, true, "Acceso concedido al evento", "manual", {
        userId: user?.uid,
        userName: user?.email,
        userEmail: user?.email,
      })

      setScanResult({
        identificacion,
        student,
        status: "success",
        message: "Acceso concedido al evento",
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
      stopCamera()
    } catch (error) {
      console.error("Error al procesar acceso:", error)
      setScanResult({
        identificacion,
        student: null,
        status: "error",
        message: "Error al procesar el acceso",
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
    } finally {
      setProcessing(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (manualId.trim()) {
      await processEventAccess(manualId.trim())
      setManualId("")
      setShowManualInput(false)
    }
  }

  const resetScanner = () => {
    setScanResult(null)
    setShowResult(false)
    setError("")
    setManualId("")
    setShowManualInput(false)
  }

  // Simulación de escaneo QR (reemplazar con librería real)
  const simulateQRScan = async () => {
    // En producción, aquí iría la lógica real de escaneo QR
    const simulatedId = "119276897" // ID de prueba
    await processEventAccess(simulatedId)
  }

  if (user?.role !== "operativo") {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Esta funcionalidad solo está disponible para usuarios con rol "Operativo"</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Control de Acceso al Evento</h1>
          <p className="text-muted-foreground">Escanea QR o ingresa identificación para dar acceso al evento</p>
        </div>

        <div className="flex gap-2 mb-4">
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Shield className="w-4 h-4 mr-1" />
            Control de Acceso
          </Badge>
          <Badge variant="outline">Solo Ingreso al Evento</Badge>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Escáner Operativo
            </CardTitle>
            <CardDescription>Escanea QR o ingresa identificación manualmente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!showManualInput && (
              <>
                <div className="relative">
                  {isScanning ? (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover rounded-lg bg-black"
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                          {processing && (
                            <div className="text-white text-center">
                              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                              <p className="text-sm">Procesando...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <CameraOff className="w-12 h-12 mx-auto mb-2" />
                        <p>Cámara desactivada</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startCamera} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />
                      Iniciar Cámara
                    </Button>
                  ) : (
                    <>
                      <Button onClick={simulateQRScan} disabled={processing} className="flex-1">
                        {processing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Escanear QR
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={stopCamera}>
                        <CameraOff className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-id">Número de Identificación</Label>
                  <Input
                    id="manual-id"
                    type="text"
                    placeholder="Ingresa la identificación"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    disabled={processing}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={processing || !manualId.trim()} className="flex-1">
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Procesar
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowManualInput(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {!showManualInput && (
              <Button variant="outline" onClick={() => setShowManualInput(true)} className="w-full">
                <Hash className="w-4 h-4 mr-2" />
                Ingresar ID Manualmente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de resultados */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.status === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResult?.status === "already_scanned" && <XCircle className="w-5 h-5 text-orange-600" />}
              {scanResult?.status === "not_found" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="w-5 h-5 text-red-600" />}
              Resultado del Control de Acceso
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanResult && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Identificación:</span>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {scanResult.identificacion}
                  </Badge>
                </div>

                {scanResult.status === "success" && scanResult.student && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-800">✅ Acceso Concedido</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <span className="font-medium text-sm">Nombre:</span>
                        <p className="text-sm">{scanResult.student.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Programa:</span>
                        <p className="text-sm">{scanResult.student.programa}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Puesto:</span>
                        <p className="text-sm">{scanResult.student.puesto}</p>
                      </div>
                      <div className="text-xs text-green-700 bg-green-100 p-2 rounded">Bienvenido al evento</div>
                    </CardContent>
                  </Card>
                )}

                {scanResult.status === "already_scanned" && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <XCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">{scanResult.message}</AlertDescription>
                  </Alert>
                )}

                {scanResult.status === "not_found" && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{scanResult.message}</AlertDescription>
                  </Alert>
                )}

                {scanResult.status === "error" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{scanResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Procesado el {new Date(scanResult.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={resetScanner} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Procesar Otro
            </Button>
            <Button variant="outline" onClick={() => setShowResult(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
