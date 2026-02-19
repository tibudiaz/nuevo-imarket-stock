"use client"

import { FormEvent, useState } from "react"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AssistantMessage = {
  role: "user" | "assistant"
  content: string
  limited?: boolean
}

export default function LocalAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy el asistente del local. Puedo ayudarte con horarios, ubicación, stock, pagos y servicio técnico.",
      limited: false,
    },
  ])
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return

    setMessages((prev) => [...prev, { role: "user", content: trimmedQuestion }])
    setQuestion("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/local-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      })

      if (!response.ok) {
        throw new Error("No se pudo responder en este momento.")
      }

      const data = (await response.json()) as { answer?: string; limited?: boolean }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No tengo una respuesta en este momento.",
          limited: data.limited,
        },
      ])
    } catch (error) {
      console.error("Error al consultar asistente:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hubo un problema al responder. Intentá de nuevo en unos segundos.",
          limited: false,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="mb-4 space-y-2">
        <h2 className="text-2xl font-semibold text-white">Chat del local</h2>
        <p className="text-sm text-slate-300">
          Respondemos solo consultas del local: horarios, ubicación, medios de pago, stock y
          service técnico.
        </p>
      </div>

      <div className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
            className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-sky-500/80 text-white"
                : message.limited
                  ? "bg-amber-500/20 text-amber-100"
                  : "bg-white/10 text-slate-100"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ej: ¿Qué horarios tienen hoy?"
          className="border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400"
          maxLength={300}
        />
        <Button type="submit" disabled={isLoading} className="shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </section>
  )
}
