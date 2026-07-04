"use client"

import { CardHeader } from "@/components/ui/card"

import { useState, useRef, useEffect, useCallback } from "react"
import { useFastQRScanner } from "@/hooks/use-fast-qr-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  CameraOff,
  CheckCircle,
  XCircle,
  Search,
  User,
  AlertTriangle,
  RefreshCw,
  Shield,
  CameraIcon,
  Loader2Icon,
  GraduationCap,
  MapPin,
  Ticket,
  Clock,
  Award,
  QrCode,
  Hash,
} from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info" | "already_scanned"
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual"
  timestamp: string
}

export function OperativoScanner() {
  const { user, fullName, activeRole } = useAuth()
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()

  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null)
  const [manualId, setManualId] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr")
  const [realtimeStudentData, setRealtimeStudentData] = useState<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const scanner = useFastQRScanner({
    onQRDetected: (data) => processScanResult(data, "direct"),
    cooldown: 800,
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isClient) return
    const timer = setTimeout(() => {
      if (mountedRef.current) scanner.startCamera()
    }, 500)
    return () => clearTimeout(timer)
  }, [isClient])

  useEffect(() => {
    if (scanResultDisplay?.identificacion && scanResultDisplay.type === "success") {
      const studentDocRef = doc(db, "estudiantes", scanResultDisplay.identificacion)

      unsubscribeRef.current = onSnapshot(
        studentDocRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data()
            setRealtimeStudentData(updatedData)
          }
        },
        (error) => {
          console.error("[v0] Error in realtime listener:", error)
        },
      )

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
    }
  }, [scanResultDisplay?.identificacion, scanResultDisplay?.type])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      if (processing) {
        return
      }

      setProcessing(true)

      scannedContent = scannedContent.trim()

      if (
        source !== "q10" &&
        !scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") &&
        !scannedContent.startsWith("https://site6.q10.com/CertificadosAcademicos/") &&
        !scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
      ) {
        const len = scannedContent.trim().length
        if (len < 3 || len > 10) {
          setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${len})`)
          setProcessing(false)
          scanner.resetDetection()
          return
        }
      }

      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: fullName || user.fullName || "Usuario Operativo",
            userEmail: user.idNumber + "@sistema.com",
            userRole: activeRole || "operativo",
          }
        : undefined

      if (
        scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") ||
        scannedContent.startsWith("https://site6.q10.com/CertificadosAcademicos/") ||
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

        const q10Result = await processQ10Url(scannedContent)

        if (q10Result.success && q10Result.student) {
          const alreadyScanned = await checkIfAlreadyScanned(q10Result.identificacion!)

          if (alreadyScanned) {
            currentScanResult = {
              type: "already_scanned",
              identificacion: q10Result.identificacion!,
              person: q10Result.student,
              message: `Este código ya fue escaneado anteriormente. Mostrando información del estudiante.`,
              source: "q10",
              timestamp: new Date().toISOString(),
            }
            setScanResultDisplay(currentScanResult)
            setProcessing(false)
            scanner.resetDetection()
            return
          }

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
        setProcessing(false)
        scanner.resetDetection()
        return
      } else {
        const alreadyScanned = await checkIfAlreadyScanned(scannedContent)

        if (alreadyScanned) {
          const student = await getStudentById(scannedContent)
          currentScanResult = {
            type: "already_scanned",
            identificacion: scannedContent,
            person: student,
            message: student
              ? `Este código ya fue escaneado anteriormente. Mostrando información del estudiante.`
              : `Este código ya fue escaneado anteriormente. No se encontró información adicional.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
          setScanResultDisplay(currentScanResult)
          setProcessing(false)
          scanner.resetDetection()
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
      setProcessing(false)
      scanner.resetDetection()
    },
    [getStudentById, markStudentAccess, processQ10Url, user, checkIfAlreadyScanned, processing, fullName, activeRole],
  )

  const processStudentAccess = async (id: string) => {
    setProcessing(true)
    setScanResultDisplay({
      type: "info",
      identificacion: id,
      message: "Validando identificación manual...",
      timestamp: new Date().toISOString(),
    })
    setError(null)

    try {
      await processScanResult(id, "manual")
    } catch (err) {
      setScanResultDisplay({
        type: "error",
        identificacion: id,
        message: "Error al validar la identificación manual.",
        timestamp: new Date().toISOString(),
      })
    } finally {
      setProcessing(false)
    }
  }

  const resetScanner = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    setScanResultDisplay(null)
    setRealtimeStudentData(null)
    setError(null)
    setManualId("")
    setProcessing(false)
    scanner.resetDetection()
  }

  const displayPerson = realtimeStudentData || scanResultDisplay?.person
  const cuposDisponibles = displayPerson
    ? 2 + (displayPerson.cuposExtras || 0) - (displayPerson.cuposConsumidos || 0)
    : 0

  if (activeRole !== "operativo") {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Esta funcionalidad solo está disponible para usuarios con rol "Operativo"</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <Loader2Icon className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando escáner...</p>
      </div>
    )
  }

  if (scanner.permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <CameraOff className="text-destructive mb-6 size-20" />
        <h3 className="text-2xl font-bold mb-3 text-foreground">Acceso a la cámara denegado</h3>
        <p className="text-muted-foreground mb-8 text-base">
          {scanner.error || "Se requiere acceso a la cámara para escanear códigos de barras."}
        </p>
        <Button
          onClick={() => scanner.startCamera()}
          className="bg-primary text-primary-foreground h-12 px-6 text-base rounded-md"
        >
          <CameraIcon className="mr-2 size-5" />
          Permitir acceso a la cámara
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 bg-gradient-to-br from-purple-50 to-violet-50 min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-purple-900">Control de Acceso al Evento</h1>
          <p className="text-sm md:text-base text-purple-700">
            Escanea QR o ingresa identificación para dar acceso al evento
          </p>
        </div>

        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
          <Shield className="w-3 h-3 md:w-4 md:h-4 mr-1" />
          Control de Acceso
        </Badge>

        <Card className="w-full max-w-2xl bg-white shadow-lg border-purple-200">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-center mb-4 text-purple-900">
              Escanea QR o ingresa identificación
            </h2>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "qr" | "manual")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-purple-100">
                <TabsTrigger
                  value="qr"
                  className="text-sm md:text-base data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Escanear QR
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="text-sm md:text-base data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Ingreso Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="space-y-4 mt-0">
                {(error || scanner.error) && activeTab === "qr" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error || scanner.error}</AlertDescription>
                  </Alert>
                )}

                <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-purple-200">
                  <video
                    ref={scanner.videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <canvas ref={scanner.canvasRef} className="hidden" />
                  {scanner.cameraLoading && !scanner.isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-purple-400 text-sm font-medium">Iniciando cámara...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-purple-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-purple-500 animate-scan"></div>
                  </div>
                </div>

                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700">
                    {scanner.isDetecting ? (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        QR Detectado
                      </span>
                    ) : processing ? (
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
                    <Label htmlFor="manual-id" className="text-base text-purple-900">
                      Número de Identificación
                    </Label>
                    <Input
                      id="manual-id"
                      type="text"
                      placeholder="Ej: 1065123456"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key !== "Enter" || !manualId.trim() || processing) return
                        const id = manualId.trim()
                        if (id.length < 3 || id.length > 10) {
                          setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${id.length})`)
                          return
                        }
                        processStudentAccess(id)
                        setManualId("")
                      }}
                      disabled={processing}
                      className="text-lg h-12 border-purple-300 focus:border-purple-500"
                    />
                    <p className="text-xs text-purple-600">Ingresa el número de cédula del estudiante</p>
                  </div>

                  <Button
                    onClick={() => {
                      const id = manualId.trim()
                      if (!id) return
                      if (id.length < 3 || id.length > 10) {
                        setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${id.length})`)
                        return
                      }
                      processStudentAccess(id)
                      setManualId("")
                    }}
                    disabled={processing || !manualId.trim()}
                    className="w-full h-12 text-base bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white"
                    size="lg"
                  >
                    {processing ? (
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

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-xs text-purple-900">
                    <strong>Tip:</strong> El estudiante debe mostrar su documento de identidad para verificar el número.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={scanResultDisplay !== null} onOpenChange={resetScanner}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {scanResultDisplay?.type === "success" && <CheckCircle className="w-6 h-6 text-green-600" />}
              {scanResultDisplay?.type === "already_scanned" && <AlertTriangle className="w-6 h-6 text-yellow-600" />}
              {scanResultDisplay?.type === "denied" && <XCircle className="w-6 h-6 text-red-600" />}
              {scanResultDisplay?.type === "error" && <AlertTriangle className="w-6 h-6 text-orange-600" />}
              {scanResultDisplay?.type === "info" && <Loader2Icon className="w-6 h-6 animate-spin text-blue-600" />}
              Control de Acceso
              {realtimeStudentData && (
                <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200 animate-pulse">
                  <Clock className="w-3 h-3 mr-1" />
                  En vivo
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanResultDisplay && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-full p-2 shadow-sm">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 font-medium">Identificación</p>
                      <p className="text-lg font-bold text-gray-900">{scanResultDisplay.identificacion}</p>
                    </div>
                    {scanResultDisplay.source && (
                      <Badge variant="outline" className="text-xs">
                        {scanResultDisplay.source === "q10"
                          ? "Q10"
                          : scanResultDisplay.source === "manual"
                            ? "Manual"
                            : "QR"}
                      </Badge>
                    )}
                  </div>
                </div>

                {scanResultDisplay.type === "success" && displayPerson && (
                  <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
                    <CardHeader className="pb-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
                      <h2 className="text-base flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Acceso Concedido al Evento
                      </h2>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <GraduationCap className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium">Nombre Completo</p>
                            <p className="text-sm font-bold text-gray-900">{displayPerson.nombre}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium">Programa Académico</p>
                            <p className="text-sm font-semibold text-gray-800">{displayPerson.programa}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Award className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium">Puesto Asignado</p>
                            <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                              Silla {displayPerson.puesto}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-green-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-semibold text-gray-700">Bufetes Disponibles</span>
                          </div>
                          <span className="text-2xl font-bold text-green-600">{cuposDisponibles}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-gray-600">Total</p>
                            <p className="font-bold text-gray-900">{2 + (displayPerson.cuposExtras || 0)}</p>
                          </div>
                          <div className="bg-blue-50 rounded p-2">
                            <p className="text-blue-600">Extras</p>
                            <p className="font-bold text-blue-700">{displayPerson.cuposExtras || 0}</p>
                          </div>
                          <div className="bg-orange-50 rounded p-2">
                            <p className="text-orange-600">Usados</p>
                            <p className="font-bold text-orange-800">{displayPerson.cuposConsumidos || 0}</p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${(cuposDisponibles / (2 + (displayPerson.cuposExtras || 0))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-xs text-green-700 bg-green-100 p-3 rounded-lg font-medium text-center">
                        ¡Bienvenido al evento de graduación!
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scanResultDisplay.type === "already_scanned" && displayPerson && (
                  <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg">
                    <CardHeader className="pb-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-t-lg">
                      <h2 className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Ya Registrado Anteriormente
                      </h2>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <GraduationCap className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-yellow-700 font-medium">Nombre Completo</p>
                            <p className="text-sm font-bold text-yellow-900">{displayPerson.nombre}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-yellow-700 font-medium">Programa Académico</p>
                            <p className="text-sm font-semibold text-yellow-800">{displayPerson.programa}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Award className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-yellow-700 font-medium">Puesto Asignado</p>
                            <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold">
                              Silla {displayPerson.puesto}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-yellow-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-semibold text-yellow-800">Bufetes Disponibles</span>
                          </div>
                          <span className="text-2xl font-bold text-yellow-600">{cuposDisponibles}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-yellow-50 rounded p-2">
                            <p className="text-yellow-700">Total</p>
                            <p className="font-bold text-yellow-900">{2 + (displayPerson.cuposExtras || 0)}</p>
                          </div>
                          <div className="bg-yellow-100 rounded p-2">
                            <p className="text-yellow-700">Extras</p>
                            <p className="font-bold text-yellow-800">{displayPerson.cuposExtras || 0}</p>
                          </div>
                          <div className="bg-amber-100 rounded p-2">
                            <p className="text-amber-700">Usados</p>
                            <p className="font-bold text-amber-800">{displayPerson.cuposConsumidos || 0}</p>
                          </div>
                        </div>

                        <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${(cuposDisponibles / (2 + (displayPerson.cuposExtras || 0))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-xs text-yellow-800 bg-yellow-100 p-3 rounded-lg font-medium text-center border border-yellow-300">
                        Este estudiante ya ingresó al evento previamente
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scanResultDisplay.type === "already_scanned" && !displayPerson && (
                  <Alert className="border-yellow-300 bg-yellow-50">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <AlertDescription className="text-sm font-medium text-yellow-800">
                      {scanResultDisplay.message}
                    </AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "error" && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <XCircle className="h-5 w-5 text-orange-600" />
                    <AlertDescription className="text-sm font-medium text-orange-800">
                      {scanResultDisplay.message}
                    </AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "denied" && (
                  <Alert variant="destructive" className="border-red-300 bg-red-50">
                    <XCircle className="h-5 w-5" />
                    <AlertDescription className="text-sm font-medium">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "info" && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Loader2Icon className="h-5 w-5 text-blue-600 animate-spin" />
                    <AlertDescription className="text-sm font-medium text-blue-800">
                      {scanResultDisplay.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Procesado el {new Date(scanResultDisplay.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={resetScanner}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Procesar Otro
            </Button>
            <Button variant="outline" onClick={resetScanner} className="border-gray-300 bg-transparent">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
