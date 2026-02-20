import { NextResponse } from "next/server"

import { resolveLocalAssistant } from "@/lib/local-assistant"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { question?: string } | null
    const question = body?.question || ""

    if (!question.trim()) {
      return NextResponse.json({ error: "Pregunta inválida." }, { status: 400 })
    }

    const result = await resolveLocalAssistant(question)
    return NextResponse.json(result)
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
