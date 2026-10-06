import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageRecord, createMemoryRecord } from '../src/utils/storage'

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

describe('record storage', () => {
  it('starts at zero and persists a better record', () => {
    const fake = createFakeStorage()
    vi.stubGlobal('localStorage', fake)
    const storage = createLocalStorageRecord()

    expect(storage.load()).toBe(0)
    storage.save(1234)
    expect(storage.load()).toBe(1234)
    expect([...fake.store.values()]).toEqual(['1234'])
  })

  it('ignores corrupt, negative and non numeric values', () => {
    const fake = createFakeStorage()
    vi.stubGlobal('localStorage', fake)
    const storage = createLocalStorageRecord()

    for (const raw of ['not-a-number', '-5', '', 'NaN', 'Infinity']) {
      fake.store.set('arkanoid.record.v1', raw)
      expect(storage.load()).toBe(0)
    }
  })

  it('degrades to zero when reading throws (private browsing)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
    })

    expect(createLocalStorageRecord().load()).toBe(0)
  })

  it('keeps working when writing throws (quota exceeded)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(() => {
      createLocalStorageRecord().save(999)
    }).not.toThrow()
  })

  it('survives an environment without localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    const storage = createLocalStorageRecord()

    expect(storage.load()).toBe(0)
    expect(() => {
      storage.save(10)
    }).not.toThrow()
  })

  it('offers an in-memory implementation for tests and headless runs', () => {
    const storage = createMemoryRecord(42)
    expect(storage.load()).toBe(42)
    storage.save(7)
    expect(storage.load()).toBe(7)
  })
})
