export type StorageSnapshot<T> = {
  version: number
  timestamp: number
  payload: T
}

const isBrowser = (): boolean => typeof window !== "undefined"

const safeLocalStorage = (): Storage | null => {
  if (!isBrowser()) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readSnapshot<T>(key: string): StorageSnapshot<T> | null {
  const storage = safeLocalStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorageSnapshot<T>
    if (typeof parsed !== "object" || parsed === null) return null
    if (typeof parsed.version !== "number" || typeof parsed.timestamp !== "number") return null
    if (!("payload" in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSnapshot<T>(key: string, snapshot: StorageSnapshot<T>): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(snapshot))
  } catch {
    // ignore quota errors
  }
}

export function clearSnapshot(key: string): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // ignore removal failures
  }
}
