/**
 * Genre preference persistence. Same shape and failure behaviour as
 * `preferences.ts`: localStorage with try/catch, in-memory fallback,
 * private-mode safe.
 */
const GENRE_KEY = 'arkanoid.audio.genre.v1'

export interface GenrePreferenceStore {
  load(): string
  save(genre: string): void
}

export const createLocalStorageGenre = (): GenrePreferenceStore => ({
  load(): string {
    try {
      const raw = globalThis.localStorage?.getItem(GENRE_KEY) ?? null
      if (raw && typeof raw === 'string' && raw.length > 0) return raw
    } catch {
      // Storage can throw (private browsing, disabled cookies).
    }
    return 'electronic'
  },
  save(genre: string): void {
    try {
      globalThis.localStorage?.setItem(GENRE_KEY, genre)
    } catch {
      // Ignore quota / privacy failures; the choice stays for the session.
    }
  },
})

export const createMemoryGenre = (initial = 'electronic'): GenrePreferenceStore => {
  let value = initial
  return {
    load: () => value,
    save: (next) => {
      value = next
    },
  }
}