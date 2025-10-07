"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CameraOffIcon,
  CameraIcon,
  Loader2Icon,
  CheckCircle,
  XCircle,
  User,
  AlertTriangle,
  Search,
  RefreshCw,
  QrCode,
  Hash,
  Shield,
} from "lucide-react"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import { useAuth } from "@/components/auth-provider"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info"
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual"
  timestamp: string
}

export function AdvancedBarcodeScanner() {
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()
  const { user, fullName } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null)
  const [manualIdInput, setManualIdInput] = useState<string>("")
  const [isManualProcessing, setIsManualProcessing] = useState(false)
  const [manualInputError, setManualInputError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr")
  const [realtimeStudentData, setRealtimeStudentData] = useState<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const hints = new Map<DecodeHintType, any>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
    ])
    codeReader.current = new BrowserMultiFormatReader(hints)

    return () => {
      if (codeReader.current) {
        codeReader.current.reset()
      }
    }
  }, [isClient])

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput")
    console.log("[v0] Available video devices:", videoDevices.length)
    setDevices(videoDevices)

    // Buscar cámara trasera con múltiples criterios
    const backCamera = videoDevices.find(
      (device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("trasera") ||
        device.label.toLowerCase().includes("rear") ||
        device.label.toLowerCase().includes("environment") ||
        device.label.toLowerCase().includes("posterior"),
    )

    if (backCamera) {
      console.log("[v0] Back camera found:", backCamera.label)
      setSelectedDeviceId(backCamera.deviceId)
    } else if (videoDevices.length > 0) {
      console.log("[v0] Using first available camera:", videoDevices[0].label)
      setSelectedDeviceId(videoDevices[0].deviceId)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        setHasPermission(true)
        setError(null)
        activeStreamRef.current = stream
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
  }, [handleDevices, isClient])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      if (isScanning) {
        console.log("[v0] Scan already in progress, ignoring")
        return
      }

      setIsScanning(true)
      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: fullName || user.email || "Usuario",
            userEmail: user.email || undefined,
            userRole: user.role || "Usuario",
          }
        : undefined

      if (
        scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") ||
        scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
      ) {
        currentScanResult = {
          type: "info",
          identificacion: scannedContent,
          message: "Procesando certificado Q10...",
          source: "q10",
          timestamp: new Date().toISOString(),
        }
        setScanResultDisplay(currentScanResult)
        setShowResult(true)

        const q10Result = await processQ10Url(scannedContent)

        if (q10Result.success && q10Result.student) {
          await markStudentAccess(q10Result.identificacion!, true, "Acceso concedido al evento", "q10", userInfo)
          currentScanResult = {
            type: "success",
            identificacion: q10Result.identificacion!,
            person: q10Result.student,
            message: q10Result.message,
            source: "q10",
            timestamp: new Date().toISOString(),
          }
        } else {
          currentScanResult = {
            type: q10Result.type as "denied" | "error",
            identificacion: q10Result.identificacion || scannedContent,
            message: q10Result.message,
            source: "q10",
            timestamp: new Date().toISOString(),
          }
        }

        setScanResultDisplay(currentScanResult)
        setShowResult(true)

        setTimeout(() => {
          setShowResult(false)
          setScanResultDisplay(null)
          setIsScanning(false)
        }, 5000)
        return
      } else {
        const alreadyScanned = await checkIfAlreadyScanned(scannedContent)

        if (alreadyScanned) {
          currentScanResult = {
            type: "error",
            identificacion: scannedContent,
            message: `Este usuario ya fue escaneado anteriormente. No se puede volver a escanear.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
          setScanResultDisplay(currentScanResult)
          setShowResult(true)

          setTimeout(() => {
            setScanResultDisplay(null)
            setShowResult(false)
            setIsScanning(false)
          }, 4000)
          return
        }

        const student = await getStudentById(scannedContent)
        if (student) {
          await markStudentAccess(scannedContent, true, "Acceso concedido al evento", source, userInfo)
          currentScanResult = {
            type: "success",
            identificacion: scannedContent,
            person: student,
            message: `Acceso concedido al evento para ${student.nombre}.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        } else {
          await markStudentAccess(scannedContent, false, "Persona no encontrada", source, userInfo)
          currentScanResult = {
            type: "denied",
            identificacion: scannedContent,
            message: `Identificación ${scannedContent} no encontrada en la base de datos.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        }
      }

      setScanResultDisplay(currentScanResult)
      setShowResult(true)

      setTimeout(() => {
        setShowResult(false)
        setScanResultDisplay(null)
        setIsScanning(false)
      }, 5000)
    },
    [getStudentById, markStudentAccess, processQ10Url, user, checkIfAlreadyScanned, isScanning, fullName],
  )

  useEffect(() => {
    if (!isClient || !hasPermission || !selectedDeviceId || isProcessingQ10 || isScanning || !codeReader.current) {
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      console.warn("[v0] Elemento de video no listo para escanear.")
      return
    }

    setError(null)

    console.log("[v0] Iniciando escaneo continuo con dispositivo:", selectedDeviceId)
    codeReader.current
      .decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
        if (result) {
          if (!isScanning && !isProcessingQ10 && !isManualProcessing) {
            console.log("[v0] QR detectado:", result.getText())
            processScanResult(result.getText(), "direct")
          }
        }
        if (err && err.name !== "NotFoundException" && err.name !== "AbortException") {
          console.error("[v0] Error al escanear:", err)
          setError("Error en el escáner: " + err.message)
        }
      })
      .catch((err) => {
        console.error("[v0] Error al iniciar el escaneo continuo:", err)
        setError("Error al iniciar el escáner: " + err.message)
        codeReader.current?.reset()
      })

    return () => {
      if (codeReader.current) {
        console.log("[v0] Reseteando lector en cleanup...")
        codeReader.current.reset()
      }
      if (activeStreamRef.current) {
        const stream = activeStreamRef.current
        stream.getTracks().forEach((track) => {
          track.stop()
          console.log("[v0] Track stopped on unmount:", track.kind)
        })
      }
    }
  }, [isClient, hasPermission, selectedDeviceId, isProcessingQ10, isScanning, processScanResult])

  const requestCameraPermission = () => {
    if (!isClient) return
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        setHasPermission(true)
        setError(null)
        activeStreamRef.current = stream
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
  }

  const handleManualSubmit = async () => {
    if (!manualIdInput.trim()) {
      setManualInputError("Por favor, ingresa una identificación.")
      return
    }

    setIsManualProcessing(true)
    setManualInputError(null)
    setScanResultDisplay({
      type: "info",
      identificacion: manualIdInput,
      message: "Validando identificación manual...",
      timestamp: new Date().toISOString(),
    })
    setShowResult(true)
    setError(null)

    try {
      await processScanResult(manualIdInput.trim(), "manual")
    } catch (err) {
      console.error("Error al procesar identificación manual:", err)
      setScanResultDisplay({
        type: "error",
        identificacion: manualIdInput,
        message: "Error al validar la identificación manual.",
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
    } finally {
      setIsManualProcessing(false)
      setManualIdInput("")
    }
  }

  const resetScanner = () => {
    console.log("[v0] Resetting scanner...")
    setScanResultDisplay(null)
    setShowResult(false)
    setError(null)
    setManualIdInput("")
    setManualInputError(null)
    setIsScanning(false)

    // Limpiar cualquier timeout pendiente
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    // Limpiar cualquier listener de Firestore en cleanup
    if (unsubscribeRef.current) {
      console.log("[v0] Cleaning up Firestore listener")
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }

  useEffect(() => {
    if (scanResultDisplay?.identificacion && showResult && scanResultDisplay.type === "success") {
      console.log("[v0] Setting up realtime listener for:", scanResultDisplay.identificacion)

      const studentDocRef = doc(db, "estudiantes", scanResultDisplay.identificacion)

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
          console.log("[v0] Cleaning up Firestore listener")
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
    }
  }, [scanResultDisplay?.identificacion, showResult, scanResultDisplay?.type])

  const displayPerson = realtimeStudentData || scanResultDisplay?.person
  const cuposDisponibles = displayPerson
    ? 2 + (displayPerson.cuposExtras || 0) - (displayPerson.cuposConsumidos || 0)
    : 0

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <Loader2Icon className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando escáner...</p>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <CameraOffIcon className="text-destructive mb-6 size-20" />
        <h3 className="text-2xl font-bold mb-3 text-foreground">Acceso a la cámara denegado</h3>
        <p className="text-muted-foreground mb-8 text-base">
          {error || "Se requiere acceso a la cámara para escanear códigos de barras."}
        </p>
        <Button
          onClick={requestCameraPermission}
          className="bg-primary text-primary-foreground h-12 px-6 text-base rounded-md"
        >
          <CameraIcon className="mr-2 size-5" />
          Permitir acceso a la cámara
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-blue-900">Control de Acceso Administrativo</h1>
          <p className="text-sm md:text-base text-blue-700">
            Escanea QR o ingresa identificación para control de acceso
          </p>
        </div>

        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
          <Shield className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Administrador
        </Badge>

        <Card className="w-full max-w-2xl bg-white shadow-lg border-blue-200">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-center mb-4 text-blue-900">
              Escanea QR o ingresa identificación
            </h2>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "qr" | "manual")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-blue-100">
                <TabsTrigger
                  value="qr"
                  className="text-sm md:text-base data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear QR
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="text-sm md:text-base data-[state=active]:bg-blue-600 data-[state=active]:text-white"
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

                <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-blue-200">
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
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-blue-500 animate-scan"></div>
                  </div>
                </div>

                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    {isScanning ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2Icon className="w-4 h-4 animate-spin" />
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
                    <Label htmlFor="manual-id" className="text-base text-blue-900">
                      Número de Identificación
                    </Label>
                    <Input
                      id="manual-id"
                      type="text"
                      placeholder="Ej: 1065123456"
                      value={manualIdInput}
                      onChange={(e) => setManualIdInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && manualIdInput.trim() && !isManualProcessing) {
                          handleManualSubmit()
                        }
                      }}
                      disabled={isManualProcessing}
                      className="text-lg h-12 border-blue-300 focus:border-blue-500"
                    />
                    <p className="text-xs text-blue-600">Ingresa el número de cédula del estudiante</p>
                  </div>

                  <Button
                    onClick={handleManualSubmit}
                    disabled={isManualProcessing || !manualIdInput.trim()}
                    className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                    size="lg"
                  >
                    {isManualProcessing ? (
                      <>
                        <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
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

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResultDisplay?.type === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResultDisplay?.type === "denied" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResultDisplay?.type === "error" && <AlertTriangle className="w-5 h-5 text-red-600" />}
              {scanResultDisplay?.type === "info" && <Loader2Icon className="w-5 h-5 animate-spin text-blue-600" />}
              Resultado del Control de Acceso
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanResultDisplay && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Identificación:</span>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {scanResultDisplay.identificacion}
                  </Badge>
                </div>

                {scanResultDisplay.type === "success" && displayPerson && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-800">✅ Acceso Concedido al Evento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <span className="font-medium text-sm">Nombre:</span>
                        <p className="text-sm">{displayPerson.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Programa:</span>
                        <p className="text-sm">{displayPerson.programa}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Puesto:</span>
                        <p className="text-sm">{displayPerson.puesto}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Cupos Extras:</span>
                        <p className="text-sm">{displayPerson.cuposExtras || 0}</p>
                      </div>
                      <div className="text-xs text-green-700 bg-green-100 p-2 rounded">Bienvenido al evento</div>
                    </CardContent>
                  </Card>
                )}

                {scanResultDisplay.type === "error" && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <XCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "denied" && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "info" && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Loader2Icon className="h-4 w-4 text-blue-600 animate-spin" />
                    <AlertDescription className="text-blue-800">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Procesado el {new Date(scanResultDisplay.timestamp).toLocaleString()}
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
