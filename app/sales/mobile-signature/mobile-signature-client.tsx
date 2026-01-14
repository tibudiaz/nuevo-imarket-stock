"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { auth, database, storage } from "@/lib/firebase"
import { ref as databaseRef, onValue, update, get } from "firebase/database"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { Loader2, PencilLine, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState("pending")
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null)
  const [saleId, setSaleId] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [isValidSession, setIsValidSession] = useState(true)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBypassed, setAuthBypassed] = useState(false)

  useEffect(() => {
    let isMounted = true

    const enableAuthBypass = (reason?: string) => {
      if (reason) {
        console.warn(reason)
      }
      if (!isMounted) return
      setAuthBypassed(true)
      setIsAuthReady(true)
      setAuthError(null)
    }

    if (!auth?.app) {
      enableAuthBypass("Firebase Auth no se inicializó; habilitando modo sin autenticación.")
      return () => {
        isMounted = false
      }
    }

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      enableAuthBypass("Se detectó un contexto inseguro; continuando sin sesión segura.")
      return () => {
        isMounted = false
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return
      if (user) {
        setIsAuthReady(true)
        setAuthError(null)
      }
    })

    const attemptAnonymousSignIn = async (attempt = 1) => {
      if (!isMounted) return
      if (auth.currentUser) {
        setIsAuthReady(true)
        setAuthError(null)
        return
      }

      try {
        await signInAnonymously(auth)
      } catch (error) {
        console.error("No se pudo autenticar la sesión anónima:", error)
        if (attempt < 3) {
          setTimeout(() => attemptAnonymousSignIn(attempt + 1), 500 * attempt)
        } else if (isMounted) {
          enableAuthBypass("Fallo repetido al autenticar; habilitando modo sin autenticación.")
        }
      }
    }

    attemptAnonymousSignIn()

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionId || !isAuthReady) return

    const sessionRef = databaseRef(database, `saleSignatureSessions/${sessionId}`)

    get(sessionRef)
      .then((snapshot) => {
        if (!snapshot.exists()) {
          setIsValidSession(false)
          setIsCheckingSession(false)
          return
        }
        setIsValidSession(true)
        setIsCheckingSession(false)
      })
      .catch((error) => {
        console.error("Error al verificar la sesión de firma:", error)
        setIsValidSession(false)
        setIsCheckingSession(false)
      })

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        setIsValidSession(false)
        setStatus("pending")
        setSignatureUrl(null)
        return
      }
      const sessionData = snapshot.val()
      setStatus(sessionData.status || "pending")
      setReceiptNumber(sessionData.receiptNumber ?? null)
      setSaleId(sessionData.saleId ?? null)
      setSignatureUrl(sessionData.signature?.url ?? null)
    })

    update(sessionRef, {
      lastOpenedAt: new Date().toISOString(),
    }).catch(() => null)

    return () => unsubscribe()
  }, [sessionId, isAuthReady])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof window === "undefined") return

    const parent = canvas.parentElement
    const width = parent?.clientWidth ?? 320
    const height = 180
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
    if (status === "closed") return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.setPointerCapture(event.pointerId)
    const { x, y } = getCanvasPoint(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSignature(true)
  }, [getCanvasPoint, status])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { x, y } = getCanvasPoint(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [getCanvasPoint, isDrawing])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    canvas?.releasePointerCapture(event.pointerId)
    setIsDrawing(false)
  }, [isDrawing])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || !sessionId || status === "closed") return
    if (!hasSignature) {
      toast.error("Agregá una firma antes de guardar.")
      return
    }
    if (!isAuthReady) {
      toast.error("La sesión segura aún no está lista. Espera unos segundos.")
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
      exportCtx.fillStyle = "#FFFFFF"
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
      exportCtx.drawImage(canvas, 0, 0)

      const signatureBlob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, "image/png")
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
      }

      const sessionRef = databaseRef(database, `saleSignatureSessions/${sessionId}`)
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
    } catch (error) {
      console.error("Error al guardar la firma:", error)
      toast.error("No se pudo guardar la firma", {
        description: (error as Error).message,
      })
    } finally {
      setIsSaving(false)
    }
  }, [hasSignature, isAuthReady, saleId, sessionId, status])

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

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert variant="destructive">
          <AlertTitle>No se pudo iniciar la sesión segura</AlertTitle>
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Verificando sesión...
        </div>
      </div>
    )
  }

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert>
          <AlertTitle>Sesión expirada o inexistente</AlertTitle>
          <AlertDescription>
            La sesión de firma no está disponible. Solicitá un nuevo QR desde el sistema de ventas.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

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
        <CardContent className="space-y-4">
          {authBypassed && (
            <Alert>
              <AlertTitle>Conexión sin autenticación</AlertTitle>
              <AlertDescription>
                Detectamos un contexto sin autenticación segura. La firma se guardará igual, pero se recomienda usar HTTPS.
              </AlertDescription>
            </Alert>
          )}

          {status === "closed" && (
            <Alert variant="destructive">
              <AlertTitle>Sesión cerrada</AlertTitle>
              <AlertDescription>
                Esta sesión de firma fue cerrada desde el sistema de ventas.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Firmá dentro del recuadro</span>
              {signatureUrl && <span className="text-green-600">Firma registrada</span>}
            </div>
            <div className="rounded-md border bg-white p-2">
              <canvas
                ref={canvasRef}
                className="h-44 w-full touch-none rounded-md bg-white"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleClear} disabled={status === "closed"}>
              <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
            </Button>
            <Button type="button" onClick={handleSave} disabled={status === "closed" || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Guardar firma
                </>
              )}
            </Button>
          </div>

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
