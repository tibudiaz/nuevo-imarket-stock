"use client"

import { useEffect, useRef } from "react"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { useSpotifyPlayerStore } from "@/hooks/use-spotify-player"

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: any
  }
}

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js"

export function SpotifyPlayerManager() {
  const { accessToken, clearTokens, getValidAccessToken } = useSpotifyAuth()
  const { setDeviceId, setPlaybackState, volume } = useSpotifyPlayerStore(
    (state) => ({
      setDeviceId: state.setDeviceId,
      setPlaybackState: state.setPlaybackState,
      volume: state.volume,
    })
  )
  const playerRef = useRef<any>(null)
  const previousVolume = useRef(volume)

  useEffect(() => {
    const existingScript = document.getElementById("spotify-player-sdk") as HTMLScriptElement | null

    const initializePlayer = async () => {
      if (!window.Spotify || playerRef.current || !accessToken) {
        return
      }

      const player = new window.Spotify.Player({
        name: "iMarket Music",
        getOAuthToken: async (cb) => {
          const token = await getValidAccessToken()
          if (token) {
            cb(token)
          }
        },
        volume: volume,
      })

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id)
      })

      player.addListener("not_ready", ({ device_id }) => {
        const currentId = useSpotifyPlayerStore.getState().deviceId
        if (currentId === device_id) {
          setDeviceId(null)
        }
      })

      player.addListener("initialization_error", ({ message }) => {
        console.error("Error al inicializar el reproductor de Spotify", message)
      })

      player.addListener("authentication_error", ({ message }) => {
        console.error("Error de autenticación con Spotify", message)
        clearTokens()
      })

      player.addListener("account_error", ({ message }) => {
        console.error("Error de cuenta de Spotify", message)
      })

      player.addListener("player_state_changed", (state: any | null) => {
        if (!state || !state.track_window?.current_track) {
          setPlaybackState({ isPlaying: false, track: null })
          return
        }

        const currentTrack = state.track_window.current_track

        setPlaybackState({
          isPlaying: !state.paused,
          track: {
            id: currentTrack.id,
            name: currentTrack.name,
            artists: currentTrack.artists.map((artist) => artist.name).join(", "),
            albumImage: currentTrack.album.images?.[0]?.url,
            uri: currentTrack.uri,
          },
        })
      })

      const connected = await player.connect()
      if (connected) {
        playerRef.current = player
      } else {
        console.error("No se pudo conectar con el reproductor de Spotify")
      }
    }

    if (!accessToken) {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
      setDeviceId(null)
      setPlaybackState({ isPlaying: false, track: null })
      return
    }

    if (!existingScript) {
      const script = document.createElement("script")
      script.id = "spotify-player-sdk"
      script.src = SDK_SRC
      script.async = true
      document.body.appendChild(script)
      window.onSpotifyWebPlaybackSDKReady = initializePlayer
    } else {
      if (window.Spotify) {
        initializePlayer()
      } else {
        window.onSpotifyWebPlaybackSDKReady = initializePlayer
      }
    }

    return () => {
      window.onSpotifyWebPlaybackSDKReady = undefined
    }
  }, [accessToken, getValidAccessToken, clearTokens, setDeviceId, setPlaybackState, volume])

  useEffect(() => {
    if (!playerRef.current) {
      return
    }

    if (previousVolume.current !== volume) {
      previousVolume.current = volume
      playerRef.current.setVolume(volume).catch((error: unknown) => {
        console.error("No se pudo ajustar el volumen", error)
      })
    }
  }, [volume])

  return null
}
