import { Suspense } from "react"

import PublicStockClient from "./ClientPage"

export const dynamicParams = false

export function generateStaticParams() {
  return [{ tipo: "nuevos" }, { tipo: "usados" }, { tipo: "gaming-audio" }]
}

export default function PublicStockPage({ params }: { params: { tipo: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando…</div>}>
      <PublicStockClient params={params} />
    </Suspense>
  )
}
