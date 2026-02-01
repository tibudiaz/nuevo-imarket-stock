import PublicStockClient from "./ClientPage"

export const dynamicParams = false

export function generateStaticParams() {
  return [{ tipo: "nuevos" }, { tipo: "usados" }]
}

export default function PublicStockPage({ params }: { params: { tipo: string } }) {
  return <PublicStockClient params={params} />
}
