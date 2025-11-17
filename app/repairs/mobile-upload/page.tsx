import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando sesión...
      </div>
    </div>
  )
}

const MobileUploadClientPage = dynamic(() => import("./mobile-upload-client"), {
  ssr: false,
  loading: () => <LoadingFallback />,
})

export default function MobileUploadPage() {
  return <MobileUploadClientPage />
}
