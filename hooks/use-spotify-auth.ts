"use client"

import { useCallback } from "react"
import { refreshAccessToken } from "@/lib/spotify"
import { useSpotifyPlayerStore } from "./use-spotify-player"

const REFRESH_THRESHOLD = 60 * 1000

export function useSpotifyAuth() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || ""
  const { accessToken, refreshToken, expiresAt, setTokens, clearTokens } = useSpotifyPlayerStore(
    (state) => ({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      expiresAt: state.expiresAt,
      setTokens: state.setTokens,
      clearTokens: state.clearTokens,
    })
  )

  const getValidAccessToken = useCallback(async () => {
    if (!accessToken) {
      return null
    }

    if (!expiresAt || Date.now() < expiresAt - REFRESH_THRESHOLD) {
      return accessToken
    }

    if (!refreshToken || !clientId) {
      return accessToken
    }

    try {
      const refreshed = await refreshAccessToken(refreshToken, clientId)
      const nextRefreshToken = refreshed.refresh_token ?? refreshToken
      const expiresAtTimestamp = Date.now() + refreshed.expires_in * 1000

      setTokens({
        accessToken: refreshed.access_token,
        refreshToken: nextRefreshToken,
        expiresAt: expiresAtTimestamp,
      })

      return refreshed.access_token
    } catch (error) {
      console.error("Error al refrescar el token de Spotify", error)
      clearTokens()
      return null
    }
  }, [accessToken, expiresAt, refreshToken, clientId, setTokens, clearTokens])

  return {
    accessToken,
    refreshToken,
    expiresAt,
    setTokens,
    clearTokens,
    getValidAccessToken,
  }
}
