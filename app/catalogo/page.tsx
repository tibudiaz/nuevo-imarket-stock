import { redirect } from "next/navigation"

const VALID_CATALOGS = new Set(["nuevos", "usados", "gaming-audio"])

export default function PublicCatalogPage({
  searchParams,
}: {
  searchParams?: { tipo?: string; auth?: string }
}) {
  const rawTipo = searchParams?.tipo
  const resolvedTipo =
    typeof rawTipo === "string" && VALID_CATALOGS.has(rawTipo) ? rawTipo : "nuevos"
  const authParam =
    typeof searchParams?.auth === "string" && searchParams.auth.trim().length > 0
      ? `?auth=${encodeURIComponent(searchParams.auth)}`
      : ""
  redirect(`/catalogo/${resolvedTipo}${authParam}`)
}
