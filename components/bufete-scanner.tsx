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
import { useQ10Validation } from "@/hooks/use-q10-validation"
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
  QrCode,
  GraduationCap,
  MapPin,
  Ticket,
  Clock,
} from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "no_cupos"
  message: string
  timestamp: string
  source?: "direct" | "q10" | "manual"
}

export function BuffeteScanner() {
  const { user, fullName, activeRole, loading: authLoading } = useAuth()
  const studentStore = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()

  const [isClient, setIsClient] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [manualId, setManualId] = useState("")
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr")
  const [realtimeStudentData, setRealtimeStudentData] = useState<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const scannerActive = useRef(false)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    console.log("[v0] Stopping camera completely...")

    if (codeReader.current && scannerActive.current) {
      try {
        codeReader.current.reset()
        scannerActive.current = false
      } catch (e) {
        console.error("[v0] Error resetting code reader:", e)
      }
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("[v0] Track stopped:", track.kind, track.label)
      })
      activeStreamRef.current = null
    }

    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        track.stop()
        console.log("[v0] Webcam track stopped:", track.kind)
      })
      webcamRef.current.video.srcObject = null
    }
  }, [])

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

  const requestCamera = useCallback(async () => {
    try {
      stopCamera()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      activeStreamRef.current = stream
      setHasPermission(true)
      const devices = await navigator.mediaDevices.enumerateDevices()
      handleDevices(devices)

      stream.getTracks().forEach((track) => track.stop())
      activeStreamRef.current = null
    } catch (err) {
      console.error("Error al acceder a la cámara:", err)
      setError("No se pudo acceder a la cámara. Por favor, concede permisos e inténtalo de nuevo.")
      setHasPermission(false)
    }
  }, [handleDevices, stopCamera])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    try {
      if (!codeReader.current) {
        const hints = new Map<DecodeHintType, any>()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
        hints.set(DecodeHintType.TRY_HARDER, true)
        codeReader.current = new BrowserMultiFormatReader(hints)
        console.log("[v0] ZXing reader initialized for bufete")
      }
    } catch (error) {
      console.error("[v0] Error initializing ZXing reader:", error)
      setError("Error al inicializar el lector de códigos QR")
    }

    return () => {
      console.log("[v0] Cleaning up ZXing reader")
      stopCamera()
    }
  }, [isClient, stopCamera])

  useEffect(() => {
    if (!isClient) return

    requestCamera()
  }, [isClient, requestCamera])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      if (processing) {
        console.log("[v0] Scan already in progress, ignoring")
        return
      }

      setProcessing(true)
      setError("")

      try {
        if (!user) {
          throw new Error("Usuario no autenticado")
        }

        if (!user.mesaAsignada) {
          setScanResult({
            identificacion: scannedContent,
            student: null,
            status: "error",
            message: "Usuario sin mesa asignada",
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          return
        }

        if (!studentStore) {
          throw new Error("Store de estudiantes no disponible")
        }

        if (
          scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") ||
          scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
        ) {
          console.log("[v0] Q10 URL detected, processing certificate...")
          setScanResult({
            identificacion: scannedContent,
            student: null,
            status: "success",
            message: "Procesando certificado Q10...",
            timestamp: new Date().toISOString(),
            source: "q10",
          })
          setShowResult(true)

          try {
            const q10Result = await processQ10Url(scannedContent)

            if (q10Result.success && q10Result.student) {
              const userInfo = {
                userId: user.id,
                userName: fullName || user.fullName || "Usuario Bufete",
                userEmail: user.idNumber + "@sistema.com",
                userRole: activeRole || "bufete",
                mesaAsignada: user.mesaAsignada,
              }

              await studentStore.markStudentAccess(
                q10Result.identificacion!,
                true,
                `Comida entregada en Mesa ${user.mesaAsignada}`,
                "q10",
                userInfo,
              )

              await new Promise((resolve) => setTimeout(resolve, 500))
              const updatedStudent = await studentStore.getStudentById(q10Result.identificacion!)

              setScanResult({
                identificacion: q10Result.identificacion!,
                student: updatedStudent || q10Result.student,
                status: "success",
                message: q10Result.message,
                timestamp: new Date().toISOString(),
                source: "q10",
              })
            } else {
              setScanResult({
                identificacion: q10Result.identificacion || scannedContent,
                student: null,
                status: q10Result.type as "denied" | "error",
                message: q10Result.message,
                timestamp: new Date().toISOString(),
                source: "q10",
              })
            }
            setShowResult(true)
            setProcessing(false)
            return
          } catch (q10Error) {
            console.error("[v0] Error processing Q10 certificate:", q10Error)
            setScanResult({
              identificacion: scannedContent,
              student: null,
              status: "error",
              message: "Error al procesar certificado Q10",
              timestamp: new Date().toISOString(),
              source: "q10",
            })
            setShowResult(true)
            setProcessing(false)
            return
          }
        }

        const identificacion = scannedContent

        const validation = await studentStore.validateMesaAccess(identificacion, user.mesaAsignada)

        if (!validation.valid) {
          setScanResult({
            identificacion,
            student: null,
            status: "no_cupos",
            message: validation.message,
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          return
        }

        const student = await studentStore.getStudentById(identificacion)

        if (!student) {
          setScanResult({
            identificacion,
            student: null,
            status: "error",
            message: "Estudiante no encontrado en la base de datos",
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          return
        }

        const userInfo = {
          userId: user.id,
          userName: fullName || user.fullName || "Usuario Bufete",
          userEmail: user.idNumber + "@sistema.com",
          userRole: activeRole || "bufete",
          mesaAsignada: user.mesaAsignada,
        }

        await studentStore.markStudentAccess(
          identificacion,
          true,
          `Comida entregada en Mesa ${user.mesaAsignada}`,
          source === "q10" ? "q10" : "manual",
          userInfo,
        )

        await new Promise((resolve) => setTimeout(resolve, 500))
        const updatedStudent = await studentStore.getStudentById(identificacion)

        console.log("[v0] Datos actualizados después del descuento:", updatedStudent)

        setScanResult({
          identificacion,
          student: updatedStudent || student,
          status: "success",
          message: validation.message,
          timestamp: new Date().toISOString(),
          source,
        })
        setShowResult(true)
        setProcessing(false)
      } catch (error) {
        console.error("[v0] Error al procesar acceso:", error)
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al procesar el acceso"
        setScanResult({
          identificacion: scannedContent,
          student: null,
          status: "error",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          source,
        })
        setShowResult(true)
      } finally {
        setProcessing(false)
      }
    },
    [processing, user, studentStore, fullName, activeRole, processQ10Url],
  )

  useEffect(() => {
    if (
      !isClient ||
      !hasPermission ||
      !selectedDeviceId ||
      processing ||
      isProcessingQ10 ||
      !codeReader.current ||
      activeTab !== "qr"
    ) {
      if (codeReader.current && scannerActive.current) {
        console.log("[v0] Stopping scanner (conditions not met)")
        stopCamera()
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
          setError("Tiempo de espera agotado. Intenta recargar la página.")
          stopCamera()
        }, 10000)

        await codeReader.current!.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
          clearTimeout(initTimeout)

          if (result && !processing && !isProcessingQ10) {
            const scannedText = result.getText()
            console.log("[v0] QR scanned:", scannedText)
            processScanResult(scannedText, "direct")
          }
          if (err && err.name !== "NotFoundException") {
            if (err.name === "NotReadableError") {
              console.error("[v0] Camera in use by another app")
              setError("La cámara está en uso. Cierra otras aplicaciones e intenta de nuevo.")
              stopCamera()
            }
          }
        })

        if (video.srcObject) {
          activeStreamRef.current = video.srcObject as MediaStream
        }
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
        stopCamera()
      }
    }

    startScanning()

    return () => {
      console.log("[v0] Cleaning up scanner...")
      stopCamera()
    }
  }, [isClient, hasPermission, selectedDeviceId, processing, isProcessingQ10, activeTab, stopCamera, processScanResult])

  useEffect(() => {
    return () => {
      console.log("[v0] BuffeteScanner unmounting, cleaning up camera...")
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (activeTab === "manual" && manualInputRef.current) {
      manualInputRef.current.focus()
    }
  }, [activeTab])

  useEffect(() => {
    if (scanResult?.identificacion && showResult) {
      console.log("[v0] Setting up realtime listener for:", scanResult.identificacion)

      const studentDocRef = doc(db, "personas", scanResult.identificacion)

      unsubscribeRef.current = onSnapshot(
        studentDocRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data()
            console.log("[v0] Realtime update received:", updatedData)
            setRealtimeStudentData(updatedData)
          }
        },
        (error) => {
          console.error("[v0] Error in realtime listener:", error)
        },
      )

      return () => {
        if (unsubscribeRef.current) {
          console.log("[v0] Cleaning up realtime listener")
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
    }
  }, [scanResult?.identificacion, showResult])

  const resetScanner = () => {
    console.log("[v0] Resetting scanner...")
    setScanResult(null)
    setRealtimeStudentData(null)
    setShowResult(false)
    setError("")
    setManualId("")
    setProcessing(false)
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      console.log("[v0] Modal closed, resetting state")
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      setScanResult(null)
      setRealtimeStudentData(null)
      setProcessing(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border shadow-sm">
        <Loader2 className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando autenticación...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No se pudo cargar la información del usuario</AlertDescription>
        </Alert>
      </div>
    )
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
          <Button onClick={requestCamera} className="h-12 px-6 text-base">
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

  const displayStudent = realtimeStudentData || scanResult?.student
  const cuposDisponibles = displayStudent
    ? 2 + (displayStudent.cuposExtras || 0) - (displayStudent.cuposConsumidos || 0)
    : 0

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-50 min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-green-900">Entrega de Comida</h1>
          <p className="text-sm md:text-base text-green-700">
            Bufete {user?.mesaAsignada || "N/A"} - Escanea QR o ingresa ID
          </p>
        </div>

        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
          <Utensils className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Bufete {user?.mesaAsignada || "N/A"}
        </Badge>

        <Card className="w-full max-w-2xl bg-white shadow-lg border-green-200">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-center mb-4 text-green-900">
              Escanea QR o ingresa identificación
            </h2>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "qr" | "manual")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-green-100">
                <TabsTrigger
                  value="qr"
                  className="text-sm md:text-base data-[state=active]:bg-green-600 data-[state=active]:text-white"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear QR
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="text-sm md:text-base data-[state=active]:bg-green-600 data-[state=active]:text-white"
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

                <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-green-200">
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
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-green-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-green-500 animate-scan"></div>
                  </div>
                </div>

                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    {processing || isProcessingQ10 ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isProcessingQ10 ? "Procesando certificado Q10..." : "Procesando..."}
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
                    <Label htmlFor="manual-id" className="text-base text-green-900">
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
                        if (e.key === "Enter" && manualId.trim() && !processing && !isProcessingQ10) {
                          processScanResult(manualId.trim(), "manual")
                          setManualId("")
                        }
                      }}
                      disabled={processing || isProcessingQ10}
                      className="text-lg h-12 border-green-300 focus:border-green-500"
                    />
                    <p className="text-xs text-green-600">Ingresa el número de cédula del estudiante</p>
                  </div>

                  <Button
                    onClick={() => {
                      if (manualId.trim()) {
                        processScanResult(manualId.trim(), "manual")
                        setManualId("")
                      }
                    }}
                    disabled={processing || isProcessingQ10 || !manualId.trim()}
                    className="w-full h-12 text-base bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    size="lg"
                  >
                    {processing || isProcessingQ10 ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {isProcessingQ10 ? "Procesando Q10..." : "Procesando..."}
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Continuar
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-900">
                    <strong>Tip:</strong> El estudiante debe mostrar su documento de identidad para verificar el número.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResult} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              {scanResult?.status === "success" && <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />}
              {scanResult?.status === "no_cupos" && <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />}
              Resultado del Proceso
              {realtimeStudentData && (
                <Badge
                  variant="outline"
                  className="ml-auto bg-green-50 text-green-700 border-green-200 animate-pulse text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  En vivo
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {scanResult && (
              <>
                <div className="bg-gradient-to-r from-lime-50 to-green-50 rounded-lg p-3 border border-lime-200">
                  <div className="flex items-center gap-2">
                    <div className="bg-white rounded-full p-1.5 shadow-sm">
                      <User className="w-4 h-4 text-lime-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-600 font-medium">Identificación</p>
                      <p className="text-base md:text-lg font-bold text-gray-900 truncate">
                        {scanResult.identificacion}
                      </p>
                    </div>
                  </div>
                </div>

                {scanResult.status === "success" && displayStudent && (
                  <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
                    <CardHeader className="pb-2 pt-3 px-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                      <CardTitle className="text-sm md:text-base flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                        Comida Entregada Exitosamente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-3 px-3 pb-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <GraduationCap className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-600 font-medium">Nombre Completo</p>
                            <p className="text-xs md:text-sm font-bold text-gray-900 break-words">
                              {displayStudent.nombre}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-600 font-medium">Programa Académico</p>
                            <p className="text-xs md:text-sm font-semibold text-gray-800 break-words">
                              {displayStudent.programa}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Utensils className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-600 font-medium">Bufete de Entrega</p>
                            <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs">
                              Bufete {user.mesaAsignada}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border-2 border-green-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs md:text-sm font-semibold text-gray-700">Bufetes Disponibles</span>
                          </div>
                          <span className="text-xl md:text-2xl font-bold text-green-600">{cuposDisponibles}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10px] md:text-xs">
                          <div className="bg-gray-50 rounded p-1.5">
                            <p className="text-gray-600">Total</p>
                            <p className="font-bold text-gray-900 text-sm">{2 + (displayStudent.cuposExtras || 0)}</p>
                          </div>
                          <div className="bg-orange-50 rounded p-1.5">
                            <p className="text-orange-600">Consumidos</p>
                            <p className="font-bold text-orange-700 text-sm">{displayStudent.cuposConsumidos || 0}</p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${(cuposDisponibles / (2 + (displayStudent.cuposExtras || 0))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-[10px] md:text-xs text-green-700 bg-green-100 p-2 rounded-lg font-medium text-center">
                        {scanResult.message}
                        {scanResult.source === "q10" && (
                          <Badge
                            variant="outline"
                            className="ml-2 bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                          >
                            Q10
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scanResult.status === "no_cupos" && (
                  <Alert variant="destructive" className="border-red-300 bg-red-50">
                    <XCircle className="h-4 w-4 md:h-5 md:w-5" />
                    <AlertDescription className="text-xs md:text-sm font-medium">{scanResult.message}</AlertDescription>
                  </Alert>
                )}

                {scanResult.status === "error" && (
                  <Alert variant="destructive" className="border-orange-300 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                    <AlertDescription className="text-xs md:text-sm font-medium text-orange-800">
                      {scanResult.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-[10px] md:text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Procesado el {new Date(scanResult.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={resetScanner}
              className="flex-1 bg-gradient-to-r from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 h-10 text-xs md:text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5" />
              Procesar Otro
            </Button>
            <Button
              variant="outline"
              onClick={() => handleModalClose(false)}
              className="border-gray-300 h-10 text-xs md:text-sm px-4"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
