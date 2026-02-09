"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { auth, database, storage } from "@/lib/firebase"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { ref as databaseRef, onValue, get, push, set, update } from "firebase/database"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import type { CatalogAdPage, CatalogAdType } from "@/lib/catalog-ads"

type UploadedAdFile = {
  id: string
  url: string
  name?: string
  uploadedAt?: string
  type?: string
}

type CatalogAdUploadSession = {
  page?: CatalogAdPage
  type?: CatalogAdType
  status?: string
  files?: Record<string, Omit<UploadedAdFile, "id">>
}

function MobileUploadFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando sesión...
      </div>
    </div>
  )
}

export default function CatalogAdMobileUploadClient() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") || undefined
  const pageParam = searchParams.get("page") || undefined
  const typeParam = searchParams.get("type") || undefined
  const allowSessionRecovery = Boolean(pageParam || typeParam)

  const resolvedPage: CatalogAdPage = (pageParam && pageParam.trim().length > 0
    ? pageParam.trim()
    : "landing") as CatalogAdPage
  const resolvedType: CatalogAdType =
    typeParam === "video" || typeParam === "carousel" || typeParam === "image"
      ? typeParam
      : "image"

  const [sessionData, setSessionData] = useState<CatalogAdUploadSession | null>(null)
  const [files, setFiles] = useState<UploadedAdFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isValidSession, setIsValidSession] = useState(true)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const enableAuthBypass = (reason?: string) => {
      if (reason) {
        console.warn(reason)
      }
      if (!isMounted) return
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

    const sessionRef = databaseRef(database, `catalogAdUploadSessions/${sessionId}`)

    get(sessionRef)
      .then(async (snapshot) => {
        if (snapshot.exists()) {
          setIsValidSession(true)
          setIsCheckingSession(false)
          return
        }

        const fallbackPayload: CatalogAdUploadSession = {
          page: resolvedPage,
          type: resolvedType,
          status: "pending",
        }

        try {
          await set(sessionRef, {
            ...fallbackPayload,
            createdAt: new Date().toISOString(),
          })
          setIsValidSession(true)
        } catch (error) {
          console.error("Error al crear la sesión de carga:", error)
          setIsValidSession(false)
        } finally {
          setIsCheckingSession(false)
        }
      })
      .catch((error) => {
        console.error("Error al verificar la sesión de carga:", error)
        setIsValidSession(false)
        setIsCheckingSession(false)
      })

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        if (!allowSessionRecovery) {
          setIsValidSession(false)
        }
        setSessionData(null)
        setFiles([])
        return
      }
      const data = snapshot.val() as CatalogAdUploadSession
      setSessionData(data)
      if (data.files) {
        const nextFiles = Object.entries(data.files).map(([id, value]) => ({
          id,
          ...value,
        }))
        setFiles(nextFiles.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()))
      } else {
        setFiles([])
      }
    })

    update(sessionRef, {
      lastOpenedAt: new Date().toISOString(),
    }).catch(() => null)

    return () => unsubscribe()
  }, [sessionId, isAuthReady, allowSessionRecovery, resolvedPage, resolvedType])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !sessionId || !isAuthReady) {
      if (!isAuthReady) {
        toast.error("La sesión segura aún no está lista. Espera unos segundos e intentá nuevamente.")
      }
      return
    }

    if (sessionData?.status === "closed") {
      toast.error("La sesión de carga está cerrada.")
      return
    }

    const selectedFiles = Array.from(event.target.files)
    setIsUploading(true)
    try {
      const page = sessionData?.page || "landing"
      for (const file of selectedFiles) {
        const storagePath = `catalog-ads/${page}/${sessionId}/${Date.now()}-${file.name}`
        const fileRef = storageRef(storage, storagePath)
        await uploadBytes(fileRef, file)
        const url = await getDownloadURL(fileRef)
        const filesRef = databaseRef(database, `catalogAdUploadSessions/${sessionId}/files`)
        await push(filesRef, {
          url,
          uploadedAt: new Date().toISOString(),
          name: file.name,
          path: storagePath,
          type: file.type,
        })
      }
      const sessionRef = databaseRef(database, `catalogAdUploadSessions/${sessionId}`)
      await update(sessionRef, {
        pendingUpload: false,
        lastUploadedAt: new Date().toISOString(),
      }).catch(() => null)
      toast.success("Archivos subidos correctamente")
    } catch (error) {
      console.error("Error al subir archivos desde el celular:", error)
      toast.error("No se pudieron subir los archivos", {
        description: (error as Error).message,
      })
    } finally {
      event.target.value = ""
      setIsUploading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert>
          <AlertTitle>Sesión inválida</AlertTitle>
          <AlertDescription>No se encontró la sesión de carga solicitada.</AlertDescription>
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
    return <MobileUploadFallback />
  }

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert variant="destructive">
          <AlertTitle>Sesión no encontrada</AlertTitle>
          <AlertDescription>
            La sesión de carga ya no está disponible. Pedí al administrador que genere una nueva.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const resolvedSessionType = sessionData?.type ?? resolvedType
  const acceptType = resolvedSessionType === "video" ? "video/*" : "image/*"
  const allowMultiple = resolvedSessionType !== "video"

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Subir publicidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Seleccioná los archivos para subirlos directamente al catálogo. Los cambios se verán
            en el dashboard cuando estén listos.
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              accept={acceptType}
              multiple={allowMultiple}
              onChange={handleUpload}
              disabled={isUploading}
            />
            {isUploading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Subiendo archivos...
              </p>
            )}
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay archivos cargados.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-md border p-2">
                  <UploadCloud className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{file.name || "Archivo"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
