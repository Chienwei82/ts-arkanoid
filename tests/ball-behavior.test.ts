import { describe, expect, it } from 'vitest'
import {
  SPECIAL_BALL_TYPES,
  ballBehaviors,
  rollSpecialBallType,
} from '../src/entities/ballBehavior'
import type { BallType } from '../src/entities/types'

const ALL_TYPES: readonly BallType[] = ['standard', 'fire', 'heavy', 'bomb']

describe('ball behaviours (Strategy)', () => {
  it('defines one behaviour per ball flavour', () => {
    for (const type of ALL_TYPES) expect(ballBehaviors[type].type).toBe(type)
  })

  it('flags the lethal and chaining flavours', () => {
    expect(ballBehaviors.standard).toMatchObject({ lethal: false, chains: false })
    expect(ballBehaviors.heavy).toMatchObject({ lethal: true, chains: false })
    expect(ballBehaviors.fire).toMatchObject({ lethal: false, chains: true })
    expect(ballBehaviors.bomb).toMatchObject({ lethal: true, chains: true })
  })

  it('rolls a special flavour from an injected RNG', () => {
    expect(rollSpecialBallType(() => 0)).toBe(SPECIAL_BALL_TYPES[0])
    expect(rollSpecialBallType(() => 0.999)).toBe(SPECIAL_BALL_TYPES[SPECIAL_BALL_TYPES.length - 1])
  })

  it('never rolls the plain standard ball', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(SPECIAL_BALL_TYPES).not.toContain('standard')
    }
    expect(SPECIAL_BALL_TYPES).toHaveLength(3)
  })
})
