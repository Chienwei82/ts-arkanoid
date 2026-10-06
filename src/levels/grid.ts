import { BRICK, FIELD } from '../config/gameConfig'
import { vec2, type Vec2 } from '../utils/math'
import type { LevelDefinition, LevelGridLayout } from './types'

/** Maps a level grid to world-space brick metrics (single source of sizing). */
export const computeGridLayout = (def: LevelDefinition): LevelGridLayout => {
  const cols = def.rows[0].length
  const available = 2 * FIELD.halfWidth - 2 * BRICK.sidePadding
  const brickWidth = (available - BRICK.gap * (cols - 1)) / cols
  const step = BRICK.height + BRICK.gap
  const top = FIELD.halfHeight - BRICK.topOffset
  const lowestEdgeY = top - (def.rows.length - 1) * step - BRICK.height / 2
  return { rows: def.rows.length, cols, brickWidth, brickHeight: BRICK.height, lowestEdgeY }
}

/** World-space center of a grid cell; row 0 sits nearest the top wall. */
export const brickPosition = (grid: LevelGridLayout, row: number, col: number): Vec2 => {
  const left = -FIELD.halfWidth + BRICK.sidePadding
  const x = left + grid.brickWidth / 2 + col * (grid.brickWidth + BRICK.gap)
  const top = FIELD.halfHeight - BRICK.topOffset
  const y = top - row * (grid.brickHeight + BRICK.gap)
  return vec2(x, y)
}
