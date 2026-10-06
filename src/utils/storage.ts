/** Score persistence behind an interface so tests can inject memory storage. */

export interface RecordStorage {
  load(): number
  save(value: number): void
}

const RECORD_KEY = 'arkanoid.record.v1'

export const createLocalStorageRecord = (): RecordStorage => ({
  load(): number {
    try {
      const raw = globalThis.localStorage?.getItem(RECORD_KEY) ?? null
      const value = raw === null ? 0 : Number(raw)
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      // Storage can throw (private browsing, disabled cookies).
      return 0
    }
  },
  save(value: number): void {
    try {
      globalThis.localStorage?.setItem(RECORD_KEY, String(value))
    } catch {
      // Ignore quota / privacy failures; the record stays in memory for the session.
    }
  },
})

export const createMemoryRecord = (initial = 0): RecordStorage => {
  let value = initial
  return {
    load: () => value,
    save: (next) => {
      value = next
    },
  }
}
