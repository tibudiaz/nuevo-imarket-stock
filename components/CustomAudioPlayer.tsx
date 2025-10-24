"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import { Pause, Play } from "lucide-react"

import { Button } from "@/components/ui/button"

interface CustomAudioPlayerProps {
  src: string
}

const playbackRates = [1, 1.5, 2] as const

type PlaybackRate = (typeof playbackRates)[number]

function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setAudioData = () => {
      setDuration(audio.duration || 0)
      setCurrentTime(audio.currentTime || 0)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener("loadedmetadata", setAudioData)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("loadedmetadata", setAudioData)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const animateProgress = () => {
    const audio = audioRef.current
    if (!audio) return

    setCurrentTime(audio.currentTime)
    animationFrameRef.current = requestAnimationFrame(animateProgress)
  }

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true)
          animateProgress()
        })
        .catch((error) => {
          console.error("No se pudo reproducir el audio", error)
        })
    }
  }

  const handleProgressClick = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const progressBar = event.currentTarget
    const clickPosition = event.clientX - progressBar.getBoundingClientRect().left
    const newTime = (clickPosition / progressBar.offsetWidth) * duration

    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const togglePlaybackRate = () => {
    const audio = audioRef.current
    if (!audio) return

    const currentIndex = playbackRates.indexOf(playbackRate)
    const nextIndex = (currentIndex + 1) % playbackRates.length
    const newRate = playbackRates[nextIndex]

    setPlaybackRate(newRate)
    audio.playbackRate = newRate
  }

  const formatTime = (time: number) => {
    if (Number.isNaN(time) || time <= 0) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex w-full max-w-[240px] items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={togglePlayPause}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex flex-grow items-center gap-2">
        <div
          className="relative h-1.5 w-full cursor-pointer rounded-full bg-muted-foreground/30"
          onClick={handleProgressClick}
        >
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex flex-col items-end text-[10px] leading-tight text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <Button variant="outline" className="h-6 px-1.5 text-xs" onClick={togglePlaybackRate}>
          {playbackRate}x
        </Button>
      </div>
    </div>
  )
}

export default CustomAudioPlayer
