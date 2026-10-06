import { PALETTE } from '../config/palette'
import { brickPosition, computeGridLayout, parseLevel, CHAR_TO_BRICK } from '../levels'
import type { LevelDefinition } from '../levels'
import { hexToInt } from '../utils/math'
import { brickBehaviors, brickHitPoints } from './BrickBehavior'
import type { Brick, BrickType } from './types'

const brickColor = (type: BrickType, row: number, palette: readonly string[]): number => {
  if (type === 'normal') {
    // An empty level palette falls back to the shared brick row colours.
    const rows = palette.length > 0 ? palette : PALETTE.brickRows
    return hexToInt(rows[row % rows.length])
  }
  return hexToInt(PALETTE.brickSpecial[type])
}

/**
 * Factory: materialises brick entities from level data (grid + palette).
 * Throws if the level data is malformed, so bad levels fail loudly.
 */
export const createBricks = (def: LevelDefinition): Brick[] => {
  parseLevel(def)
  const grid = computeGridLayout(def)
  const bricks: Brick[] = []
  let id = 0

  def.rows.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col += 1) {
      const type = CHAR_TO_BRICK[row[col]]
      if (type === null || type === undefined) continue
      const hits = brickHitPoints(type)
      bricks.push({
        id,
        pos: brickPosition(grid, rowIndex, col),
        halfWidth: grid.brickWidth / 2,
        halfHeight: grid.brickHeight / 2,
        type,
        row: rowIndex,
        col,
        color: brickColor(type, rowIndex, def.palette),
        baseHits: hits,
        hitsLeft: hits,
        alive: true,
        behavior: brickBehaviors[type],
      })
      id += 1
    }
  })

  return bricks
}
