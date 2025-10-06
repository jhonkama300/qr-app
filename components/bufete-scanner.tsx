"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  RotateCw,
  QrCode,
} from "lucide-react"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "no_cupos"
  message: string
  timestamp: string
}

export function BuffeteScanner() {
  const { user, fullName, activeRole } = useAuth()
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
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr")

  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const scannerActive = useRef(false)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const lastScanTime = useRef<number>(0)
  const SCAN_COOLDOWN = 2000

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

  useEffect(() => {
    if (activeTab === "manual" && manualInputRef.current) {
      manualInputRef.current.focus()
    }
  }, [activeTab])

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
        userRole: activeRole || "bufete",
        mesaAsignada: user.mesaAsignada,
      }

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
    if (
      !isClient ||
      !hasPermission ||
      !selectedDeviceId ||
      processing ||
      isScanning ||
      !codeReader.current ||
      activeTab !== "qr"
    ) {
      if (codeReader.current && scannerActive.current) {
        console.log("[v0] Stopping scanner (conditions not met)")
        codeReader.current.reset()
        scannerActive.current = false
      }
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      console.warn("[v0] Video element not ready")
      return
    }

    if (scannerActive.current) {
      console.log("[v0] Scanner already active")
      return
    }

    console.log("[v0] Starting continuous scan with device:", selectedDeviceId)
    scannerActive.current = true
    setError("")

    const startScanning = async () => {
      try {
        const initTimeout = setTimeout(() => {
          console.error("[v0] Scanner initialization timeout")
          setError("Tiempo de espera agotado. Intenta cambiar de cámara o recargar.")
          scannerActive.current = false
        }, 10000)

        await codeReader.current!.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
          clearTimeout(initTimeout)

          if (result && !isScanning && !processing) {
            const now = Date.now()
            if (now - lastScanTime.current < SCAN_COOLDOWN) {
              console.log("[v0] Scan cooldown active")
              return
            }

            const scannedText = result.getText()
            console.log("[v0] QR scanned:", scannedText)
            lastScanTime.current = now
            setIsScanning(true)
            processStudentAccess(scannedText)
          }
          if (err && err.name !== "NotFoundException") {
            if (err.name === "NotReadableError") {
              console.error("[v0] Camera in use by another app")
              setError("La cámara está en uso. Cierra otras aplicaciones.")
              scannerActive.current = false
            }
          }
        })
      } catch (err: any) {
        console.error("[v0] Error starting scanner:", err)
        if (err.name === "NotAllowedError") {
          setError("Permiso de cámara denegado")
        } else if (err.name === "NotFoundError") {
          setError("No se encontró la cámara")
        } else if (err.name === "NotReadableError") {
          setError("La cámara está en uso. Cierra otras aplicaciones e intenta de nuevo.")
        } else {
          setError("Error al iniciar el escáner")
        }
        scannerActive.current = false
      }
    }

    startScanning()

    return () => {
      console.log("[v0] Cleaning up scanner...")
      if (codeReader.current && scannerActive.current) {
        codeReader.current.reset()
        scannerActive.current = false
      }
    }
  }, [isClient, hasPermission, selectedDeviceId, processing, isScanning, activeTab])

  const resetScanner = () => {
    console.log("[v0] Resetting scanner...")
    setScanResult(null)
    setShowResult(false)
    setError("")
    setManualId("")
    setIsScanning(false)
    lastScanTime.current = 0
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      console.log("[v0] Modal closed, resetting state")
      setScanResult(null)
      setIsScanning(false)
      lastScanTime.current = 0
    }
  }

  const switchCamera = () => {
    if (!isClient || devices.length <= 1) return

    console.log("[v0] Switching camera")
    if (codeReader.current && scannerActive.current) {
      codeReader.current.reset()
      scannerActive.current = false
    }

    const currentIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
    setError("")
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

  if (activeRole !== "bufete") {
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
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border shadow-sm">
        <Loader2 className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando escáner...</p>
      </div>
    )
  }

  if (hasPermission === false && activeTab === "qr") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border shadow-sm">
        <CameraOff className="text-destructive mb-6 size-20" />
        <h3 className="text-2xl font-bold mb-3">Acceso a la cámara denegado</h3>
        <p className="text-muted-foreground mb-8 text-base">
          {error || "Se requiere acceso a la cámara para escanear códigos QR."}
        </p>
        <div className="flex gap-2">
          <Button onClick={requestCameraPermission} className="h-12 px-6 text-base">
            <Camera className="mr-2 size-5" />
            Permitir acceso
          </Button>
          <Button onClick={() => setActiveTab("manual")} variant="outline" className="h-12 px-6 text-base">
            <Hash className="mr-2 size-5" />
            Ingresar ID
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 md:p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold">Entrega de Comida</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Bufete {user.mesaAsignada} - Escanea QR o ingresa ID
          </p>
        </div>

        <Badge variant="outline" className="bg-green-50 text-green-700">
          <Utensils className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Bufete {user.mesaAsignada}
        </Badge>

        <Card className="w-full max-w-2xl bg-white shadow-lg">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-center mb-4 text-gray-800">
              Escanea QR o ingresa identificación
            </h2>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "qr" | "manual")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-100">
                <TabsTrigger
                  value="qr"
                  className="text-sm md:text-base data-[state=active]:bg-green-500 data-[state=active]:text-white"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear QR
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="text-sm md:text-base data-[state=active]:bg-green-500 data-[state=active]:text-white"
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Ingreso Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="space-y-4 mt-0">
                {error && activeTab === "qr" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border">
                  {selectedDeviceId && (
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      videoConstraints={{
                        deviceId: selectedDeviceId,
                        facingMode: "environment",
                      }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-primary animate-scan"></div>
                  </div>
                  {devices.length > 1 && (
                    <button
                      onClick={switchCamera}
                      className="absolute top-4 right-4 bg-secondary/70 p-2 md:p-3 rounded-full hover:bg-secondary transition-colors shadow-md"
                      aria-label="Cambiar cámara"
                    >
                      <RotateCw className="size-5 md:size-6" />
                    </button>
                  )}
                </div>

                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {processing || isScanning ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando...
                      </span>
                    ) : (
                      "Apunta la cámara al código QR del estudiante"
                    )}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-id" className="text-base">
                      Número de Identificación
                    </Label>
                    <Input
                      ref={manualInputRef}
                      id="manual-id"
                      type="text"
                      placeholder="Ej: 1065123456"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && manualId.trim() && !processing) {
                          processStudentAccess(manualId.trim())
                          setManualId("")
                        }
                      }}
                      disabled={processing}
                      className="text-lg h-12"
                    />
                    <p className="text-xs text-muted-foreground">Ingresa el número de cédula del estudiante</p>
                  </div>

                  <Button
                    onClick={() => {
                      if (manualId.trim()) {
                        processStudentAccess(manualId.trim())
                        setManualId("")
                      }
                    }}
                    disabled={processing || !manualId.trim()}
                    className="w-full h-12 text-base bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 text-white"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Continuar
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Tip:</strong> El estudiante debe mostrar su documento de identidad para verificar el número.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResult} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.status === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResult?.status === "no_cupos" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="w-5 h-5 text-red-600" />}
              Resultado del Proceso
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
                        <span className="font-medium text-sm">Bufete:</span>
                        <p className="text-sm">Bufete {user.mesaAsignada}</p>
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
              Procesar Otro Estudiante
            </Button>
            <Button variant="outline" onClick={() => handleModalClose(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
