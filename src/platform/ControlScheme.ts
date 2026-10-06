import type { DeviceInfo } from './DeviceDetector'

/** Control layout the player uses: keyboard/mouse or on-screen touch widgets. */
export type ControlScheme = 'desktop' | 'touch'

/** Choice persistence behind an interface so tests can inject memory storage. */
export interface ControlSchemeStorage {
  load(): ControlScheme | null
  save(scheme: ControlScheme): void
}

const SCHEME_KEY = 'arkanoid.controls.v1'

const isControlScheme = (value: string | null): value is ControlScheme =>
  value === 'desktop' || value === 'touch'

export const createLocalStorageControlScheme = (): ControlSchemeStorage => ({
  load(): ControlScheme | null {
    try {
      const raw = globalThis.localStorage?.getItem(SCHEME_KEY) ?? null
      return isControlScheme(raw) ? raw : null
    } catch {
      // Storage can throw (private browsing, disabled cookies).
      return null
    }
  },
  save(scheme: ControlScheme): void {
    try {
      globalThis.localStorage?.setItem(SCHEME_KEY, scheme)
    } catch {
      // Ignore quota / privacy failures; the choice lasts for the session.
    }
  },
})

export const createMemoryControlScheme = (
  initial: ControlScheme | null = null,
): ControlSchemeStorage => {
  let value = initial
  return {
    load: () => value,
    save: (next) => {
      value = next
    },
  }
}

/**
 * Boot decision for the control scheme: a stored choice always wins, then a
 * confident device detection decides on its own, and anything ambiguous returns
 * null so the UI can ask the player before the scene starts.
 */
export const resolveControlScheme = (
  stored: ControlScheme | null,
  device: DeviceInfo,
): ControlScheme | null => {
  if (stored !== null) return stored
  if (device.confidence === 'low') return null
  return device.touch ? 'touch' : 'desktop'
}
