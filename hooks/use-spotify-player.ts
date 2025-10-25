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
        set((state) => {
          if (
            state.accessToken === accessToken &&
            state.refreshToken === refreshToken &&
            state.expiresAt === expiresAt
          ) {
            return state
          }

          return { accessToken, refreshToken, expiresAt }
        }),
      clearTokens: () =>
        set((state) => {
          if (
            state.accessToken === null &&
            state.refreshToken === null &&
            state.expiresAt === null &&
            state.deviceId === null &&
            state.isPlaying === false &&
            state.currentTrack === null
          ) {
            return state
          }

          return {
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            deviceId: null,
            isPlaying: false,
            currentTrack: null,
          }
        }),
      setDeviceId: (deviceId) =>
        set((state) => (state.deviceId === deviceId ? state : { deviceId })),
      setPlaybackState: ({ isPlaying, track = undefined }) =>
        set((state) => {
          const nextTrack = track === undefined ? state.currentTrack : track ?? null

          const tracksAreEqual = (() => {
            if (state.currentTrack === nextTrack) {
              return true
            }

            if (!state.currentTrack || !nextTrack) {
              return false
            }

            return (
              state.currentTrack.id === nextTrack.id &&
              state.currentTrack.uri === nextTrack.uri &&
              state.currentTrack.name === nextTrack.name &&
              state.currentTrack.artists === nextTrack.artists &&
              state.currentTrack.albumImage === nextTrack.albumImage
            )
          })()

          if (state.isPlaying === isPlaying && tracksAreEqual) {
            return state
          }

          return {
            isPlaying,
            currentTrack: nextTrack,
          }
        }),
      setVolume: (volume) => set((state) => (state.volume === volume ? state : { volume })),
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
