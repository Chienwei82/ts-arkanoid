/**
 * Audio preference persistence. Same shape as the record/control-scheme stores,
 * so the private-mode degradation behaviour is identical: a storage failure
 * keeps the in-memory default and never breaks the UI.
 */
const AUDIO_KEY = 'arkanoid.audio.v1'

export interface AudioPreferenceStore {
  load(): boolean
  save(enabled: boolean): void
}

export const createLocalStorageAudio = (): AudioPreferenceStore => ({
  load(): boolean {
    try {
      const raw = globalThis.localStorage?.getItem(AUDIO_KEY) ?? null
      if (raw === '0') return false
      if (raw === '1') return true
    } catch {
      // Storage can throw (private browsing, disabled cookies).
    }
    return true
  },
  save(enabled: boolean): void {
    try {
      globalThis.localStorage?.setItem(AUDIO_KEY, enabled ? '1' : '0')
    } catch {
      // Ignore quota / privacy failures; the choice stays for the session.
    }
  },
})

export const createMemoryAudio = (initial = true): AudioPreferenceStore => {
  let value = initial
  return {
    load: () => value,
    save: (next) => {
      value = next
    },
  }
}
