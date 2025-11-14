"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { database, storage } from "@/lib/firebase"
import { ref as databaseRef, onValue, push, update, get } from "firebase/database"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import type { RepairPhoto } from "@/types/repair"
import { Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

export default function MobileUploadPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId") || undefined

  const [photos, setPhotos] = useState<RepairPhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<string>("pending")
  const [pendingUpload, setPendingUpload] = useState(true)
  const [canUpload, setCanUpload] = useState(true)
  const [repairId, setRepairId] = useState<string | null>(null)
  const [isValidSession, setIsValidSession] = useState(true)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    const sessionRef = databaseRef(database, `repairUploadSessions/${sessionId}`)

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
        console.error("Error al verificar la sesión de carga:", error)
        setIsValidSession(false)
        setIsCheckingSession(false)
      })

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        setIsValidSession(false)
        setPhotos([])
        return
      }
      const sessionData = snapshot.val()
      setStatus(sessionData.status || "pending")
      setPendingUpload(
        sessionData.pendingUpload ?? !(sessionData.photos && Object.keys(sessionData.photos).length > 0)
      )
      setCanUpload(sessionData.allowUploads !== false && sessionData.status !== "locked" && sessionData.status !== "closed")
      setRepairId(sessionData.repairId ?? null)
      if (sessionData.photos) {
        const photosList: RepairPhoto[] = Object.entries(sessionData.photos).map(([photoId, value]) => ({
          id: photoId,
          ...(value as Omit<RepairPhoto, "id">),
        }))
        setPhotos(photosList.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()))
      } else {
        setPhotos([])
      }
    })

    update(sessionRef, {
      lastOpenedAt: new Date().toISOString(),
    }).catch(() => null)

    return () => unsubscribe()
  }, [sessionId])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !sessionId || !canUpload) return
    const files = Array.from(event.target.files)
    setIsUploading(true)
    try {
      for (const file of files) {
        const storagePath = `repair-uploads/${sessionId}/${Date.now()}-${file.name}`
        const fileRef = storageRef(storage, storagePath)
        await uploadBytes(fileRef, file)
        const url = await getDownloadURL(fileRef)
        const photosRef = databaseRef(database, `repairUploadSessions/${sessionId}/photos`)
        await push(photosRef, {
          url,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "mobile",
          name: file.name,
        })
      }
      const sessionRef = databaseRef(database, `repairUploadSessions/${sessionId}`)
      await update(sessionRef, {
        pendingUpload: false,
        lastUploadedAt: new Date().toISOString(),
        lastUploadedFrom: "mobile",
      }).catch(() => null)
      setPendingUpload(false)
      toast.success("Fotos subidas correctamente")
    } catch (error) {
      console.error("Error al subir fotos desde el celular:", error)
      toast.error("No se pudieron subir las fotos", {
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
            La sesión de carga no está disponible. Solicita un nuevo código desde el sistema de reparaciones.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Subir fotos de la reparación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seleccioná una o varias fotos del equipo. Podés usar la cámara del teléfono o elegir imágenes de tu galería.
          </p>
          {repairId && (
            <Alert>
              <AlertTitle>Reparación vinculada</AlertTitle>
              <AlertDescription>
                Las fotos que subas se asociarán automáticamente a la reparación #{repairId}.
              </AlertDescription>
            </Alert>
          )}
          {pendingUpload && photos.length === 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTitle>Carga pendiente</AlertTitle>
              <AlertDescription>
                Aún no se cargaron imágenes en esta sesión. Tomá las fotos del equipo o seleccioná desde tu galería.
              </AlertDescription>
            </Alert>
          )}
          {!canUpload && (
            <Alert variant="destructive">
              <AlertTitle>Sesión bloqueada</AlertTitle>
              <AlertDescription>
                Esta sesión de carga ya no acepta nuevas imágenes. Consultá con el equipo para habilitar una nueva sesión.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleUpload}
              disabled={isUploading || !canUpload}
            />
            {isUploading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Subiendo fotos...
              </p>
            )}
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="space-y-1">
                  <div className="relative aspect-square overflow-hidden rounded-md border">
                    <Image
                      src={photo.url}
                      alt={photo.name || "Foto de reparación"}
                      fill
                      className="object-cover"
                      sizes="180px"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(photo.uploadedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <UploadCloud className="h-6 w-6" />
              Todavía no se cargaron fotos.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
