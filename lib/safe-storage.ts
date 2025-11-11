export type SafeStorageResult<T> = {
  ok: boolean
  value?: T
  error?: unknown
}

const unavailableError = () =>
  new Error("localStorage no está disponible en este entorno")

const withStorage = <T>(
  key: string,
  action: (storage: Storage) => T,
): SafeStorageResult<T> => {
  if (typeof window === "undefined") {
    return { ok: false, error: unavailableError() }
  }

  try {
    const value = action(window.localStorage)
    return { ok: true, value }
  } catch (error) {
    console.error(`[safeLocalStorage] Error al acceder a la clave "${key}":`, error)
    return { ok: false, error }
  }
}

export const safeLocalStorage = {
  getItem: (key: string): SafeStorageResult<string | null> =>
    withStorage(key, (storage) => storage.getItem(key)),
  setItem: (key: string, value: string): SafeStorageResult<void> =>
    withStorage(key, (storage) => {
      storage.setItem(key, value)
    }),
  removeItem: (key: string): SafeStorageResult<void> =>
    withStorage(key, (storage) => {
      storage.removeItem(key)
    }),
}

export type SafeStorageLike = {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

export const safeStorageLike: SafeStorageLike = {
  getItem: (name) => safeLocalStorage.getItem(name).value ?? null,
  setItem: (name, value) => {
    safeLocalStorage.setItem(name, value)
  },
  removeItem: (name) => {
    safeLocalStorage.removeItem(name)
  },
}
