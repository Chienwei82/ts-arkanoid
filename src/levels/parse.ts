import { BRICK } from '../config/gameConfig'
import { computeGridLayout } from './grid'
import { CHAR_TO_BRICK } from './types'
import type { LevelDefinition } from './types'

export class LevelParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LevelParseError'
  }
}

const PALETTE_COLOUR = /^#[0-9a-fA-F]{6}$/

/**
 * Runtime validation of level data: equal row lengths, known characters, at
 * least one destructible brick (otherwise the level can never be completed), a
 * positive ball speed, well-formed palette colours and a grid that stays clear
 * of the paddle area and fits the field width.
 */
export const parseLevel = (def: LevelDefinition): void => {
  if (def.rows.length === 0) {
    throw new LevelParseError(`Level "${def.id}" has no rows`)
  }
  const width = def.rows[0].length
  if (width === 0) {
    throw new LevelParseError(`Level "${def.id}" has empty rows`)
  }
  let destructible = 0
  def.rows.forEach((row, rowIndex) => {
    if (row.length !== width) {
      throw new LevelParseError(
        `Level "${def.id}" row ${rowIndex} has length ${row.length}, expected ${width}`,
      )
    }
    for (const char of row) {
      const type = CHAR_TO_BRICK[char]
      if (type === undefined) {
        throw new LevelParseError(`Level "${def.id}" contains unknown char "${char}"`)
      }
      if (type !== null && type !== 'indestructible') destructible += 1
    }
  })
  if (destructible === 0) {
    throw new LevelParseError(`Level "${def.id}" has no destructible bricks`)
  }
  const rate = def.powerUpDropRate
  if (rate !== undefined && (rate < 0 || rate > 1)) {
    throw new LevelParseError(`Level "${def.id}" drop rate must be within [0, 1]`)
  }
  if (!Number.isFinite(def.ballSpeed) || def.ballSpeed <= 0) {
    throw new LevelParseError(`Level "${def.id}" ball speed must be greater than 0`)
  }
  def.palette.forEach((colour) => {
    if (!PALETTE_COLOUR.test(colour)) {
      throw new LevelParseError(
        `Level "${def.id}" palette entry "${colour}" must look like #rrggbb`,
      )
    }
  })
  const grid = computeGridLayout(def)
  if (grid.brickWidth <= 0) {
    throw new LevelParseError(
      `Level "${def.id}" has ${grid.cols} columns; they do not fit the field`,
    )
  }
  const lowestEdge = grid.lowestEdgeY
  if (lowestEdge < BRICK.zoneBottom) {
    throw new LevelParseError(
      `Level "${def.id}" has ${grid.rows} rows; the last one reaches y=${lowestEdge.toFixed(1)} ` +
        `and would crowd the paddle (limit y=${BRICK.zoneBottom})`,
    )
  }
}

export const parseLevels = (levels: readonly LevelDefinition[]): void => {
  levels.forEach(parseLevel)
}
