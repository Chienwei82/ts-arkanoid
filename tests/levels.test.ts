import { describe, expect, it } from 'vitest'
import { FIELD, BRICK } from '../src/config/gameConfig'
import { PALETTE } from '../src/config/palette'
import { brickHitPoints, brickBehaviors } from '../src/entities/BrickBehavior'
import { createBricks } from '../src/entities/brickFactory'
import { LEVELS, getLevel, parseLevel, parseLevels, LevelParseError } from '../src/levels'
import type { LevelDefinition } from '../src/levels'
import { brickPosition, computeGridLayout } from '../src/levels/grid'
import { hexToInt } from '../src/utils/math'
import { testLevel } from './helpers'

describe('grid layout', () => {
  it('spreads the columns across the usable field width', () => {
    const definition = testLevel(['.....', '.....'])
    const grid = computeGridLayout(definition)

    expect(grid.cols).toBe(5)
    expect(grid.rows).toBe(2)
    const usable = 2 * FIELD.halfWidth - 2 * BRICK.sidePadding
    expect(grid.brickWidth * 5 + BRICK.gap * 4).toBeCloseTo(usable)
    expect(grid.brickHeight).toBe(BRICK.height)
  })

  it('places row zero at the top and columns left to right', () => {
    const grid = computeGridLayout(testLevel(['...', '...']))
    const first = brickPosition(grid, 0, 0)
    const rightNeighbour = brickPosition(grid, 0, 1)
    const lowerRow = brickPosition(grid, 1, 0)

    expect(first.x).toBeLessThan(rightNeighbour.x)
    expect(first.y).toBeGreaterThan(lowerRow.y)
    expect(first.y).toBeCloseTo(FIELD.halfHeight - BRICK.topOffset)
  })
})

describe('level data validation', () => {
  it('accepts every bundled level', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(3)
    expect(() => {
      parseLevels(LEVELS)
    }).not.toThrow()
  })

  it('rejects ragged rows, unknown characters and empty grids', () => {
    expect(() => {
      parseLevel(testLevel(['..', '...']))
    }).toThrow(LevelParseError)
    expect(() => {
      parseLevel(testLevel(['.?']))
    }).toThrow(/unknown char/)
    expect(() => {
      parseLevel(testLevel(['..']))
    }).toThrow(/no destructible bricks/)
    expect(() => {
      parseLevel(testLevel([]))
    }).toThrow(/no rows/)
  })

  it('rejects a drop rate outside [0, 1]', () => {
    expect(() => {
      parseLevel(testLevel(['#'], { powerUpDropRate: 1.4 }))
    }).toThrow(/drop rate/)
  })

  it('accepts a missing drop rate, which falls back to the shared default', () => {
    const def: LevelDefinition = { ...testLevel(['#']) }
    delete (def as { powerUpDropRate?: number }).powerUpDropRate
    expect(() => {
      parseLevel(def)
    }).not.toThrow()
  })

  it('rejects grids that would crowd the paddle', () => {
    const tooDeep = Array.from({ length: 12 }, (_, row) => (row === 0 ? '#' : '.'))
    expect(() => {
      parseLevel(testLevel(tooDeep))
    }).toThrow(/crowd the paddle/)
  })

  it('rejects a non-positive or malformed ball speed', () => {
    expect(() => {
      parseLevel(testLevel(['#'], { ballSpeed: 0 }))
    }).toThrow(/ball speed/)
    expect(() => {
      parseLevel(testLevel(['#'], { ballSpeed: Number.NaN }))
    }).toThrow(LevelParseError)
  })

  it('rejects columns that cannot fit the field', () => {
    expect(() => {
      parseLevel(testLevel(['#'.repeat(400)]))
    }).toThrow(/columns/)
  })

  it('rejects malformed palette colours', () => {
    expect(() => {
      parseLevel(testLevel(['#'], { palette: ['rojo'] }))
    }).toThrow(/#rrggbb/)
  })

  it('reports the deepest brick edge of the layout', () => {
    const grid = computeGridLayout(testLevel(['#', '.']))
    expect(grid.lowestEdgeY).toBeLessThan(brickPosition(grid, 0, 0).y)
    expect(grid.lowestEdgeY).toBeGreaterThan(FIELD.halfHeight * -0.5)
  })

  it('wraps the campaign index around', () => {
    expect(getLevel(0)).toBe(LEVELS[0])
    expect(getLevel(LEVELS.length)).toBe(LEVELS[0])
    expect(getLevel(-1)).toBe(LEVELS[LEVELS.length - 1])
  })
})

describe('brick factory', () => {
  it('builds one brick per grid character', () => {
    const bricks = createBricks(testLevel(['.#.', '...']))
    expect(bricks).toHaveLength(1)
    expect(bricks[0].type).toBe('normal')
    expect(bricks[0].alive).toBe(true)
    expect(bricks[0].hitsLeft).toBe(1)
  })

  it('maps every legend character to its brick type', () => {
    const bricks = createBricks(testLevel(['#+X!']))
    expect(bricks.map((brick) => brick.type)).toEqual([
      'normal',
      'tough',
      'indestructible',
      'explosive',
    ])
    expect(bricks[1].hitsLeft).toBe(brickHitPoints('tough'))
    expect(bricks[1].behavior).toBe(brickBehaviors.tough)
  })

  it('tints normal bricks from the level palette and specials from the theme', () => {
    const bricks = createBricks(testLevel(['..#', '#+#'], { palette: ['#111111', '#222222'] }))
    const normalRowTwo = bricks.find((brick) => brick.type === 'normal' && brick.row === 1)
    expect(normalRowTwo?.color).toBe(0x222222)
    const tough = bricks.find((brick) => brick.type === 'tough')
    expect(tough?.color).toBe(hexToInt(PALETTE.brickSpecial.tough))
  })

  it('falls back to the shared row palette when the level has none', () => {
    const bricks = createBricks(testLevel(['#'], { palette: [] }))
    expect(bricks[0].color).toBe(hexToInt(PALETTE.brickRows[0]))
  })
})
