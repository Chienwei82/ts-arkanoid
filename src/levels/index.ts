import { LEVELS } from './levelData'
import { parseLevels } from './parse'
import type { LevelDefinition } from './types'

export { LEVELS } from './levelData'
export { LevelParseError, parseLevel, parseLevels } from './parse'
export { brickPosition, computeGridLayout } from './grid'
export type { LevelDefinition, LevelGridLayout } from './types'
export { CHAR_TO_BRICK, LEVEL_CHARS } from './types'

// Fail fast at start-up if bundled level data is malformed.
parseLevels(LEVELS)

/** Validated level by index, wrapping around the campaign length. */
export const getLevel = (index: number): LevelDefinition => {
  const total = LEVELS.length
  const safeIndex = ((index % total) + total) % total
  return LEVELS[safeIndex]
}
