import { describe, expect, it } from 'vitest'
import { BRICK } from '../src/config/gameConfig'
import { brickBehaviors, brickHitPoints } from '../src/entities/BrickBehavior'
import { createBricks } from '../src/entities/brickFactory'
import { testLevel } from './helpers'

const bricksOf = (row: string) => createBricks(testLevel([row]))

/** Indestructible bricks cannot clear a level, so pair them with a normal one. */
const PAIRED_ROWS = 'X#'

describe('brick behaviours (Strategy)', () => {
  it('destroys a normal brick with a single hit', () => {
    const [brick] = bricksOf('#')
    expect(brick.behavior).toBe(brickBehaviors.normal)
    expect(brick.behavior.hit(brick)).toEqual({ destroyed: true, explodes: false })
    expect(brick.hitsLeft).toBe(0)
  })

  it('wears tough bricks down over several hits', () => {
    const [brick] = bricksOf('+')
    expect(brick.hitsLeft).toBe(BRICK.toughHits)

    const outcomes: boolean[] = []
    for (let hit = 0; hit < BRICK.toughHits; hit += 1) {
      outcomes.push(brick.behavior.hit(brick).destroyed)
    }
    expect(outcomes).toEqual([false, false, true])
  })

  it('never lets an indestructible brick be destroyed', () => {
    const [brick] = bricksOf(PAIRED_ROWS)
    expect(brick.type).toBe('indestructible')
    for (let hit = 0; hit < 5; hit += 1) {
      expect(brick.behavior.hit(brick).destroyed).toBe(false)
    }
    expect(brick.hitsLeft).toBe(brick.baseHits)
  })

  it('blows up explosive bricks immediately and flags the chain', () => {
    const [brick] = bricksOf('!')
    expect(brick.behavior.hit(brick)).toEqual({ destroyed: true, explodes: true })
  })

  it('exposes hit points per brick type', () => {
    expect(brickHitPoints('normal')).toBe(1)
    expect(brickHitPoints('tough')).toBe(BRICK.toughHits)
    expect(brickHitPoints('indestructible')).toBe(1)
    expect(brickHitPoints('explosive')).toBe(1)
  })
})
