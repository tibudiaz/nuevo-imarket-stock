import { Suspense } from "react"

import PublicStockClient from "./ClientPage"

export const dynamicParams = true

export function generateStaticParams() {
  return [
    { tipo: "nuevos" },
    { tipo: "dispositivos-android" },
    { tipo: "usados" },
    { tipo: "gaming-audio" },
  ]
}

export default function PublicStockPage({ params }: { params: { tipo: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando…</div>}>
      <PublicStockClient params={params} />
    </Suspense>
  )
}
