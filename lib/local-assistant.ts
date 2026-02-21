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
  brand?: string
  model?: string
  stock?: number
  status?: string
  price?: number
  category?: string
}

type CatalogFilters = {
  queryTerms: string[]
  storage?: string
  color?: string
  minPrice?: number
  maxPrice?: number
}

type ProductCondition = "nuevo" | "usado"

export type AssistantSessionContext = {
  catalog?: {
    model?: string
    storage?: string
    color?: string
    condition?: ProductCondition
  }
}

export type AssistantAction = {
  label: string
  href: string
}

export type LocalAssistantResult = {
  answer: string
  limited: boolean
  actions?: AssistantAction[]
  sessionContext?: AssistantSessionContext
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

const COLORS = [
  "negro",
  "blanco",
  "azul",
  "rojo",
  "verde",
  "violeta",
  "morado",
  "rosa",
  "gold",
  "dorado",
  "plateado",
  "gris",
  "grafito",
  "midnight",
  "starlight",
]

const CATALOG_INTENT_KEYWORDS = [
  "stock",
  "catalogo",
  "catalog",
  "producto",
  "productos",
  "buscar",
  "filtrar",
  "iphone",
  "samsung",
  "motorola",
  "xiaomi",
  "celular",
  "telefono",
  "telefono",
  "equipo",
  "modelos",
  "modelo",
  "gb",
  "tb",
  "precio",
  "usado",
  "usados",
  "nuevo",
  "nuevos",
  "jbl",
  "gaming",
  "audio",
  "parlante",
  "parlantes",
  "auricular",
  "auriculares",
  "joystick",
]

const stopWords = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "quiero",
  "necesito",
  "busco",
  "mostrar",
  "mostrame",
  "mostrarme",
  "hay",
  "tienen",
  "tenes",
  "que",
  "con",
  "para",
  "por",
  "equipo",
  "equipos",
  "usado",
  "usados",
  "nueva",
  "nuevo",
  "nuevos",
  "gaming",
  "audio",
])

const extractPrices = (normalizedQuestion: string) => {
  const values = Array.from(normalizedQuestion.matchAll(/\b\d{2,3}(?:[\.,]\d{3})+\b|\b\d{4,8}\b/g)).map((match) =>
    Number.parseInt(match[0].replace(/[\.,]/g, ""), 10),
  )

  const result: { minPrice?: number; maxPrice?: number } = {}

  const betweenMatch = normalizedQuestion.match(/entre\s+(\d{2,3}(?:[\.,]\d{3})+|\d{4,8})\s+y\s+(\d{2,3}(?:[\.,]\d{3})+|\d{4,8})/)
  if (betweenMatch) {
    const a = Number.parseInt(betweenMatch[1].replace(/[\.,]/g, ""), 10)
    const b = Number.parseInt(betweenMatch[2].replace(/[\.,]/g, ""), 10)
    result.minPrice = Math.min(a, b)
    result.maxPrice = Math.max(a, b)
    return result
  }

  const maxMatch = normalizedQuestion.match(/(hasta|menos de|maximo|maximo de)\s+(\d{2,3}(?:[\.,]\d{3})+|\d{4,8})/)
  if (maxMatch) {
    result.maxPrice = Number.parseInt(maxMatch[2].replace(/[\.,]/g, ""), 10)
    return result
  }

  const minMatch = normalizedQuestion.match(/(desde|mas de|minimo|minimo de)\s+(\d{2,3}(?:[\.,]\d{3})+|\d{4,8})/)
  if (minMatch) {
    result.minPrice = Number.parseInt(minMatch[2].replace(/[\.,]/g, ""), 10)
    return result
  }

  if (values.length === 1 && normalizedQuestion.includes("precio")) {
    result.maxPrice = values[0]
  }

  return result
}

const parseCatalogFilters = (normalizedQuestion: string): CatalogFilters => {
  const storageMatch = normalizedQuestion.match(/\b(\d{2,4})\s?(gb|tb)\b/)
  const storage = storageMatch ? `${storageMatch[1]}${storageMatch[2]}` : undefined

  const color = COLORS.find((value) => normalizedQuestion.includes(value))
  const { minPrice, maxPrice } = extractPrices(normalizedQuestion)

  const queryTerms = normalizedQuestion
    .replace(/\d{2,4}\s?(gb|tb)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !stopWords.has(term) && !COLORS.includes(term))

  return { queryTerms, storage, color, minPrice, maxPrice }
}

const extractCondition = (normalizedQuestion: string): ProductCondition | undefined => {
  if (/\b(usado|usada|seminuevo|seminueva|reacondicionado|reacondicionada)\b/.test(normalizedQuestion)) {
    return "usado"
  }
  if (/\b(nuevo|nueva|sellado|0km)\b/.test(normalizedQuestion)) {
    return "nuevo"
  }
  return undefined
}

const extractModel = (normalizedQuestion: string): string | undefined => {
  const modelMatch = normalizedQuestion.match(/\biphone\s+\d{1,2}(?:\s+(?:pro\s+max|pro|max|plus|mini))?\b/)
  return modelMatch?.[0]?.trim()
}

const hasCatalogIntent = (normalizedQuestion: string) =>
  CATALOG_INTENT_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword))

const collectAvailableProducts = async (): Promise<ProductCandidate[]> => {
  const [products, newPhones, jblProducts] = await Promise.all([
    fetchPublicRealtimeValue<Record<string, any>>("products"),
    fetchPublicRealtimeValue<Record<string, any>>("config/newPhones"),
    fetchPublicRealtimeValue<Record<string, any>>("jblProducts"),
  ])

  const productCandidates: ProductCandidate[] = Object.entries(products || {}).map(([id, value]) => ({
    id,
    name: String(value?.name ?? ""),
    brand: value?.brand ? String(value.brand) : undefined,
    model: value?.model ? String(value.model) : undefined,
    stock: typeof value?.stock === "number" ? value.stock : undefined,
    status: value?.status ? String(value.status) : undefined,
    price: typeof value?.price === "number" ? value.price : undefined,
    category: value?.category ? String(value.category) : undefined,
  }))

  const newPhoneCandidates: ProductCandidate[] = Object.entries(newPhones || {}).map(([id, value]) => ({
    id,
    name: String(value?.name ?? ""),
    brand: value?.brand ? String(value.brand) : undefined,
    model: value?.model ? String(value.model) : undefined,
    stock: undefined,
    status: value?.status ? String(value.status) : undefined,
    price: typeof value?.price === "number" ? value.price : undefined,
    category: "Celulares Nuevos",
  }))

  const jblCandidates: ProductCandidate[] = Object.entries(jblProducts || {}).map(([id, value]) => ({
    id,
    name: String(value?.name ?? "").trim() || `${String(value?.brand ?? "").trim()} ${String(value?.model ?? "").trim()}`.trim(),
    brand: value?.brand ? String(value.brand) : "JBL",
    model: value?.model ? String(value.model) : undefined,
    stock: typeof value?.availableQuantity === "number" ? value.availableQuantity : undefined,
    status: value?.status ? String(value.status) : undefined,
    price:
      typeof value?.salePrice === "number"
        ? value.salePrice
        : typeof value?.price === "number"
          ? value.price
          : undefined,
    category: value?.category ? String(value.category) : "JBL",
  }))

  const unique = new Map<string, ProductCandidate>()
  ;[...productCandidates, ...newPhoneCandidates, ...jblCandidates].forEach((item) => {
    const key = normalize(item.name)
    if (!key) return
    if (!unique.has(key)) {
      unique.set(key, item)
    }
  })

  return Array.from(unique.values()).filter((item) => item.name.trim().length > 0)
}

const buildSearchText = (item: ProductCandidate) =>
  normalize(`${item.name} ${item.brand || ""} ${item.model || ""} ${item.status || ""} ${item.category || ""}`)

const matchesCondition = (item: ProductCandidate, condition?: ProductCondition) => {
  if (!condition) return true
  const combined = buildSearchText(item)
  const looksUsed = /\b(usad|seminuev|reacondicionad|2da\s+mano)\b/.test(combined)
  return condition === "usado" ? looksUsed : !looksUsed
}

const answerCatalogSearch = async (normalizedQuestion: string, sessionContext?: AssistantSessionContext) => {
  const filters = parseCatalogFilters(normalizedQuestion)
  const modelInQuestion = extractModel(normalizedQuestion)
  const conditionInQuestion = extractCondition(normalizedQuestion)

  const previousCatalogContext = sessionContext?.catalog
  const modelChanged = !!(modelInQuestion && previousCatalogContext?.model && modelInQuestion !== previousCatalogContext.model)

  const nextCatalogContext: AssistantSessionContext["catalog"] = modelChanged
    ? { model: modelInQuestion }
    : { ...previousCatalogContext }

  if (modelInQuestion) nextCatalogContext.model = modelInQuestion
  if (filters.storage) nextCatalogContext.storage = filters.storage
  if (filters.color) nextCatalogContext.color = filters.color
  if (conditionInQuestion) nextCatalogContext.condition = conditionInQuestion

  const effectiveQueryTerms = filters.queryTerms.length > 0 ? filters.queryTerms : nextCatalogContext?.model?.split(/\s+/).filter(Boolean) || []
  const effectiveStorage = filters.storage || nextCatalogContext?.storage
  const effectiveColor = filters.color || nextCatalogContext?.color
  const effectiveCondition = conditionInQuestion || nextCatalogContext?.condition

  const hasSpecificQuery = filters.queryTerms.length > 0 || !!filters.storage || !!filters.color || typeof filters.maxPrice === "number" || typeof filters.minPrice === "number"
  const hasContextualFollowUp = !!(nextCatalogContext?.model && (filters.color || filters.storage || conditionInQuestion))
  const shouldAnswerCatalog = (hasCatalogIntent(normalizedQuestion) && (hasSpecificQuery || !!nextCatalogContext?.model)) || hasContextualFollowUp

  if (!shouldAnswerCatalog) return null

  if (nextCatalogContext?.model && !effectiveCondition && modelInQuestion && !conditionInQuestion) {
    return {
      answer: `Perfecto, para ${nextCatalogContext.model.toUpperCase()} ${effectiveStorage ? `${effectiveStorage.toUpperCase()} ` : ""}¿lo buscás nuevo o usado?`,
      sessionContext: { catalog: nextCatalogContext },
    }
  }

  const products = await collectAvailableProducts()
  const filtered = products
    .filter(stockAvailable)
    .filter((item) => matchesCondition(item, effectiveCondition))
    .filter((item) => {
      const searchableText = buildSearchText(item)

      if (effectiveQueryTerms.some((term) => !searchableText.includes(term))) {
        return false
      }

      if (effectiveStorage && !searchableText.includes(normalize(effectiveStorage))) {
        return false
      }

      if (effectiveColor && !searchableText.includes(effectiveColor)) {
        return false
      }

      if (typeof filters.maxPrice === "number" && typeof item.price === "number" && item.price > filters.maxPrice) {
        return false
      }

      if (typeof filters.minPrice === "number" && typeof item.price === "number" && item.price < filters.minPrice) {
        return false
      }

      return true
    })

  if (filtered.length === 0) {
    const activeFilters: string[] = []
    if (effectiveQueryTerms.length > 0) activeFilters.push(`modelo: ${effectiveQueryTerms.join(" ")}`)
    if (effectiveStorage) activeFilters.push(`capacidad: ${effectiveStorage.toUpperCase()}`)
    if (effectiveColor) activeFilters.push(`color: ${effectiveColor}`)
    if (effectiveCondition) activeFilters.push(`estado: ${effectiveCondition}`)
    if (typeof filters.maxPrice === "number") activeFilters.push(`tope: ${formatPrice(filters.maxPrice).replace(" · ", "")}`)
    if (typeof filters.minPrice === "number") activeFilters.push(`mínimo: ${formatPrice(filters.minPrice).replace(" · ", "")}`)

    return {
      answer: `No encontré productos disponibles con esos filtros${activeFilters.length ? ` (${activeFilters.join(" · ")})` : ""}. Si querés, probamos ampliando rango de precio o quitando color/capacidad.`,
      sessionContext: { catalog: nextCatalogContext },
    }
  }

  const top = filtered.slice(0, 6)
  const options = top.map((item) => `• ${item.name}${formatPrice(item.price)}`).join("\n")
  const appliedFilters: string[] = []
  if (nextCatalogContext?.model) appliedFilters.push(`modelo: ${nextCatalogContext.model}`)
  else if (effectiveQueryTerms.length > 0) appliedFilters.push(`búsqueda: ${effectiveQueryTerms.join(" ")}`)
  if (effectiveStorage) appliedFilters.push(`capacidad: ${effectiveStorage.toUpperCase()}`)
  if (effectiveColor) appliedFilters.push(`color: ${effectiveColor}`)
  if (effectiveCondition) appliedFilters.push(`estado: ${effectiveCondition}`)
  if (typeof filters.maxPrice === "number") appliedFilters.push(`hasta ${formatPrice(filters.maxPrice).replace(" · ", "")}`)
  if (typeof filters.minPrice === "number") appliedFilters.push(`desde ${formatPrice(filters.minPrice).replace(" · ", "")}`)

  return {
    answer: `Encontré estas opciones disponibles en catálogo${appliedFilters.length ? ` (${appliedFilters.join(" · ")})` : ""}:\n${options}\n\nSi querés, puedo seguir afinando por modelo, capacidad, color o presupuesto.`,
    sessionContext: { catalog: nextCatalogContext },
  }
}

export const resolveLocalAssistant = async (rawQuestion: string, sessionContext?: AssistantSessionContext): Promise<LocalAssistantResult> => {
  const question = rawQuestion.slice(0, MAX_QUESTION_LENGTH)
  if (!question.trim()) {
    return { answer: "Pregunta inválida.", limited: true }
  }

  const config = (await fetchPublicRealtimeValue<AssistantConfig>("config/localAssistant")) || {}
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const normalizedQuestion = normalize(question)
  const batteryAction: AssistantAction[] = [{ label: "Ver cuidado de batería", href: "/cuidado-iphone" }]

  const catalogAnswer = await answerCatalogSearch(normalizedQuestion, sessionContext)
  if (catalogAnswer) {
    return { answer: catalogAnswer.answer, limited: false, sessionContext: catalogAnswer.sessionContext }
  }

  if (["horario", "hora", "abren", "cierran", "abierto"].some((word) => normalizedQuestion.includes(word))) {
    return { answer: mergedConfig.storeHours, limited: false }
  }

  if (["ubicacion", "direccion", "donde", "local", "sucursal"].some((word) => normalizedQuestion.includes(word))) {
    return { answer: mergedConfig.location, limited: false }
  }

  if (["pago", "pagos", "tarjeta", "cuotas", "transferencia", "efectivo"].some((word) => normalizedQuestion.includes(word))) {
    return { answer: mergedConfig.payments, limited: false }
  }

  if (["service", "reparacion", "reparar", "arreglo", "tecnico"].some((word) => normalizedQuestion.includes(word))) {
    return { answer: mergedConfig.technicalService, limited: false }
  }

  if (["bateria", "cargar", "carga", "cargador", "autonomia", "cuidado del celular"].some((word) => normalizedQuestion.includes(word))) {
    return { answer: mergedConfig.batteryCare, limited: false, actions: batteryAction }
  }

  return { answer: mergedConfig.outOfScopeMessage, limited: true }
}
