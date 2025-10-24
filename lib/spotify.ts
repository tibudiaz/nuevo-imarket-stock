const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com"
const SPOTIFY_API_BASE = "https://api.spotify.com/v1"

const DEFAULT_SPOTIFY_CLIENT_ID = "65f4deea9af04d7db118d47dcc544ebb"
export const SPOTIFY_CLIENT_ID =
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ||
  process.env.SPOTIFY_CLIENT_ID ||
  DEFAULT_SPOTIFY_CLIENT_ID

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
]

export const spotifyEndpoints = {
  authorize: `${SPOTIFY_ACCOUNTS_BASE}/authorize`,
  token: `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
  me: `${SPOTIFY_API_BASE}/me`,
  playlists: `${SPOTIFY_API_BASE}/me/playlists`,
  search: `${SPOTIFY_API_BASE}/search`,
  playback: `${SPOTIFY_API_BASE}/me/player`,
}

function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function generateCodeVerifier(length = 64) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let verifier = ""
  const randomValues = crypto.getRandomValues(new Uint32Array(length))

  for (let i = 0; i < length; i++) {
    verifier += possible.charAt(randomValues[i] % possible.length)
  }

  return verifier
}

export async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(digest)
}

export function getRedirectUri() {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/dashboard/music`
}

export function buildAuthorizeUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params)
  return `${spotifyEndpoints.authorize}?${query.toString()}`
}

export async function requestTokens(body: Record<string, string>) {
  const params = new URLSearchParams(body)

  if (!params.has("client_id") && SPOTIFY_CLIENT_ID) {
    params.set("client_id", SPOTIFY_CLIENT_ID)
  }

  const response = await fetch(spotifyEndpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error("No se pudo obtener el token de Spotify")
  }

  return response.json()
}

export async function refreshAccessToken(refreshToken: string, clientId: string) {
  const tokenResponse = await requestTokens({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })

  return tokenResponse as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }
}

export async function fetchSpotify<T>(
  url: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  })

  if (response.status === 204) {
    return {} as T
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || "Error al comunicarse con Spotify")
  }

  return response.json()
}
