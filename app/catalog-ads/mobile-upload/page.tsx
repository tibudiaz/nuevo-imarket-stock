import { Suspense } from "react"
import CatalogAdMobileUploadClient from "./mobile-upload-client"

function MobileUploadFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
      Cargando sesión...
    </div>
  )
}

export default function CatalogAdMobileUploadPage() {
  return (
    <Suspense fallback={<MobileUploadFallback />}>
      <CatalogAdMobileUploadClient />
    </Suspense>
  )
}
