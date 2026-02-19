import { NextResponse } from "next/server"

const MAX_QUESTION_LENGTH = 300

const LOCAL_TOPICS: Array<{
  keywords: string[]
  answer: string
}> = [
  {
    keywords: ["horario", "hora", "abren", "cierran", "abierto"],
    answer:
      "Nuestro horario habitual es de lunes a sábado. Si querés, te paso un horario exacto para hoy y mañana con el equipo.",
  },
  {
    keywords: ["ubicacion", "direccion", "donde", "local", "sucursal"],
    answer:
      "Estamos en el local principal de iMarket en Río Cuarto. Si necesitás llegar, te compartimos la dirección exacta por WhatsApp.",
  },
  {
    keywords: ["pago", "pagos", "tarjeta", "cuotas", "transferencia", "efectivo"],
    answer:
      "Aceptamos efectivo, transferencia y medios electrónicos. Consultanos por cuotas vigentes según el producto.",
  },
  {
    keywords: ["stock", "disponible", "hay", "tienen", "modelo"],
    answer:
      "Podés consultarme disponibilidad por modelo, color o capacidad. Si me decís el equipo exacto, te respondo si hay stock.",
  },
  {
    keywords: ["service", "reparacion", "reparar", "arreglo", "tecnico"],
    answer:
      "Sí, contamos con servicio técnico. Te podemos orientar por tipo de falla y tiempos estimados de revisión.",
  },
]

const OUT_OF_SCOPE_MESSAGE =
  "Solo puedo responder sobre el local (horarios, ubicación, medios de pago, stock y servicio técnico)."

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: string } | null
  const question = (body?.question || "").slice(0, MAX_QUESTION_LENGTH)

  if (!question.trim()) {
    return NextResponse.json({ error: "Pregunta inválida." }, { status: 400 })
  }

  const normalizedQuestion = normalize(question)
  const matchedTopic = LOCAL_TOPICS.find((topic) =>
    topic.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  )

  if (!matchedTopic) {
    return NextResponse.json({ answer: OUT_OF_SCOPE_MESSAGE, limited: true })
  }

  return NextResponse.json({ answer: matchedTopic.answer, limited: false })
}
