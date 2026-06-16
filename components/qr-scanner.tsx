"use client"

import { useRef, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, X, CheckCircle2, AlertCircle, ScanLine, RefreshCw, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, onSnapshot } from "firebase/firestore"
import { BrowserQRCodeReader } from "@zxing/library"

interface QRScannerProps {
  onClose?: () => void
}

interface GBJPMemberData {
  id: string
  puesto: string
  puestosDisponibles?: string[]
  puestosConsumidos?: string[]
  identificacion: string | number
  nombres: string
  fechaAsignacion: string
}

interface ValidationRecord {
  identificacion: string
  nombres: string
  puesto: string
  documentoId?: string
  horaValidacion: Timestamp
  estado: "Validado" | "Rechazado"
}

export default function QRScanner({ onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [memberInfo, setMemberInfo] = useState<GBJPMemberData | null>(null)
  const [recentValidations, setRecentValidations] = useState<ValidationRecord[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [showPuestoSelector, setShowPuestoSelector] = useState(false)
  const [selectedPuesto, setSelectedPuesto] = useState<string | null>(null)
  const [selectedPuestos, setSelectedPuestos] = useState<string[]>([])
  const [isDetectingQR, setIsDetectingQR] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const detectedQRRef = useRef<string | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const validationInProgressRef = useRef<boolean>(false)
  const scanningRef = useRef<boolean>(false)
  const showPuestoSelectorRef = useRef<boolean>(false)
  const scanStartedRef = useRef<boolean>(false)

  useEffect(() => {
    showPuestoSelectorRef.current = showPuestoSelector
  }, [showPuestoSelector])

  useEffect(() => {
    scanningRef.current = scanning
  }, [scanning])

  useEffect(() => {
    const timer = setTimeout(() => {
      startScanning()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const startScanLoop = async () => {
    if (!videoRef.current || !streamRef.current || scanStartedRef.current) return
    scanStartedRef.current = true

    const video = videoRef.current
    codeReaderRef.current = new BrowserQRCodeReader()

    try {
      await codeReaderRef.current.decodeFromStream(streamRef.current, video, (result, err) => {
        if (!scanningRef.current || validationInProgressRef.current || showPuestoSelectorRef.current) return

        if (result) {
          const code = result.getText()
          const currentTime = Date.now()

          if (detectedQRRef.current !== code || currentTime - lastScanTimeRef.current > 1500) {
            detectedQRRef.current = code
            lastScanTimeRef.current = currentTime
            setIsDetectingQR(true)
            validationInProgressRef.current = true

            if (navigator.vibrate) {
              navigator.vibrate(200)
            }

            processQRData(code)
          }
        }
      })
    } catch (err) {
      console.error("[ZXing] Error en decodeFromStream:", err)
      scanStartedRef.current = false
    }
  }

  const startScanning = async () => {
    try {
      setCameraLoading(true)
      setError(null)
      detectedQRRef.current = null
      lastScanTimeRef.current = 0
      validationInProgressRef.current = false
      scanStartedRef.current = false

      const constraints = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        {
          video: { facingMode: "environment" },
        },
        {
          video: true,
        },
      ]

      let mediaStream: MediaStream | null = null
      let lastError: any = null

      for (const constraint of constraints) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraint)
          break
        } catch (err: any) {
          lastError = err
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      if (!mediaStream) {
        throw lastError || new Error("No se pudo iniciar la cámara")
      }

      streamRef.current = mediaStream

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error("[QR] Error reproduciendo video:", err)
            setError("No se pudo iniciar la reproducción de video")
          })
        }

        videoRef.current.onplaying = () => {
          setCameraLoading(false)
          setScanning(true)
          scanningRef.current = true
          setScanResult(null)
          setMemberInfo(null)
          setManualInput("")
          startScanLoop()
        }

        videoRef.current.onerror = () => {
          setCameraLoading(false)
          setError("Error al acceder a la cámara")
        }
      }
    } catch (err: any) {
      setCameraLoading(false)
      console.error("[QR] Error accediendo a cámara:", err.name, err.message)
      if (err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.")
      } else if (err.name === "NotFoundError") {
        setError("No se encontró cámara en el dispositivo.")
      } else if (err.name === "NotReadableError") {
        setError("La cámara ya está siendo utilizada por otra aplicación.")
      } else {
        setError(`Error de cámara: ${err.message}`)
      }
    }
  }

  const processQRData = async (qrData: string) => {
    try {
      const cleanData = qrData.trim()

      const identificacion = cleanData

      if (identificacion && identificacion.length > 0) {
        setScanResult(identificacion)
        await validateMemberByIdentification(identificacion)
      } else {
        setError("El código QR está vacío")
        setIsDetectingQR(false)
        detectedQRRef.current = null
        validationInProgressRef.current = false

        setTimeout(() => {
          setError(null)
          detectedQRRef.current = null
        }, 2000)
      }
    } catch (err: any) {
      setError(`Error procesando QR: ${err.message}`)
      setIsDetectingQR(false)
      detectedQRRef.current = null
      validationInProgressRef.current = false

      setTimeout(() => {
        setError(null)
        detectedQRRef.current = null
      }, 2000)
    }
  }

  const validateMemberByIdentification = async (identification: string) => {
    if (!identification.trim()) {
      setError("Identificación vacía")
      detectedQRRef.current = null
      validationInProgressRef.current = false
      setTimeout(() => setError(null), 2000)
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const membersRef = collection(db, "gbjp")

      let q = query(membersRef, where("identificacion", "==", identification))
      let querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        const idAsNumber = Number.parseInt(identification, 10)
        if (!isNaN(idAsNumber)) {
          q = query(membersRef, where("identificacion", "==", idAsNumber))
          querySnapshot = await getDocs(q)
        }
      }

      if (querySnapshot.empty) {
        setError(`Miembro no encontrado con ID: ${identification}`)
        setMemberInfo(null)
        setIsDetectingQR(false)
        detectedQRRef.current = null
        validationInProgressRef.current = false
        setIsValidating(false)
        setTimeout(() => {
          setError(null)
          detectedQRRef.current = null
        }, 2000)
        return
      }

      const allMemberDocs = querySnapshot.docs

      const validationsRef = collection(db, "validaciones_qr_gbjp")
      const validationsQuery = query(validationsRef, where("identificacion", "==", String(identification)))
      const validationsSnapshot = await getDocs(validationsQuery)

      const documentosValidados: string[] = []
      validationsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.documentoId && data.estado === "Validado") {
          documentosValidados.push(data.documentoId)
        }
      })

      const documentosDisponibles = allMemberDocs.filter((doc) => !documentosValidados.includes(doc.id))

      if (documentosDisponibles.length === 0) {
        const memberData = allMemberDocs[0].data()
        setError(
          `Todos los puestos de ${memberData.nombres} ya han sido validados (${allMemberDocs.length}/${allMemberDocs.length})`,
        )
        setIsDetectingQR(false)
        detectedQRRef.current = null
        validationInProgressRef.current = false
        setIsValidating(false)
        setTimeout(() => {
          setError(null)
          detectedQRRef.current = null
        }, 2000)
        return
      }

      const firstDoc = documentosDisponibles[0]
      const firstDocData = firstDoc.data()

      const puestosDisponibles = documentosDisponibles.map((doc) => doc.data().puesto)
      const puestosValidados = documentosValidados.length

      const member: GBJPMemberData = {
        id: firstDoc.id,
        puesto: firstDocData.puesto,
        puestosDisponibles,
        puestosConsumidos: [],
        identificacion: firstDocData.identificacion,
        nombres: firstDocData.nombres,
        fechaAsignacion: firstDocData.fechaAsignacion,
      }

      setMemberInfo(member)
      setScanResult(identification)

      if (documentosDisponibles.length > 1) {
        setShowPuestoSelector(true)
        ;(member as any).documentosDisponibles = documentosDisponibles
        setIsValidating(false)
      } else {
        await consumePuestoDocumento(member, firstDoc.id, firstDocData.puesto)
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`)
      setIsDetectingQR(false)
      detectedQRRef.current = null
      validationInProgressRef.current = false
      setTimeout(() => {
        setError(null)
        detectedQRRef.current = null
      }, 2000)
    } finally {
      if (!showPuestoSelector) {
        setIsValidating(false)
      }
    }
  }

  const consumePuestoDocumento = async (member: GBJPMemberData, documentoId: string, puesto: string) => {
    try {
      setIsValidating(true)

      await recordValidation({
        identificacion: String(member.identificacion),
        nombres: member.nombres,
        puesto: String(puesto).trim(),
        documentoId: documentoId,
        estado: "Validado",
      })

      setSelectedPuesto(puesto)
      setShowPuestoSelector(false)
      await loadRecentValidations()

      setTimeout(() => {
        resetScannerState()
      }, 1500)
    } catch (err: any) {
      setError(`Error validando puesto: ${err.message}`)
      validationInProgressRef.current = false

      setTimeout(() => {
        setError(null)
        detectedQRRef.current = null
        setIsDetectingQR(false)
      }, 2000)
    } finally {
      setIsValidating(false)
    }
  }

  const consumeSelectedPuestos = async () => {
    if (!memberInfo || selectedPuestos.length === 0) {
      setError("Por favor selecciona al menos un puesto")
      return
    }

    const docs = (memberInfo as any).documentosDisponibles as any[]

    try {
      setIsValidating(true)

      for (const puesto of selectedPuestos) {
        const docForPuesto = docs.find((doc: any) => doc.data().puesto === puesto)

        if (docForPuesto) {
          await recordValidation({
            identificacion: String(memberInfo.identificacion),
            nombres: memberInfo.nombres,
            puesto: String(puesto).trim(),
            documentoId: docForPuesto.id,
            estado: "Validado",
          })
        }
      }

      setSelectedPuestos([])
      setShowPuestoSelector(false)
      setSelectedPuesto(selectedPuestos.join(", "))
      await loadRecentValidations()

      setTimeout(() => {
        resetScannerState()
      }, 1500)
    } catch (err: any) {
      setError(`Error consumiendo puestos: ${err.message}`)
      validationInProgressRef.current = false

      setTimeout(() => {
        setError(null)
        detectedQRRef.current = null
        setIsDetectingQR(false)
      }, 2000)
    } finally {
      setIsValidating(false)
    }
  }

  const togglePuestoSelection = (puesto: string) => {
    setSelectedPuestos((prev) => {
      if (prev.includes(puesto)) {
        return prev.filter((p) => p !== puesto)
      } else {
        return [...prev, puesto]
      }
    })
  }

  const stopScanning = () => {
    scanningRef.current = false
    scanStartedRef.current = false

    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset()
      } catch (e) {
        console.error("[ZXing] Error resetting reader:", e)
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setScanning(false)
    setIsDetectingQR(false)
    detectedQRRef.current = null
    validationInProgressRef.current = false
  }

  const recordValidation = async (data: Omit<ValidationRecord, "horaValidacion">) => {
    try {
      const validationsRef = collection(db, "validaciones_qr_gbjp")
      await addDoc(validationsRef, {
        ...data,
        puesto: String(data.puesto).trim(),
        horaValidacion: serverTimestamp(),
      })
    } catch (err) {
      console.error("[ERROR REGISTRO]:", err)
    }
  }

  const loadRecentValidations = async () => {
    try {
      const validationsRef = collection(db, "validaciones_qr_gbjp")
      const q = query(validationsRef)
      const querySnapshot = await getDocs(q)

      const validations: ValidationRecord[] = []
      querySnapshot.forEach((doc) => {
        validations.push(doc.data() as ValidationRecord)
      })

      validations.sort((a, b) => {
        const timeA = a.horaValidacion instanceof Timestamp ? a.horaValidacion.toMillis() : 0
        const timeB = b.horaValidacion instanceof Timestamp ? b.horaValidacion.toMillis() : 0
        return timeB - timeA
      })

      setRecentValidations(validations.slice(0, 5))
    } catch (err) {
      console.error("[ERROR CARGANDO]:", err)
    }
  }

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "validaciones_qr_gbjp"),
      (snapshot) => {
        const validations: ValidationRecord[] = []
        snapshot.forEach((doc) => {
          validations.push(doc.data() as ValidationRecord)
        })

        validations.sort((a, b) => {
          const timeA = a.horaValidacion instanceof Timestamp ? a.horaValidacion.toMillis() : 0
          const timeB = b.horaValidacion instanceof Timestamp ? b.horaValidacion.toMillis() : 0
          return timeB - timeA
        })

        setRecentValidations(validations.slice(0, 5))
      },
      (error) => {
        console.error("[v0] Error escuchando validaciones en tiempo real:", error)
      },
    )

    return () => unsubscribe()
  }, [])

  const formatTime = (timestamp: any) => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleTimeString("es-CO")
    }
    return new Date().toLocaleTimeString("es-CO")
  }

  const handleQRInput = () => {
    if (manualInput.trim()) {
      validateMemberByIdentification(manualInput.trim())
    }
  }

  const resetScannerState = () => {
    setMemberInfo(null)
    setScanResult(null)
    setError(null)
    setSelectedPuesto(null)
    setSelectedPuestos([])
    setIsDetectingQR(false)
    detectedQRRef.current = null
    validationInProgressRef.current = false
    showPuestoSelectorRef.current = false
  }

  const resetScanner = () => {
    resetScannerState()
    setShowPuestoSelector(false)
    showPuestoSelectorRef.current = false
  }

  const handleCancelPuestoSelector = () => {
    setShowPuestoSelector(false)
    showPuestoSelectorRef.current = false
    setSelectedPuestos([])
    validationInProgressRef.current = false
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 mt-16 md:mt-0 space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#ccff00] via-[#e91e63] to-[#0099ff] bg-clip-text text-transparent mb-2">
            Escáner QR - GBJP
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Escaneo automático continuo - Pasa cada QR frente a la cámara - Se detecta automáticamente
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Cámara QR - Escaneo Continuo</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Pasa cada QR frente a la cámara - Se detecta automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "4/5" }}>
                {scanning || cameraLoading ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {cameraLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-3 border-[#ccff00] border-t-transparent rounded-full animate-spin" />
                          <p className="text-[#ccff00] text-sm font-medium">Iniciando cámara...</p>
                        </div>
                      </div>
                    )}

                    {scanning && !cameraLoading && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div
                            className={`absolute w-64 h-64 border-4 rounded-xl transition-all duration-200 ${
                              isDetectingQR ? "border-green-400 shadow-lg scale-105" : "border-[#ccff00] animate-pulse"
                            }`}
                            style={{
                              boxShadow: isDetectingQR
                                ? "0 0 30px rgba(74, 222, 128, 0.8)"
                                : "0 0 20px rgba(204, 255, 0, 0.5)",
                            }}
                          />
                        </div>

                        <div className="absolute top-4 left-4 right-4">
                          <div className="bg-black/70 px-3 py-2 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${isDetectingQR ? "bg-green-400 animate-ping" : "bg-[#ccff00] animate-pulse"}`}
                                ></div>
                                <span
                                  className={`text-xs font-semibold ${isDetectingQR ? "text-green-400" : "text-[#ccff00]"}`}
                                >
                                  {isDetectingQR ? "QR Detectado" : "Listo para escanear"}
                                </span>
                              </div>
                              {isValidating && (
                                <span className="text-xs text-blue-400 font-semibold">Validando...</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black">
                    <Camera className="w-20 h-20 text-[#0099ff] mb-4" />
                    <p className="text-gray-300 text-center text-sm font-medium">
                      {memberInfo ? "Miembro validado" : "Activando cámara..."}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                {!scanning && !cameraLoading ? (
                  <Button
                    onClick={startScanning}
                    disabled={isValidating}
                    className="flex-1 bg-gradient-to-r from-[#ccff00] to-[#e91e63] text-white hover:opacity-90 gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Reactivar Cámara
                  </Button>
                ) : (
                  <Button onClick={stopScanning} variant="outline" className="flex-1 bg-transparent gap-2">
                    <X className="w-4 h-4" />
                    Detener Cámara
                  </Button>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground mb-2">O ingresa manualmente:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Número de identificación..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQRInput()}
                    disabled={isValidating}
                    className="flex-1 px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e91e63] bg-background text-foreground text-sm disabled:opacity-50"
                  />
                  <Button
                    onClick={handleQRInput}
                    size="sm"
                    disabled={isValidating || !manualInput.trim()}
                    className="bg-gradient-to-r from-[#0099ff] to-[#0077cc] text-white hover:opacity-90"
                  >
                    {isValidating ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Validar"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Resultado</CardTitle>
            <CardDescription className="text-xs md:text-sm">Información del miembro y puestos</CardDescription>
          </CardHeader>
          <CardContent>
            {showPuestoSelector && memberInfo ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <p className="text-blue-800 dark:text-blue-200 text-lg font-bold">
                        Múltiples Puestos Disponibles
                      </p>
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        {memberInfo.nombres} tiene {memberInfo.puestosDisponibles?.length} puestos pendientes
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-2">Selecciona los puestos a consumir:</p>
                    {memberInfo.puestosDisponibles?.map((puesto, index) => (
                      <div
                        key={index}
                        className="border border-border rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => togglePuestoSelection(puesto)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedPuestos.includes(puesto)}
                            onCheckedChange={() => togglePuestoSelection(puesto)}
                            disabled={isValidating}
                            className="data-[state=checked]:bg-[#e91e63] data-[state=checked]:border-[#e91e63]"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{puesto}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedPuestos.length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        {selectedPuestos.length}{" "}
                        {selectedPuestos.length === 1 ? "puesto seleccionado" : "puestos seleccionados"}
                      </p>
                      <Button
                        onClick={consumeSelectedPuestos}
                        disabled={isValidating}
                        className="w-full justify-center bg-gradient-to-r from-[#ccff00] to-[#e91e63] text-white hover:opacity-90"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {isValidating
                          ? "Consumiendo..."
                          : `Consumir ${selectedPuestos.length} ${selectedPuestos.length === 1 ? "puesto" : "puestos"}`}
                      </Button>
                    </div>
                  )}
                </div>

                <Button onClick={handleCancelPuestoSelector} variant="outline" className="w-full bg-transparent">
                  Cancelar y Continuar Escaneo
                </Button>
              </div>
            ) : memberInfo && selectedPuesto ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-green-800 dark:text-green-200 text-lg font-bold mb-1">Validación Exitosa</p>
                      <p className="text-green-700 dark:text-green-300 text-sm">
                        Puesto &quot;{selectedPuesto}&quot; consumido correctamente
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#ccff00]/5 via-[#e91e63]/5 to-[#0099ff]/5 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#ccff00] to-[#e91e63] flex items-center justify-center text-white font-bold text-lg">
                      {memberInfo.identificacion.toString().slice(-2)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Miembro</p>
                      <p className="font-bold text-foreground text-lg">{memberInfo.nombres}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Puesto Validado</p>
                      <p className="font-semibold text-foreground text-sm">{selectedPuesto}</p>
                    </div>
                    <div className="bg-background rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <Badge className="bg-green-500">Consumido</Badge>
                    </div>
                  </div>

                  {memberInfo.puestosConsumidos && memberInfo.puestosConsumidos.length > 0 && (
                    <div className="bg-background rounded-lg p-2 mt-2">
                      <p className="text-xs text-muted-foreground">Puestos Consumidos</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {memberInfo.puestosConsumidos.map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Volviendo al escaneo automático...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ScanLine className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
                <p className="text-muted-foreground text-center text-sm">
                  {isValidating ? "Validando en base de datos..." : "Esperando código QR..."}
                </p>
                {scanResult && !memberInfo && (
                  <div className="mt-4 p-2 bg-muted rounded text-xs font-mono text-muted-foreground">
                    ID: {scanResult}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Validaciones Recientes
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Últimas validaciones realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentValidations.length > 0 ? (
              recentValidations.map((validation, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{
                        background: "linear-gradient(to right, #ccff00, #e91e63)",
                      }}
                    >
                      {validation.puesto}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{validation.nombres}</p>
                      <p className="text-xs text-muted-foreground">{validation.puesto}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(validation.horaValidacion)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500">{validation.estado}</Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No hay validaciones registradas aún</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
