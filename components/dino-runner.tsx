"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CANVAS_HEIGHT = 220
const GROUND_HEIGHT = 28
const DINO_WIDTH = 26
const DINO_HEIGHT = 32
const GRAVITY = 0.6
const JUMP_VELOCITY = -11

type Obstacle = {
  x: number
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const createObstacle = (canvasWidth: number): Obstacle => {
  const width = 18 + Math.random() * 10
  const height = 32 + Math.random() * 20
  return {
    x: canvasWidth + width,
    width,
    height,
  }
}

export default function DinoRunner({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const dinoYRef = useRef(CANVAS_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT)
  const velocityRef = useRef(0)
  const obstaclesRef = useRef<Obstacle[]>([])
  const lastSpawnRef = useRef(0)
  const scoreRef = useRef(0)
  const speedRef = useRef(6)
  const [isRunning, setIsRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [canvasWidth, setCanvasWidth] = useState(640)

  const displayScore = useMemo(() => Math.floor(score), [score])

  const resetGame = useCallback(() => {
    dinoYRef.current = CANVAS_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT
    velocityRef.current = 0
    obstaclesRef.current = []
    lastSpawnRef.current = 0
    scoreRef.current = 0
    speedRef.current = 6
    setScore(0)
    setIsGameOver(false)
  }, [])

  const jump = useCallback(() => {
    if (isGameOver) return
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT
    if (dinoYRef.current >= groundY - 1) {
      velocityRef.current = JUMP_VELOCITY
    }
  }, [isGameOver])

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return
      const container = canvasRef.current.parentElement
      if (!container) return
      const nextWidth = clamp(container.clientWidth, 280, 820)
      setCanvasWidth(nextWidth)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return

    let lastTime = performance.now()

    const drawScene = () => {
      context.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT)

      context.fillStyle = "#0f172a"
      context.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT)

      context.fillStyle = "#1e293b"
      context.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, canvasWidth, GROUND_HEIGHT)

      context.strokeStyle = "rgba(148, 163, 184, 0.4)"
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(0, CANVAS_HEIGHT - GROUND_HEIGHT + 2)
      context.lineTo(canvasWidth, CANVAS_HEIGHT - GROUND_HEIGHT + 2)
      context.stroke()

      const runnerX = 52
      const runnerY = dinoYRef.current

      context.fillStyle = "#e2e8f0"
      context.beginPath()
      context.arc(runnerX + 14, runnerY + 6, 6, 0, Math.PI * 2)
      context.fill()
      context.fillRect(runnerX + 11, runnerY + 12, 6, 12)
      context.fillRect(runnerX + 6, runnerY + 14, 5, 3)
      context.fillRect(runnerX + 17, runnerY + 14, 5, 3)
      context.fillRect(runnerX + 9, runnerY + 24, 4, 8)
      context.fillRect(runnerX + 15, runnerY + 24, 4, 8)

      context.fillStyle = "#0f172a"
      context.fillRect(runnerX + 13, runnerY + 4, 2, 2)

      obstaclesRef.current.forEach((obstacle) => {
        const phoneY = CANVAS_HEIGHT - GROUND_HEIGHT - obstacle.height
        context.fillStyle = "#38bdf8"
        context.fillRect(obstacle.x, phoneY, obstacle.width, obstacle.height)
        context.fillStyle = "#0f172a"
        context.fillRect(obstacle.x + 2, phoneY + 4, obstacle.width - 4, obstacle.height - 8)
        context.fillStyle = "#e2e8f0"
        context.fillRect(obstacle.x + obstacle.width / 2 - 3, phoneY + 2, 6, 2)
      })

      context.fillStyle = "rgba(226, 232, 240, 0.85)"
      context.font = "14px 'Inter', sans-serif"
      context.fillText(`Score: ${Math.floor(scoreRef.current)}`, 12, 22)
      context.fillText(`Best: ${Math.floor(bestScore)}`, 12, 40)

      if (!isRunning) {
        context.fillStyle = "rgba(226, 232, 240, 0.95)"
        context.font = "16px 'Inter', sans-serif"
        const message = isGameOver ? "Game Over" : "Presioná espacio o tocá para comenzar"
        const textWidth = context.measureText(message).width
        context.fillText(message, (canvasWidth - textWidth) / 2, 110)
        if (isGameOver) {
          context.font = "13px 'Inter', sans-serif"
          const hint = "Usá espacio para reintentar"
          const hintWidth = context.measureText(hint).width
          context.fillText(hint, (canvasWidth - hintWidth) / 2, 132)
        }
      }
    }

    const tick = (time: number) => {
      const delta = time - lastTime
      lastTime = time

      if (isRunning) {
        velocityRef.current += GRAVITY
        dinoYRef.current += velocityRef.current
        const groundY = CANVAS_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT
        if (dinoYRef.current >= groundY) {
          dinoYRef.current = groundY
          velocityRef.current = 0
        }

        scoreRef.current += delta * 0.02
        speedRef.current = 6 + scoreRef.current * 0.01

        if (time - lastSpawnRef.current > 900 - clamp(scoreRef.current, 0, 600)) {
          obstaclesRef.current.push(createObstacle(canvasWidth))
          lastSpawnRef.current = time
        }

        obstaclesRef.current = obstaclesRef.current
          .map((obstacle) => ({
            ...obstacle,
            x: obstacle.x - speedRef.current,
          }))
          .filter((obstacle) => obstacle.x + obstacle.width > 0)

        const dinoHitBox = {
          x: 52,
          y: dinoYRef.current,
          width: DINO_WIDTH,
          height: DINO_HEIGHT,
        }

        const collision = obstaclesRef.current.some((obstacle) => {
          const obstacleBox = {
            x: obstacle.x,
            y: CANVAS_HEIGHT - GROUND_HEIGHT - obstacle.height,
            width: obstacle.width,
            height: obstacle.height,
          }
          return (
            dinoHitBox.x < obstacleBox.x + obstacleBox.width &&
            dinoHitBox.x + dinoHitBox.width > obstacleBox.x &&
            dinoHitBox.y < obstacleBox.y + obstacleBox.height &&
            dinoHitBox.y + dinoHitBox.height > obstacleBox.y
          )
        })

        if (collision) {
          setIsRunning(false)
          setIsGameOver(true)
          setBestScore((prev) => Math.max(prev, scoreRef.current))
        }
      }

      setScore(scoreRef.current)
      drawScene()
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [bestScore, canvasWidth, isGameOver, isRunning])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      event.preventDefault()
      if (!isRunning) {
        resetGame()
        setIsRunning(true)
        return
      }
      if (isGameOver) {
        resetGame()
        setIsRunning(true)
        return
      }
      jump()
    }

    const handlePointer = () => {
      if (!isRunning) {
        resetGame()
        setIsRunning(true)
        return
      }
      if (isGameOver) {
        resetGame()
        setIsRunning(true)
        return
      }
      jump()
    }

    window.addEventListener("keydown", handleKeyDown)
    const canvas = canvasRef.current
    canvas?.addEventListener("pointerdown", handlePointer)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      canvas?.removeEventListener("pointerdown", handlePointer)
    }
  }, [isGameOver, isRunning, jump, resetGame])

  const handleRestart = () => {
    resetGame()
    setIsRunning(true)
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={CANVAS_HEIGHT}
          className="h-[220px] w-full"
          aria-label="Dino Rex Runner"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>Salta con espacio o tocando la pantalla.</span>
        <div className="flex items-center gap-3">
          <span>Puntaje: {displayScore}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleRestart}>
            Reiniciar
          </Button>
        </div>
      </div>
    </div>
  )
}
