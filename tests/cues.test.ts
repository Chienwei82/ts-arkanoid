import { describe, expect, it } from 'vitest'
import type { PowerUpStatus, PowerUpType } from '../src/entities/types'
import { POWER_UP_PRIORITY, primaryPowerUp } from '../src/rendering/cues'

const running = (...types: readonly PowerUpType[]): PowerUpStatus[] =>
  types.map((type) => ({ type, remaining: 1 }))

describe('paddle power-up cue', () => {
  it('returns null when nothing is running', () => {
    expect(primaryPowerUp([])).toBeNull()
  })

  it('picks the single running power-up', () => {
    expect(primaryPowerUp(running('wide'))).toBe('wide')
  })

  it('resolves the highest-priority power-up when several run', () => {
    expect(primaryPowerUp(running('life', 'slow', 'wide'))).toBe('wide')
    expect(primaryPowerUp(running('life', 'laser'))).toBe('laser')
  })

  it('keeps a deterministic, duplicate-free priority covering every type', () => {
    expect(new Set(POWER_UP_PRIORITY).size).toBe(POWER_UP_PRIORITY.length)
    expect(POWER_UP_PRIORITY).toHaveLength(7)
  })
})
