"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface SpotifyTrack {
  id: string
  name: string
  artists: string
  albumImage?: string
  uri: string
}

interface SpotifyTokens {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
}

interface SpotifyState extends SpotifyTokens {
  deviceId: string | null
  isPlaying: boolean
  currentTrack: SpotifyTrack | null
  volume: number
  setTokens: (tokens: SpotifyTokens) => void
  clearTokens: () => void
  setDeviceId: (deviceId: string | null) => void
  setPlaybackState: (state: { isPlaying: boolean; track?: SpotifyTrack | null }) => void
  setVolume: (volume: number) => void
}

export const useSpotifyPlayerStore = create<SpotifyState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      deviceId: null,
      isPlaying: false,
      currentTrack: null,
      volume: 0.5,
      setTokens: ({ accessToken, refreshToken, expiresAt }) =>
        set({ accessToken, refreshToken, expiresAt }),
      clearTokens: () =>
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          deviceId: null,
          isPlaying: false,
          currentTrack: null,
        }),
      setDeviceId: (deviceId) => set({ deviceId }),
      setPlaybackState: ({ isPlaying, track = undefined }) =>
        set((state) => ({
          isPlaying,
          currentTrack: track === undefined ? state.currentTrack : track,
        })),
      setVolume: (volume) => set({ volume }),
    }),
    {
      name: "spotify-player-state",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        volume: state.volume,
      }),
    }
  )
)
