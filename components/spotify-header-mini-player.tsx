"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { useSpotifyPlayerStore } from "@/hooks/use-spotify-player"
import { spotifyEndpoints } from "@/lib/spotify"
import { toast } from "sonner"

export function SpotifyHeaderMiniPlayer() {
  const { getValidAccessToken } = useSpotifyAuth()
  const { currentTrack, isPlaying, setPlaybackState, deviceId, setVolume, volume } = useSpotifyPlayerStore(
    (state) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      setPlaybackState: state.setPlaybackState,
      deviceId: state.deviceId,
      setVolume: state.setVolume,
      volume: state.volume,
    })
  )
  const [isProcessing, setIsProcessing] = useState(false)

  const formattedArtists = useMemo(() => {
    return currentTrack?.artists ?? ""
  }, [currentTrack])

  const performPlaybackAction = useCallback(
    async (endpoint: string, method: "POST" | "PUT" = "POST", body?: any) => {
      const token = await getValidAccessToken()
      if (!token) {
        toast.error("Conectá tu cuenta de Spotify para continuar")
        return
      }

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }

      await fetch(`${spotifyEndpoints.playback}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    },
    [getValidAccessToken]
  )

  const handleTogglePlay = useCallback(async () => {
    if (!deviceId) {
      toast.error("No hay ningún dispositivo de reproducción disponible")
      return
    }

    setIsProcessing(true)
    try {
      if (isPlaying) {
        await performPlaybackAction(`/pause?device_id=${deviceId}`, "PUT")
        setPlaybackState({ isPlaying: false })
      } else {
        await performPlaybackAction(`/play?device_id=${deviceId}`, "PUT")
        setPlaybackState({ isPlaying: true })
      }
    } catch (error) {
      console.error("No se pudo alternar la reproducción", error)
      toast.error("No se pudo controlar la reproducción de Spotify")
    } finally {
      setIsProcessing(false)
    }
  }, [deviceId, isPlaying, performPlaybackAction, setPlaybackState])

  const handleNext = useCallback(async () => {
    if (!deviceId) {
      toast.error("No hay ningún dispositivo de reproducción disponible")
      return
    }

    setIsProcessing(true)
    try {
      await performPlaybackAction(`/next?device_id=${deviceId}`)
    } catch (error) {
      console.error("No se pudo avanzar de canción", error)
      toast.error("No se pudo avanzar la canción")
    } finally {
      setIsProcessing(false)
    }
  }, [deviceId, performPlaybackAction])

  const handlePrevious = useCallback(async () => {
    if (!deviceId) {
      toast.error("No hay ningún dispositivo de reproducción disponible")
      return
    }

    setIsProcessing(true)
    try {
      await performPlaybackAction(`/previous?device_id=${deviceId}`)
    } catch (error) {
      console.error("No se pudo retroceder canción", error)
      toast.error("No se pudo volver a la canción anterior")
    } finally {
      setIsProcessing(false)
    }
  }, [deviceId, performPlaybackAction])

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      const [vol] = value
      const normalized = Math.min(Math.max(vol, 0), 1)
      setVolume(normalized)
    },
    [setVolume]
  )

  if (!currentTrack) {
    return null
  }

  return (
    <div className="hidden md:flex items-center gap-3 rounded-full border bg-white/80 px-3 py-1 shadow-sm backdrop-blur">
      {currentTrack.albumImage && (
        <div className="relative h-10 w-10 overflow-hidden rounded-full">
          <Image src={currentTrack.albumImage} alt={currentTrack.name} fill className="object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{currentTrack.name}</span>
        <span className="truncate text-xs text-muted-foreground">{formattedArtists}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious} disabled={isProcessing}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8"
          onClick={handleTogglePlay}
          disabled={isProcessing}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext} disabled={isProcessing}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[volume]}
          max={1}
          min={0}
          step={0.01}
          className="w-24"
          onValueChange={handleVolumeChange}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="hidden lg:inline-flex"
        asChild
      >
        <a
          href={`https://open.spotify.com/track/${currentTrack.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir en Spotify
        </a>
      </Button>
    </div>
  )
}
