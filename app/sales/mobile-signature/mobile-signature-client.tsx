"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { database, storage } from "@/lib/firebase"
import { ref as databaseRef, onValue, update, get } from "firebase/database"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { CheckCircle2, Loader2, PencilLine, RotateCcw } from "lucide-react"
import { toast } from "sonner"

function MobileSignatureFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando sesión...
      </div>
    </div>
  )
}

function MobileSignatureContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") || undefined
  const previewThanks = searchParams.get("previewThanks") === "1"

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState("pending")
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null)
  const [saleId, setSaleId] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [sessionRefPath, setSessionRefPath] = useState<string | null>(null)
  const [signerName, setSignerName] = useState("")
  const [signerDni, setSignerDni] = useState("")
  const [showThanks, setShowThanks] = useState(false)
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false)
  const [disclaimerType, setDisclaimerType] = useState<"new" | "used" | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)

  const signatureLocked = status === "closed" || status === "signed" || Boolean(signatureUrl)

  useEffect(() => {
    if (!sessionId) return

    let isMounted = true
    const primaryPath = `saleSignatureSessions/${sessionId}`
    const fallbackPath = `sales/${sessionId}/signatureSession`

    const resolveSession = async () => {
      try {
        const primarySnapshot = await get(databaseRef(database, primaryPath))
        if (primarySnapshot.exists()) {
          if (!isMounted) return
          setSessionRefPath(primaryPath)
          return
        }

        const fallbackSnapshot = await get(databaseRef(database, fallbackPath))
        if (fallbackSnapshot.exists()) {
          if (!isMounted) return
          setSessionRefPath(fallbackPath)
          return
        }
      } catch (error) {
        console.warn("No se pudo validar la sesión de firma, se continúa con la ruta principal.", error)
      }

      if (!isMounted) return
      setSessionRefPath(primaryPath)
    }

    resolveSession()

    return () => {
      isMounted = false
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || sessionRefPath) return
    setSessionRefPath(`saleSignatureSessions/${sessionId}`)
  }, [sessionId, sessionRefPath])

  useEffect(() => {
    if (!sessionRefPath) return

    const sessionRef = databaseRef(database, sessionRefPath)
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        setStatus("pending")
        setSignatureUrl(null)
        return
      }
      const sessionData = snapshot.val()
      setStatus(sessionData.status || "pending")
      setReceiptNumber(sessionData.receiptNumber ?? null)
      setSaleId(sessionData.saleId ?? null)
      setSignatureUrl(sessionData.signature?.url ?? null)
      setSignerName((prev) => prev || sessionData.signature?.signerName || "")
      setSignerDni((prev) => prev || sessionData.signature?.signerDni || "")
      if (sessionData.disclaimerAcceptedAt) {
        setHasAcceptedDisclaimer(true)
      }
    })

    update(sessionRef, {
      lastOpenedAt: new Date().toISOString(),
    }).catch(() => null)

    return () => unsubscribe()
  }, [sessionRefPath])

  useEffect(() => {
    if (!saleId) return
    let isMounted = true

    const loadSaleCondition = async () => {
      try {
        const saleSnapshot = await get(databaseRef(database, `sales/${saleId}`))
        if (!saleSnapshot.exists() || !isMounted) return
        const saleData = saleSnapshot.val()
        const items = Array.isArray(saleData.items) ? saleData.items : []
        const normalizedCategories = items
          .map((item: { category?: string }) => (item.category || "").toLowerCase())
          .filter(Boolean)

        if (normalizedCategories.some((category: string) => category.includes("celulares usados"))) {
          setDisclaimerType("used")
          return
        }
        if (normalizedCategories.some((category: string) => category.includes("celulares nuevos"))) {
          setDisclaimerType("new")
          return
        }
        setDisclaimerType(null)
      } catch (error) {
        console.warn("No se pudo cargar la condición del equipo:", error)
      }
    }

    loadSaleCondition()

    return () => {
      isMounted = false
    }
  }, [saleId])

  useEffect(() => {
    if (signatureUrl) {
      setShowThanks(true)
    }
  }, [signatureUrl])

  useEffect(() => {
    if (previewThanks) {
      setShowThanks(true)
    }
  }, [previewThanks])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === "undefined") return

    const parent = canvas.parentElement
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || parent?.clientWidth || 320
    const height = rect.height || 180
    const ratio = window.devicePixelRatio || 1

    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.strokeStyle = "#111827"
    }
  }, [])

  useEffect(() => {
    setupCanvas()
    if (typeof window === "undefined") return
    window.addEventListener("resize", setupCanvas)
    return () => window.removeEventListener("resize", setupCanvas)
  }, [setupCanvas])

  const getCanvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (signatureLocked) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.setPointerCapture(event.pointerId)
    const { x, y } = getCanvasPoint(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSignature(true)
  }, [getCanvasPoint, signatureLocked])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || signatureLocked) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { x, y } = getCanvasPoint(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [getCanvasPoint, isDrawing, signatureLocked])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    canvas?.releasePointerCapture(event.pointerId)
    setIsDrawing(false)
  }, [isDrawing])

  const handleClear = useCallback(() => {
    if (signatureLocked) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [signatureLocked])

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || !sessionId || signatureLocked) return
    if (!hasSignature) {
      toast.error("Agregá una firma antes de guardar.")
      return
    }
    if (!sessionRefPath) {
      toast.error("La sesión de firma no está lista. Intentá nuevamente.")
      return
    }
    if (!signerName.trim() || !signerDni.trim()) {
      toast.error("Completá DNI y aclaración antes de guardar.")
      return
    }

    setIsSaving(true)
    try {
      const canvas = canvasRef.current
      const exportCanvas = document.createElement("canvas")
      exportCanvas.width = canvas.width
      exportCanvas.height = canvas.height

      const exportCtx = exportCanvas.getContext("2d")
      if (!exportCtx) throw new Error("No se pudo preparar la firma.")
      exportCtx.drawImage(canvas, 0, 0)

      const sourceImageData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height)
      const { data, width, height } = sourceImageData
      let minX = width
      let minY = height
      let maxX = 0
      let maxY = 0
      let hasPixels = false

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = data[(y * width + x) * 4 + 3]
          if (alpha > 0) {
            hasPixels = true
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      const croppedCanvas = document.createElement("canvas")
      if (hasPixels) {
        const croppedWidth = maxX - minX + 1
        const croppedHeight = maxY - minY + 1
        croppedCanvas.width = croppedWidth
        croppedCanvas.height = croppedHeight
        const croppedCtx = croppedCanvas.getContext("2d")
        if (!croppedCtx) throw new Error("No se pudo recortar la firma.")
        const croppedImageData = exportCtx.getImageData(minX, minY, croppedWidth, croppedHeight)
        croppedCtx.putImageData(croppedImageData, 0, 0)
      } else {
        croppedCanvas.width = exportCanvas.width
        croppedCanvas.height = exportCanvas.height
        const croppedCtx = croppedCanvas.getContext("2d")
        if (!croppedCtx) throw new Error("No se pudo preparar la firma.")
        croppedCtx.drawImage(exportCanvas, 0, 0)
      }

      const signatureBlob = await new Promise<Blob | null>((resolve) =>
        croppedCanvas.toBlob(resolve, "image/png")
      )
      if (!signatureBlob) {
        throw new Error("No se pudo generar la imagen de la firma.")
      }

      const storagePath = `sale-signatures/${sessionId}/signature-${Date.now()}.png`
      const fileRef = storageRef(storage, storagePath)
      await uploadBytes(fileRef, signatureBlob)
      const url = await getDownloadURL(fileRef)

      const signatureData = {
        url,
        path: storagePath,
        signedAt: new Date().toISOString(),
        uploadedBy: "mobile",
        signerName: signerName.trim(),
        signerDni: signerDni.trim(),
      }

      const sessionRef = databaseRef(database, sessionRefPath)
      await update(sessionRef, {
        status: "signed",
        signature: signatureData,
        pendingSignature: false,
        lastSignedAt: signatureData.signedAt,
      })

      if (saleId) {
        const saleRef = databaseRef(database, `sales/${saleId}`)
        await update(saleRef, {
          signature: {
            ...signatureData,
            sessionId,
          },
        })
      }

      toast.success("Firma guardada correctamente.")
      setSignatureUrl(url)
      setShowThanks(true)
    } catch (error) {
      console.error("Error al guardar la firma:", error)
      toast.error("No se pudo guardar la firma", {
        description: (error as Error).message,
      })
    } finally {
      setIsSaving(false)
    }
  }, [hasSignature, saleId, sessionId, sessionRefPath, signatureLocked, signerDni, signerName])

  const handleAcceptDisclaimer = useCallback(async () => {
    if (!sessionRefPath) {
      setHasAcceptedDisclaimer(true)
      return
    }

    try {
      const sessionRef = databaseRef(database, sessionRefPath)
      await update(sessionRef, {
        disclaimerAcceptedAt: new Date().toISOString(),
        disclaimerType: disclaimerType ?? null,
      })
      setHasAcceptedDisclaimer(true)
    } catch (error) {
      console.error("No se pudo registrar la aceptación del aviso:", error)
      toast.error("No se pudo registrar la aceptación. Intentá nuevamente.")
    }
  }, [disclaimerType, sessionRefPath])

  const handleCancelDisclaimer = useCallback(async () => {
    if (!sessionRefPath || isCanceling) return
    setIsCanceling(true)
    try {
      const sessionRef = databaseRef(database, sessionRefPath)
      await update(sessionRef, {
        status: "cancel_requested",
        cancelRequestedAt: new Date().toISOString(),
        cancelRequestedBy: "customer",
      })
      toast.message("Se avisó al vendedor para cancelar la operación.")
    } catch (error) {
      console.error("No se pudo solicitar la cancelación:", error)
      toast.error("No se pudo solicitar la cancelación. Intentá nuevamente.")
    } finally {
      setIsCanceling(false)
    }
  }, [isCanceling, sessionRefPath])

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert>
          <AlertTitle>Sesión inválida</AlertTitle>
          <AlertDescription>No se encontró la sesión de firma solicitada.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const fireworks = [
    { left: "18%", top: "22%", delay: "0s" },
    { left: "74%", top: "18%", delay: "0.3s" },
    { left: "30%", top: "62%", delay: "0.6s" },
    { left: "70%", top: "68%", delay: "0.9s" },
    { left: "50%", top: "38%", delay: "1.2s" },
  ]

  const shouldShowDisclaimer =
    !signatureLocked &&
    !showThanks &&
    !hasAcceptedDisclaimer &&
    status !== "closed" &&
    status !== "cancelled" &&
    status !== "cancel_requested"

  const disclaimerContent =
    disclaimerType === "used"
      ? "iPhone Market le recuerda que los equipos usados cuentan con garantia válida por un período de 30 días de corridos a partir de la fecha del presente recibo. La cobertura de la garantía se extiende a posibles fallas que sucedan en el equipo dentro del periodo de tiempo establecido, se excluye terminantemente aquellos daños o fallas resultantes del mal uso del dispositivo, aquellos que sean consecuencias de golpes o por exposición al agua.- *Accesorios que se entreguen con el equipo cuentan con 15 dias de garantia a partir de la fecha del presente recibo.-"
      : "Por la presente, el cliente declara haber adquirido un teléfono nuevo, en caja sellada, sin uso previo, en perfectas condiciones estéticas y funcionales. El equipo cuenta con garantía oficial de fábrica por el término de 1 (un) año, la cual deberá ser gestionada exclusivamente ante los canales oficiales de Apple, conforme a las políticas del fabricante. El cliente entiende y acepta que iMarket no brinda garantía propia ni se responsabiliza por fallas de fabricación, quedando exento de cualquier reclamo vinculado a defectos cubiertos por la garantía oficial."

  return (
    <div className="min-h-screen bg-muted/40 p-4">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PencilLine className="h-5 w-5" /> Firma del cliente
          </CardTitle>
          {receiptNumber && (
            <p className="text-sm text-muted-foreground">Venta #{receiptNumber}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-10">
          {status === "closed" && (
            <Alert variant="destructive">
              <AlertTitle>Sesión cerrada</AlertTitle>
              <AlertDescription>
                Esta sesión de firma fue cerrada desde el sistema de ventas.
              </AlertDescription>
            </Alert>
          )}
          {status === "cancelled" && (
            <Alert variant="destructive">
              <AlertTitle>Operación cancelada</AlertTitle>
              <AlertDescription>
                La venta fue cancelada desde el sistema de ventas. Consultá con el vendedor.
              </AlertDescription>
            </Alert>
          )}
          {status === "cancel_requested" && (
            <Alert>
              <AlertTitle>Solicitud enviada</AlertTitle>
              <AlertDescription>
                Se avisó al vendedor para cancelar la operación. Esperá la confirmación.
              </AlertDescription>
            </Alert>
          )}

          {shouldShowDisclaimer && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Declaración del cliente
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Condiciones de la compra
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{disclaimerContent}</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <Button type="button" variant="outline" onClick={handleCancelDisclaimer} disabled={isCanceling}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleAcceptDisclaimer}>
                  Aceptar
                </Button>
              </div>
            </div>
          )}

          {!shouldShowDisclaimer && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Firmá dentro del recuadro</span>
                  {signatureUrl && <span className="text-green-600">Firma registrada</span>}
                </div>
                <div className="rounded-md border bg-white p-2">
                  <canvas
                    ref={canvasRef}
                    className={`h-32 w-full touch-none rounded-md bg-white ${signatureLocked ? "cursor-not-allowed opacity-60" : ""}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-[30px]">
                <div className="space-y-2">
                  <Label htmlFor="signer-dni">DNI</Label>
                  <Input
                    id="signer-dni"
                    inputMode="numeric"
                    placeholder="Ingresá el DNI"
                    value={signerDni}
                    onChange={(event) => setSignerDni(event.target.value)}
                    disabled={signatureLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signer-name">Aclaración (nombre y apellido)</Label>
                  <Input
                    id="signer-name"
                    placeholder="Ingresá nombre y apellido"
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                    disabled={signatureLocked}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleClear} disabled={signatureLocked}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
                </Button>
                <Button type="button" onClick={handleSave} disabled={signatureLocked || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Aceptar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {signatureUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Firma guardada</p>
              <div className="rounded-md border bg-white p-2">
                <Image
                  src={signatureUrl}
                  alt="Firma guardada"
                  width={400}
                  height={200}
                  className="h-32 w-full object-contain"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {showThanks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/90 px-6 text-center text-white">
          <div className="absolute inset-0">
            {fireworks.map((firework) => (
              <div
                key={`${firework.left}-${firework.top}`}
                className="firework"
                style={{
                  left: firework.left,
                  top: firework.top,
                  animationDelay: firework.delay,
                }}
              />
            ))}
          </div>
          <div className="relative z-10 space-y-3">
            <p className="text-2xl font-semibold sm:text-3xl">¡Gracias por elegir iMarket!</p>
            <p className="text-sm text-slate-200">
              Tu firma fue registrada correctamente.
            </p>
          </div>
          <style jsx>{`
            .firework {
              position: absolute;
              width: 8px;
              height: 8px;
              border-radius: 9999px;
              background: transparent;
              transform: translate(-50%, -50%);
              animation: firework 1.8s ease-out infinite;
              box-shadow:
                0 -34px #f87171,
                24px -24px #fb923c,
                34px 0 #facc15,
                24px 24px #4ade80,
                0 34px #38bdf8,
                -24px 24px #a78bfa,
                -34px 0 #f472b6,
                -24px -24px #fda4af;
            }

            .firework::after {
              content: "";
              position: absolute;
              inset: 0;
              border-radius: 9999px;
              animation: firework 1.8s ease-out infinite;
              animation-delay: 0.2s;
              box-shadow:
                0 -22px #22d3ee,
                16px -16px #60a5fa,
                22px 0 #34d399,
                16px 16px #f59e0b,
                0 22px #f87171,
                -16px 16px #c084fc,
                -22px 0 #818cf8,
                -16px -16px #f472b6;
            }

            @keyframes firework {
              0% {
                transform: translate(-50%, -50%) scale(0.2);
                opacity: 1;
              }
              100% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default function MobileSignatureClientPage() {
  return (
    <Suspense fallback={<MobileSignatureFallback />}>
      <MobileSignatureContent />
    </Suspense>
  )
}
