import { Suspense } from "react"

import PublicStockClient from "./[tipo]/ClientPage"

export const dynamic = "force-dynamic"

type CatalogPageProps = {
  searchParams?: { tipo?: string }
}

export default function PublicCatalogPage({ searchParams }: CatalogPageProps) {
  const tipo = typeof searchParams?.tipo === "string" && searchParams.tipo.trim().length > 0
    ? searchParams.tipo
    : "nuevos"

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando…</div>}>
      <PublicStockClient params={{ tipo }} />
    </Suspense>
  )
}
