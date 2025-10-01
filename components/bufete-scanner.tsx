"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
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
  Utensils,
  Hash,
  RefreshCcwIcon,
} from "lucide-react"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "no_cupos"
  message: string
  timestamp: string
}

export function BuffeteScanner() {
  const { user, fullName } = useAuth()
  const { getStudentById, markStudentAccess, validateMesaAccess } = useStudentStoreContext()

  const [isClient, setIsClient] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [isScanning, setIsScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [manualId, setManualId] = useState("")
  const [showManualInput, setShowManualInput] = useState(false)

  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const scannerActive = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    if (!codeReader.current) {
      const hints = new Map<DecodeHintType, any>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
      hints.set(DecodeHintType.TRY_HARDER, true)
      codeReader.current = new BrowserMultiFormatReader(hints)
      console.log("[v0] ZXing reader initialized for bufete")
    }

    return () => {
      if (codeReader.current) {
        console.log("[v0] Cleaning up ZXing reader")
        codeReader.current.reset()
        scannerActive.current = false
      }
    }
  }, [isClient])

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput")
    setDevices(videoDevices)
    const backCamera = videoDevices.find(
      (device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("trasera") ||
        device.label.toLowerCase().includes("rear") ||
        device.label.toLowerCase().includes("environment"),
    )
    if (backCamera) {
      setSelectedDeviceId(backCamera.deviceId)
    } else if (videoDevices.length > 0) {
      setSelectedDeviceId(videoDevices[0].deviceId)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true)
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
  }, [handleDevices, isClient])

  const processStudentAccess = async (identificacion: string) => {
    try {
      setProcessing(true)
      setError("")

      if (!user?.mesaAsignada) {
        setScanResult({
          identificacion,
          student: null,
          status: "error",
          message: "Usuario sin mesa asignada",
          timestamp: new Date().toISOString(),
        })
        setShowResult(true)
        return
      }

      // Validar acceso por mesa
      const validation = await validateMesaAccess(identificacion, user.mesaAsignada)

      if (!validation.valid) {
        setScanResult({
          identificacion,
          student: null,
          status: "no_cupos",
          message: validation.message,
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
          status: "error",
          message: "Estudiante no encontrado en la base de datos",
          timestamp: new Date().toISOString(),
        })
        setShowResult(true)
        return
      }

      const userInfo = {
        userId: user.id,
        userName: fullName || user.fullName || "Usuario Bufete",
        userEmail: user.idNumber + "@sistema.com",
        userRole: user.role || "bufete",
        mesaAsignada: user.mesaAsignada,
      }

      console.log("[v0] Datos del usuario para registro:", userInfo)

      // Marcar acceso exitoso
      await markStudentAccess(identificacion, true, `Comida entregada en Mesa ${user.mesaAsignada}`, "manual", userInfo)

      setScanResult({
        identificacion,
        student,
        status: "success",
        message: validation.message,
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
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

  useEffect(() => {
    if (!isClient || !hasPermission || !selectedDeviceId || processing || isScanning || !codeReader.current) {
      if (!isClient || !hasPermission || !selectedDeviceId || processing || isScanning) {
        console.log("[v0] Reseteando lector (condiciones no cumplidas)...")
      }
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      return
    }

    if (scannerActive.current) {
      return
    }

    console.log("[v0] Iniciando escaneo continuo con dispositivo:", selectedDeviceId)
    scannerActive.current = true
    setError("")

    const startScanning = async () => {
      try {
        await codeReader.current!.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
          if (result && !isScanning && !processing) {
            const scannedText = result.getText()
            console.log("[v0] QR escaneado:", scannedText)
            setIsScanning(true)
            processStudentAccess(scannedText)
          }
          if (err && err.name !== "NotFoundException") {
            console.log("[v0] Error del scanner:", err.name)
          }
        })
      } catch (err) {
        console.error("[v0] Error al iniciar scanner:", err)
        setError("Error al iniciar el escáner")
        scannerActive.current = false
      }
    }

    startScanning()

    return () => {
      console.log("[v0] Reseteando lector en cleanup...")
      if (codeReader.current && scannerActive.current) {
        codeReader.current.reset()
        scannerActive.current = false
      }
    }
  }, [isClient, hasPermission, selectedDeviceId, processing, isScanning])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (manualId.trim()) {
      await processStudentAccess(manualId.trim())
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
    setIsScanning(false)
  }

  const switchCamera = () => {
    if (!isClient || devices.length <= 1) return

    console.log("[v0] Cambiando cámara")
    if (codeReader.current && scannerActive.current) {
      codeReader.current.reset()
      scannerActive.current = false
    }

    const currentIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
  }

  const requestCameraPermission = () => {
    if (!isClient) return
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true)
        setError("")
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
  }

  if (user?.role !== "bufete") {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Esta funcionalidad solo está disponible para usuarios con rol "Bufete"</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <Loader2 className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando escáner...</p>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <CameraOff className="text-destructive mb-6 size-20" />
        <h3 className="text-2xl font-bold mb-3 text-foreground">Acceso a la cámara denegado</h3>
        <p className="text-muted-foreground mb-8 text-base">
          {error || "Se requiere acceso a la cámara para escanear códigos QR."}
        </p>
        <Button
          onClick={requestCameraPermission}
          className="bg-primary text-primary-foreground h-12 px-6 text-base rounded-md"
        >
          <Camera className="mr-2 size-5" />
          Permitir acceso a la cámara
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Entrega de Comida</h1>
          <p className="text-muted-foreground">
            Mesa {user.mesaAsignada} - Escanea QR o ingresa identificación para entregar comida
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <Utensils className="w-4 h-4 mr-1" />
            Mesa {user.mesaAsignada}
          </Badge>
          <Badge variant="outline">Escaneo Continuo</Badge>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Escáner para Bufete
            </CardTitle>
            <CardDescription>Escanea QR automáticamente o ingresa identificación manualmente</CardDescription>
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
                <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-border">
                  {selectedDeviceId && (
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      videoConstraints={{
                        deviceId: selectedDeviceId,
                        facingMode: "environment",
                      }}
                      className="absolute inset-0 w-full h-full object-cover"
                      onUserMedia={() => {
                        console.log("[v0] Camera stream ready")
                      }}
                    />
                  )}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-primary animate-scan"></div>
                  </div>
                  {devices.length > 1 && (
                    <button
                      onClick={switchCamera}
                      className="absolute top-4 right-4 bg-secondary/70 text-foreground p-3 rounded-full hover:bg-secondary transition-colors shadow-md"
                      aria-label="Cambiar cámara"
                    >
                      <RefreshCcwIcon className="size-6" />
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {processing || isScanning ? "Procesando..." : "Escaneando automáticamente... Apunta al código QR"}
                  </p>
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
              {scanResult?.status === "no_cupos" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="w-5 h-5 text-red-600" />}
              Resultado del Escaneo
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
                      <CardTitle className="text-sm text-green-800">✅ Comida Entregada</CardTitle>
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
                        <span className="font-medium text-sm">Mesa:</span>
                        <p className="text-sm">Mesa {user.mesaAsignada}</p>
                      </div>
                      <div className="text-xs text-green-700 bg-green-100 p-2 rounded">{scanResult.message}</div>
                    </CardContent>
                  </Card>
                )}

                {scanResult.status === "no_cupos" && (
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
