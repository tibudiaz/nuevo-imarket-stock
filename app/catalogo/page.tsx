"use client"

import { Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"

import PublicStockClient from "./[tipo]/ClientPage"

export default function PublicCatalogPage() {
  const searchParams = useSearchParams()
  const tipo = useMemo(() => {
    const value = searchParams?.get("tipo")
    return typeof value === "string" && value.trim().length > 0 ? value : "nuevos"
  }, [searchParams])

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando…</div>}>
      <PublicStockClient params={{ tipo }} />
    </Suspense>
  )
}
