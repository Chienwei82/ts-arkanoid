import { describe, expect, it } from 'vitest'
import { SCORING } from '../src/config/gameConfig'
import { EventBus } from '../src/core/EventBus'
import type { GameEventMap } from '../src/core/events'
import { ScoringSystem } from '../src/systems/ScoringSystem'
import { createMemoryRecord } from '../src/utils/storage'
import { collect } from './helpers'

const createScoring = (initialRecord = 0) => {
  const bus = new EventBus<GameEventMap>()
  const storage = createMemoryRecord(initialRecord)
  return { bus, storage, scoring: new ScoringSystem(bus, storage) }
}

describe('ScoringSystem', () => {
  it('awards the configured points per brick type', () => {
    const { scoring } = createScoring()
    expect(scoring.registerBrickDestroy('normal')).toBe(SCORING.points.normal)
    expect(scoring.score).toBe(SCORING.points.normal)
    expect(scoring.combo).toBe(1)
  })

  it('raises the multiplier every combo step and caps it', () => {
    const { scoring } = createScoring()
    const gained: number[] = []
    for (let hit = 0; hit < SCORING.comboStep * SCORING.maxMultiplier; hit += 1) {
      gained.push(scoring.registerBrickDestroy('normal'))
    }

    expect(gained[0]).toBe(SCORING.points.normal)
    expect(gained[SCORING.comboStep]).toBe(SCORING.points.normal * 2)
    expect(gained[SCORING.comboStep * 2]).toBe(SCORING.points.normal * 3)
    expect(gained[gained.length - 1]).toBe(SCORING.points.normal * SCORING.maxMultiplier)
    expect(scoring.multiplier).toBe(SCORING.maxMultiplier)
  })

  it('persists only a better record and announces it', () => {
    const { bus, storage, scoring } = createScoring(100)
    const records = collect(bus, 'recordChanged')
    expect(scoring.record).toBe(100)

    scoring.registerBrickDestroy('normal')
    expect(records).toHaveLength(0)

    scoring.registerBrickDestroy('tough')
    expect(scoring.score).toBe(SCORING.points.normal + SCORING.points.tough)
    expect(scoring.record).toBe(scoring.score)
    expect(storage.load()).toBe(scoring.score)
    expect(records).toEqual([{ record: scoring.score }])
  })

  it('reports whether the running score beats the record held at run start', () => {
    const { scoring } = createScoring(SCORING.points.normal)
    expect(scoring.isRunRecord).toBe(false)

    scoring.registerBrickDestroy('normal')
    expect(scoring.isRunRecord).toBe(false)

    scoring.registerBrickDestroy('normal')
    expect(scoring.isRunRecord).toBe(true)

    scoring.resetRun()
    expect(scoring.isRunRecord).toBe(false)
    expect(scoring.startRecord).toBe(SCORING.points.normal * 2)
    expect(scoring.record).toBe(scoring.startRecord)
  })

  it('resets the combo and emits a score snapshot', () => {
    const { bus, scoring } = createScoring()
    const updates = collect(bus, 'scoreChanged')

    scoring.registerBrickDestroy('normal')
    scoring.resetCombo()

    expect(scoring.combo).toBe(0)
    expect(scoring.multiplier).toBe(1)
    expect(updates).toHaveLength(2)
    expect(updates[1]).toEqual({
      score: SCORING.points.normal,
      combo: 0,
      multiplier: 1,
      gained: 0,
    })

    scoring.resetCombo()
    expect(updates).toHaveLength(2)
  })

  it('clears score and combo when a new run starts', () => {
    const { scoring } = createScoring()
    scoring.registerBrickDestroy('tough')
    scoring.resetRun()

    expect(scoring.score).toBe(0)
    expect(scoring.combo).toBe(0)
    expect(scoring.record).toBe(SCORING.points.tough)
  })
})
