"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_SCOPES,
  buildAuthorizeUrl,
  fetchSpotify,
  generateCodeChallenge,
  generateCodeVerifier,
  getRedirectUri,
  requestTokens,
  spotifyEndpoints,
} from "@/lib/spotify"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { useSpotifyPlayerStore } from "@/hooks/use-spotify-player"
import { Loader2, LogOut, Search, Headphones, Music2, Radio, Link as LinkIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { safeLocalStorage, type SafeStorageResult } from "@/lib/safe-storage"

interface SpotifyUserProfile {
  id: string
  display_name: string
  email?: string
  images?: { url: string }[]
}

interface SpotifyPlaylist {
  id: string
  name: string
  description?: string
  images?: { url: string }[]
  tracks: { total: number }
  uri: string
  owner: { display_name?: string }
}

interface SpotifyTrackItem {
  id: string
  name: string
  uri: string
  artists: { name: string }[]
  album: { name: string; images?: { url: string }[] }
  duration_ms: number
}

interface SearchResults {
  tracks: SpotifyTrackItem[]
  playlists: SpotifyPlaylist[]
}

const CODE_VERIFIER_KEY = "spotify_code_verifier"
const STATE_KEY = "spotify_auth_state"

export default function MusicPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = useMemo(() => searchParams?.toString() ?? "", [searchParams])
  const clientId = SPOTIFY_CLIENT_ID
  const { accessToken, setTokens, clearTokens, getValidAccessToken } = useSpotifyAuth()
  const { deviceId, currentTrack } = useSpotifyPlayerStore((state) => ({
    deviceId: state.deviceId,
    currentTrack: state.currentTrack,
  }))

  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [userProfile, setUserProfile] = useState<SpotifyUserProfile | null>(null)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResults>({ tracks: [], playlists: [] })
  const [isSearching, setIsSearching] = useState(false)
  const storageErrorRef = useRef(false)

  const handleStorageResult = (
    result: SafeStorageResult<unknown>,
    description: string,
  ) => {
    if (!result.ok) {
      if (!storageErrorRef.current) {
        storageErrorRef.current = true
        toast.error("No se pudo acceder a los datos guardados de Spotify", {
          description,
        })
      }
    } else if (storageErrorRef.current) {
      storageErrorRef.current = false
    }
  }

  const isAuthenticated = useMemo(() => Boolean(accessToken), [accessToken])

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const code = params.get("code")
    const errorParam = params.get("error")

    if (!code && !errorParam) {
      return
    }

    const handleAuthResponse = async () => {
      if (errorParam) {
        toast.error("Spotify rechazó la autenticación", {
          description: "Intentá nuevamente o verificá los permisos de la aplicación.",
        })
        router.replace("/dashboard/music")
        return
      }

      const storedStateResult = safeLocalStorage.getItem(STATE_KEY)
      handleStorageResult(
        storedStateResult,
        "No se pudo validar el estado de seguridad de la autenticación con Spotify.",
      )
      const storedState = storedStateResult.value
      const returnedState = params.get("state")
      if (storedState && storedState !== returnedState) {
        toast.error("La verificación del inicio de sesión falló. Intentá nuevamente.")
        handleStorageResult(
          safeLocalStorage.removeItem(CODE_VERIFIER_KEY),
          "No se pudieron limpiar los datos temporales de la autenticación.",
        )
        handleStorageResult(
          safeLocalStorage.removeItem(STATE_KEY),
          "No se pudieron limpiar los datos temporales de la autenticación.",
        )
        router.replace("/dashboard/music")
        return
      }

      const codeVerifierResult = safeLocalStorage.getItem(CODE_VERIFIER_KEY)
      handleStorageResult(
        codeVerifierResult,
        "No se pudo recuperar el código temporal necesario para conectar Spotify.",
      )
      const codeVerifier = codeVerifierResult.value
      if (!codeVerifier || !clientId) {
        toast.error("Faltan datos para completar la conexión con Spotify.")
        router.replace("/dashboard/music")
        return
      }

      try {
        const tokenResponse = await requestTokens({
          client_id: clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: getRedirectUri(),
          code_verifier: codeVerifier,
        })

        const expiresAt = Date.now() + tokenResponse.expires_in * 1000
        setTokens({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token ?? null,
          expiresAt,
        })
        toast.success("Spotify conectado", {
          description: "Ya podés reproducir tu música favorita.",
        })
      } catch (error) {
        console.error("No se pudo completar la autenticación con Spotify", error)
        toast.error("No se pudo conectar con Spotify")
        clearTokens()
      } finally {
        handleStorageResult(
          safeLocalStorage.removeItem(CODE_VERIFIER_KEY),
          "No se pudieron limpiar los datos temporales de la autenticación.",
        )
        handleStorageResult(
          safeLocalStorage.removeItem(STATE_KEY),
          "No se pudieron limpiar los datos temporales de la autenticación.",
        )
        router.replace("/dashboard/music")
      }
    }

    handleAuthResponse()
  }, [searchParamsString, router, clientId, setTokens, clearTokens])

  useEffect(() => {
    if (!isAuthenticated) {
      setUserProfile((previous) => (previous !== null ? null : previous))
      setPlaylists((previous) => (previous.length > 0 ? [] : previous))
      return
    }

    const loadUserData = async () => {
      try {
        const token = await getValidAccessToken()
        if (!token) return

        const profile = await fetchSpotify<SpotifyUserProfile>(spotifyEndpoints.me, token)
        setUserProfile(profile)

        setIsLoadingPlaylists(true)
        const playlistResponse = await fetchSpotify<{ items: SpotifyPlaylist[] }>(
          `${spotifyEndpoints.playlists}?limit=30`,
          token
        )
        setPlaylists(playlistResponse.items)
      } catch (error) {
        console.error("No se pudieron cargar los datos de Spotify", error)
        toast.error("No se pudieron cargar tus datos de Spotify")
      } finally {
        setIsLoadingPlaylists(false)
      }
    }

    loadUserData()
  }, [isAuthenticated, getValidAccessToken])

  const handleConnect = useCallback(async () => {
    if (!clientId) {
      toast.error("Falta configurar el identificador de cliente de Spotify")
      return
    }

    try {
      setIsAuthorizing(true)
      const verifier = await generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      const state = crypto.randomUUID()

      handleStorageResult(
        safeLocalStorage.setItem(CODE_VERIFIER_KEY, verifier),
        "No se pudo guardar la información temporal para iniciar sesión con Spotify.",
      )
      handleStorageResult(
        safeLocalStorage.setItem(STATE_KEY, state),
        "No se pudo guardar la información temporal para iniciar sesión con Spotify.",
      )

      const authorizeUrl = buildAuthorizeUrl({
        client_id: clientId,
        response_type: "code",
        redirect_uri: getRedirectUri(),
        scope: SPOTIFY_SCOPES.join(" "),
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        show_dialog: "true",
      })

      window.location.href = authorizeUrl
    } catch (error) {
      console.error("No se pudo iniciar la autenticación con Spotify", error)
      toast.error("No se pudo redirigir a Spotify")
    } finally {
      setIsAuthorizing(false)
    }
  }, [clientId])

  const handleDisconnect = useCallback(() => {
    clearTokens()
    setUserProfile(null)
    setPlaylists([])
    setSearchResults({ tracks: [], playlists: [] })
    toast("Sesión de Spotify cerrada")
  }, [clearTokens])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults({ tracks: [], playlists: [] })
      return
    }

    try {
      setIsSearching(true)
      const token = await getValidAccessToken()
      if (!token) {
        toast.error("Iniciá sesión en Spotify para realizar búsquedas")
        return
      }

      const response = await fetchSpotify<{ tracks?: { items: SpotifyTrackItem[] }; playlists?: { items: SpotifyPlaylist[] } }>(
        `${spotifyEndpoints.search}?type=track,playlist&limit=10&q=${encodeURIComponent(searchQuery)}`,
        token
      )

      setSearchResults({
        tracks: response.tracks?.items ?? [],
        playlists: response.playlists?.items ?? [],
      })
    } catch (error) {
      console.error("No se pudo realizar la búsqueda en Spotify", error)
      toast.error("No se pudo completar la búsqueda")
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, getValidAccessToken])

  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const ensureDeviceReady = useCallback(() => {
    if (!deviceId) {
      toast.warning("Esperá un instante mientras activamos el reproductor")
      return false
    }
    return true
  }, [deviceId])

  const playPlaylist = useCallback(
    async (playlist: SpotifyPlaylist) => {
      if (!ensureDeviceReady()) return

      try {
        const token = await getValidAccessToken()
        if (!token) return

        await fetchSpotify(
          `${spotifyEndpoints.playback}/play?device_id=${deviceId}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({ context_uri: playlist.uri }),
          }
        )
        toast.success(`Reproduciendo playlist “${playlist.name}”`)
      } catch (error) {
        console.error("No se pudo iniciar la playlist", error)
        toast.error("No se pudo reproducir la playlist")
      }
    },
    [deviceId, getValidAccessToken, ensureDeviceReady]
  )

  const playTrack = useCallback(
    async (track: SpotifyTrackItem) => {
      if (!ensureDeviceReady()) return

      try {
        const token = await getValidAccessToken()
        if (!token) return

        await fetchSpotify(
          `${spotifyEndpoints.playback}/play?device_id=${deviceId}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({ uris: [track.uri] }),
          }
        )
        toast.success(`Reproduciendo ${track.name}`)
      } catch (error) {
        console.error("No se pudo reproducir la canción", error)
        toast.error("No se pudo reproducir la canción")
      }
    },
    [deviceId, getValidAccessToken, ensureDeviceReady]
  )

  const handleSubmitSearch = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      handleSearch()
    },
    [handleSearch]
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Música</h1>
              <p className="text-sm text-muted-foreground">
                Conectá tu cuenta Premium de Spotify para ambientar el local y mantener tu música favorita siempre a mano.
                Podés iniciar sesión escaneando el código QR oficial desde la pantalla de Spotify.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <Button variant="outline" onClick={handleDisconnect} size="sm">
                  <LogOut className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={isAuthorizing}>
                  {isAuthorizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Headphones className="mr-2 h-4 w-4" />}
                  Conectar con Spotify
                </Button>
              )}
            </div>
          </div>
          {isAuthenticated && userProfile && (
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-slate-200">
                {userProfile.images?.[0]?.url ? (
                  <Image src={userProfile.images[0].url} alt={userProfile.display_name} fill className="object-cover" />
                ) : (
                  <Music2 className="m-4 h-8 w-8 text-slate-500" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold">{userProfile.display_name}</span>
                {userProfile.email && <span className="text-sm text-muted-foreground">{userProfile.email}</span>}
                <Badge className="mt-1 w-fit" variant="secondary">
                  Cuenta conectada
                </Badge>
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="playlists" className="space-y-6">
          <TabsList>
            <TabsTrigger value="playlists">Tus playlists</TabsTrigger>
            <TabsTrigger value="buscar">Buscar</TabsTrigger>
            <TabsTrigger value="ahora">En reproducción</TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Radio className="h-5 w-5" /> Tus playlists
                </CardTitle>
                <CardDescription>Elegí una lista y comenzá a reproducirla en segundos.</CardDescription>
              </CardHeader>
              <CardContent>
                {!isAuthenticated && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Conectá tu cuenta para ver tus playlists personalizadas.
                  </div>
                )}

                {isAuthenticated && isLoadingPlaylists && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando tus playlists...
                  </div>
                )}

                {isAuthenticated && !isLoadingPlaylists && playlists.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No encontramos playlists en tu cuenta. Creá una en Spotify y volvé a intentarlo.
                  </div>
                )}

                {isAuthenticated && playlists.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {playlists.map((playlist) => (
                      <Card key={playlist.id} className="overflow-hidden border shadow-sm">
                        <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
                          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-200">
                            {playlist.images?.[0]?.url ? (
                              <Image src={playlist.images[0].url} alt={playlist.name} fill className="object-cover" />
                            ) : (
                              <Music2 className="m-3 h-10 w-10 text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-semibold">{playlist.name}</h3>
                            <p className="truncate text-xs text-muted-foreground">
                              {playlist.owner?.display_name ?? "Playlist personal"}
                            </p>
                            <p className="text-xs text-muted-foreground">{playlist.tracks.total} canciones</p>
                          </div>
                        </CardHeader>
                        <CardFooter className="flex justify-between gap-2 p-4">
                          <Button size="sm" onClick={() => playPlaylist(playlist)} className="flex-1">
                            Reproducir
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`https://open.spotify.com/playlist/${playlist.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <LinkIcon className="mr-2 h-4 w-4" /> Ver
                            </a>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buscar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5" /> Buscar música
                </CardTitle>
                <CardDescription>Buscá canciones o playlists de Spotify para reproducirlas al instante.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmitSearch} className="flex flex-col gap-3 md:flex-row">
                  <Input
                    placeholder="Artista, canción o playlist"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    disabled={!isAuthenticated}
                  />
                  <Button type="submit" disabled={!isAuthenticated || isSearching}>
                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar
                  </Button>
                </form>

                {!isAuthenticated && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Iniciá sesión en Spotify para buscar canciones.
                  </div>
                )}

                {isAuthenticated && searchResults.tracks.length === 0 && searchResults.playlists.length === 0 && searchQuery && !isSearching && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No encontramos resultados para “{searchQuery}”.
                  </div>
                )}

                {searchResults.tracks.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">Canciones</h3>
                    <div className="space-y-2">
                      {searchResults.tracks.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-white/80 p-3 shadow-sm"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative h-12 w-12 overflow-hidden rounded-md bg-slate-200">
                              {track.album.images?.[0]?.url ? (
                                <Image src={track.album.images[0].url} alt={track.name} fill className="object-cover" />
                              ) : (
                                <Music2 className="m-2 h-8 w-8 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{track.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {track.artists.map((artist) => artist.name).join(", ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{formatDuration(track.duration_ms)}</span>
                            <Button size="sm" onClick={() => playTrack(track)}>
                              Reproducir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.playlists.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">Playlists</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {searchResults.playlists.map((playlist) => (
                        <Card key={playlist.id} className="overflow-hidden border shadow-sm">
                          <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
                            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-200">
                              {playlist.images?.[0]?.url ? (
                                <Image src={playlist.images[0].url} alt={playlist.name} fill className="object-cover" />
                              ) : (
                                <Music2 className="m-3 h-10 w-10 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-base font-semibold">{playlist.name}</h3>
                              {playlist.description && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">{playlist.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{playlist.tracks.total} canciones</p>
                            </div>
                          </CardHeader>
                          <CardFooter className="flex justify-between gap-2 p-4">
                            <Button size="sm" onClick={() => playPlaylist(playlist)} className="flex-1">
                              Reproducir
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={`https://open.spotify.com/playlist/${playlist.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <LinkIcon className="mr-2 h-4 w-4" /> Ver
                              </a>
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ahora">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Headphones className="h-5 w-5" /> Ahora sonando
                </CardTitle>
                <CardDescription>
                  Controlá lo que está sonando sin salir del tablero principal. Si cambiás de pestaña, el reproductor seguirá
                  disponible en la parte superior.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!currentTrack && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Todavía no hay música reproduciéndose. Elegí una canción o playlist para comenzar.
                  </div>
                )}

                {currentTrack && (
                  <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:text-left">
                    <div className="relative h-40 w-40 overflow-hidden rounded-2xl bg-slate-200">
                      {currentTrack.albumImage ? (
                        <Image src={currentTrack.albumImage} alt={currentTrack.name} fill className="object-cover" />
                      ) : (
                        <Music2 className="m-10 h-20 w-20 text-slate-500" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold">{currentTrack.name}</h3>
                      <p className="text-base text-muted-foreground">{currentTrack.artists}</p>
                      <p className="text-sm text-muted-foreground">
                        Recordá que Spotify permite hasta tres reproducciones simultáneas con esta configuración personalizada.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
