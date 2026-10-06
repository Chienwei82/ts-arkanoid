// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { DeviceInfo } from '../src/platform/DeviceDetector'
import {
  createLocalStorageControlScheme,
  createMemoryControlScheme,
  resolveControlScheme,
} from '../src/platform/ControlScheme'

const device = (overrides: Partial<DeviceInfo> = {}): DeviceInfo => ({
  kind: 'desktop',
  confidence: 'high',
  touch: false,
  ...overrides,
})

describe('control scheme storage', () => {
  it('round-trips the choice through memory storage', () => {
    const storage = createMemoryControlScheme()
    expect(storage.load()).toBeNull()
    storage.save('touch')
    expect(storage.load()).toBe('touch')
  })

  it('persists the choice in localStorage', () => {
    const first = createLocalStorageControlScheme()
    expect(first.load()).toBeNull()
    first.save('touch')

    expect(createLocalStorageControlScheme().load()).toBe('touch')
    globalThis.localStorage?.clear()
  })

  it('ignores unknown stored values', () => {
    globalThis.localStorage?.setItem('arkanoid.controls.v1', 'gamepad')
    expect(createLocalStorageControlScheme().load()).toBeNull()
    globalThis.localStorage?.clear()
  })
})

describe('resolveControlScheme', () => {
  it('always honours a stored choice', () => {
    expect(resolveControlScheme('desktop', device({ kind: 'mobile', touch: true }))).toBe('desktop')
    expect(resolveControlScheme('touch', device())).toBe('touch')
  })

  it('decides on its own when detection is confident', () => {
    expect(resolveControlScheme(null, device({ kind: 'mobile', touch: true }))).toBe('touch')
    expect(resolveControlScheme(null, device())).toBe('desktop')
  })

  it('asks the player when detection is ambiguous', () => {
    expect(resolveControlScheme(null, device({ confidence: 'low', touch: true }))).toBeNull()
    expect(resolveControlScheme(null, device({ confidence: 'low' }))).toBeNull()
  })
})
