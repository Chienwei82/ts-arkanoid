import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageAudio, createMemoryAudio } from '../src/audio/preferences'

interface FakeStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly store: Map<string, string>
}

const createFakeStorage = (): FakeStorage => {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('audio preference storage', () => {
  it('defaults to on and persists the mute choice', () => {
    const fake = createFakeStorage()
    vi.stubGlobal('localStorage', fake)
    const prefs = createLocalStorageAudio()

    expect(prefs.load()).toBe(true)
    prefs.save(false)
    expect(prefs.load()).toBe(false)
    prefs.save(true)
    expect(prefs.load()).toBe(true)
    expect([...fake.store.values()]).toEqual(['1'])
  })

  it('degrades to on when reading throws (private browsing)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    })

    expect(createLocalStorageAudio().load()).toBe(true)
  })

  it('keeps working when writing throws (quota exceeded)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => {
      createLocalStorageAudio().save(false)
    }).not.toThrow()
  })

  it('survives an environment without localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    const prefs = createLocalStorageAudio()

    expect(prefs.load()).toBe(true)
    expect(() => {
      prefs.save(false)
    }).not.toThrow()
  })

  it('offers an in-memory implementation for tests and headless runs', () => {
    const prefs = createMemoryAudio(false)
    expect(prefs.load()).toBe(false)
    prefs.save(true)
    expect(prefs.load()).toBe(true)
  })
})
