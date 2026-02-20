"use client"

import Link from "next/link"
import { FormEvent, useEffect, useRef, useState } from "react"
import { Loader2, MessageCircle, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { resolveLocalAssistant, type AssistantAction } from "@/lib/local-assistant"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type AssistantMessage = {
  role: "user" | "assistant"
  content: string
  limited?: boolean
  actions?: AssistantAction[]
}

export default function LocalAssistantChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy el asistente del local. Podés consultarme por horarios, stock (por ejemplo iPhone 13), pagos y cuidado del celular.",
      limited: false,
    },
  ])
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setShowHint(false)
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isLoading])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return

    setMessages((prev) => [...prev, { role: "user", content: trimmedQuestion }])
    setQuestion("")
    setIsLoading(true)

    try {
      const data = await resolveLocalAssistant(trimmedQuestion)

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No tengo una respuesta en este momento.",
          limited: data.limited,
          actions: data.actions,
        },
      ])
    } catch (error) {
      console.error("Error al consultar asistente:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Hubo un problema al responder. Intentá de nuevo en unos segundos.",
          limited: false,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3">
      {showHint && !isOpen ? (
        <div className="max-w-[220px] rounded-2xl border border-white/15 bg-slate-900/95 px-4 py-3 text-xs text-slate-100 shadow-xl">
          ¿Tenés dudas? Consultame por horarios, stock o cuidados de batería 🔋
        </div>
      ) : null}

      {isOpen ? (
        <Card className="w-[350px] max-w-[calc(100vw-1.5rem)] border-white/15 bg-slate-950/95 text-white shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Asistente iMarket</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="p-3 pt-0">
            <ScrollArea className="h-80 rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                    className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
                      message.role === "user"
                        ? "ml-auto bg-sky-500/90 text-white"
                        : message.limited
                          ? "bg-amber-500/20 text-amber-100"
                          : "bg-white/10 text-slate-100"
                    }`}
                  >
                    <p>{message.content}</p>
                    {message.role === "assistant" && message.actions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <Button key={action.href} asChild size="sm" className="h-8 rounded-full bg-sky-500 px-3 text-xs text-white hover:bg-sky-400">
                            <Link href={action.href}>{action.label}</Link>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter>
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ej: ¿Tienen iPhone 13 de 128GB?"
                className="border-white/20 bg-slate-900/70 text-white placeholder:text-slate-400"
                maxLength={300}
              />
              <Button type="submit" disabled={isLoading} className="shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-sky-500 text-white shadow-xl hover:bg-sky-400"
        >
          <MessageCircle className="h-7 w-7" />
        </Button>
      )}
    </div>
  )
}
