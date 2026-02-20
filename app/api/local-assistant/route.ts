import { NextResponse } from "next/server"

import { fetchPublicRealtimeValue } from "@/lib/public-realtime"

const MAX_QUESTION_LENGTH = 300

type AssistantConfig = {
  welcomeMessage?: string
  outOfScopeMessage?: string
  storeHours?: string
  location?: string
  payments?: string
  technicalService?: string
  batteryCare?: string
}

type ProductCandidate = {
  id: string
  name: string
  stock?: number
  status?: string
  price?: number
}

type AssistantAction = {
  label: string
  href: string
}

const DEFAULT_CONFIG: Required<AssistantConfig> = {
  welcomeMessage:
    "¡Hola! Soy el asistente del local. Puedo ayudarte con horarios, ubicación, stock, pagos, service y cuidado de batería.",
  outOfScopeMessage:
    "Puedo ayudarte con consultas del local (horarios, ubicación, pagos, stock, servicio técnico), cuidado del celular y disponibilidad de equipos como iPhone 13.",
  storeHours:
    "Nuestro horario habitual es de lunes a sábado. Si querés, te paso un horario exacto para hoy y mañana con el equipo.",
  location:
    "Estamos en el local principal de iMarket en Río Cuarto. Si necesitás llegar, te compartimos la dirección exacta por WhatsApp.",
  payments:
    "Aceptamos efectivo, transferencia y medios electrónicos. Consultanos por cuotas vigentes según el producto.",
  technicalService:
    "Sí, contamos con servicio técnico. Te podemos orientar por tipo de falla y tiempos estimados de revisión.",
  batteryCare:
    "Para cuidar la batería recomendamos evitar temperaturas extremas, mantener cargas entre 20% y 80% cuando sea posible, usar cargadores certificados y evitar descargar el equipo al 0% de forma frecuente.",
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

const formatPrice = (price?: number) => {
  if (typeof price !== "number" || Number.isNaN(price)) return ""
  return ` · ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(price)}`
}

const stockAvailable = (candidate: ProductCandidate) => {
  if (typeof candidate.stock === "number") {
    return candidate.stock > 0
  }
  if (candidate.status) {
    const status = normalize(candidate.status)
    return !status.includes("sin stock")
  }
  return true
}

const collectAvailableProducts = async (): Promise<ProductCandidate[]> => {
  const [products, newPhones] = await Promise.all([
    fetchPublicRealtimeValue<Record<string, any>>("products"),
    fetchPublicRealtimeValue<Record<string, any>>("config/newPhones"),
  ])

  const productCandidates: ProductCandidate[] = Object.entries(products || {}).map(([id, value]) => ({
    id,
    name: String(value?.name ?? ""),
    stock: typeof value?.stock === "number" ? value.stock : undefined,
    status: value?.status ? String(value.status) : undefined,
    price: typeof value?.price === "number" ? value.price : undefined,
  }))

  const newPhoneCandidates: ProductCandidate[] = Object.entries(newPhones || {}).map(([id, value]) => ({
    id,
    name: String(value?.name ?? ""),
    stock: undefined,
    status: value?.status ? String(value.status) : undefined,
    price: typeof value?.price === "number" ? value.price : undefined,
  }))

  const unique = new Map<string, ProductCandidate>()
  ;[...productCandidates, ...newPhoneCandidates].forEach((item) => {
    const key = normalize(item.name)
    if (!key) return
    if (!unique.has(key)) {
      unique.set(key, item)
    }
  })

  return Array.from(unique.values()).filter((item) => item.name.trim().length > 0)
}

const answerCatalogSearch = async (normalizedQuestion: string) => {
  const asksIphone13 = normalizedQuestion.includes("iphone 13")
  if (!asksIphone13) return null

  const products = await collectAvailableProducts()
  const filtered = products
    .filter((item) => normalize(item.name).includes("iphone 13"))
    .filter(stockAvailable)

  if (filtered.length === 0) {
    return "Ahora mismo no veo opciones disponibles de iPhone 13 en el catálogo público. Si querés, te puedo tomar el modelo exacto (13, 13 mini, 13 Pro o 13 Pro Max) para confirmarlo con el equipo."
  }

  const top = filtered.slice(0, 6)
  const options = top.map((item) => `• ${item.name}${formatPrice(item.price)}`).join("\n")

  return `Encontré estas opciones disponibles de iPhone 13 en catálogo:\n${options}\n\nSi querés, te ayudo a filtrar por capacidad, color o rango de precio.`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { question?: string } | null
    const question = (body?.question || "").slice(0, MAX_QUESTION_LENGTH)

    if (!question.trim()) {
      return NextResponse.json({ error: "Pregunta inválida." }, { status: 400 })
    }

    const config = (await fetchPublicRealtimeValue<AssistantConfig>("config/localAssistant")) || {}
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    const normalizedQuestion = normalize(question)
    const batteryAction: AssistantAction[] = [{ label: "Ver cuidado de batería", href: "/cuidado-iphone" }]

    const catalogAnswer = await answerCatalogSearch(normalizedQuestion)
    if (catalogAnswer) {
      return NextResponse.json({ answer: catalogAnswer, limited: false })
    }

    if (["horario", "hora", "abren", "cierran", "abierto"].some((word) => normalizedQuestion.includes(word))) {
      return NextResponse.json({ answer: mergedConfig.storeHours, limited: false })
    }

    if (["ubicacion", "direccion", "donde", "local", "sucursal"].some((word) => normalizedQuestion.includes(word))) {
      return NextResponse.json({ answer: mergedConfig.location, limited: false })
    }

    if (["pago", "pagos", "tarjeta", "cuotas", "transferencia", "efectivo"].some((word) => normalizedQuestion.includes(word))) {
      return NextResponse.json({ answer: mergedConfig.payments, limited: false })
    }

    if (["service", "reparacion", "reparar", "arreglo", "tecnico"].some((word) => normalizedQuestion.includes(word))) {
      return NextResponse.json({ answer: mergedConfig.technicalService, limited: false })
    }

    if (["bateria", "cargar", "carga", "cargador", "autonomia", "cuidado del celular"].some((word) => normalizedQuestion.includes(word))) {
      return NextResponse.json({ answer: mergedConfig.batteryCare, limited: false, actions: batteryAction })
    }

    return NextResponse.json({ answer: mergedConfig.outOfScopeMessage, limited: true })
  } catch (error) {
    console.error("Error en /api/local-assistant:", error)
    return NextResponse.json(
      {
        answer:
          "Ahora estoy con una demora para responderte. Si querés, podés preguntar por horarios, ubicación, pagos, service o cuidado de batería.",
        limited: true,
      },
      { status: 200 },
    )
  }
}
