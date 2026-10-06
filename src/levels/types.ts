import type { BrickType } from '../entities/types'

/** Level data: a character grid plus palette/tuning that feeds the factory. */
export interface LevelDefinition {
  readonly id: string
  readonly name: string
  /** Rows of equal length; see LEVEL_CHARS for the legend. */
  readonly rows: readonly string[]
  /** Neon colors cycled across brick rows. */
  readonly palette: readonly string[]
  readonly ballSpeed: number
  /** Falls back to POWER_UPS.dropChance when the level does not set one. */
  readonly powerUpDropRate?: number
}

export const LEVEL_CHARS = {
  empty: '.',
  normal: '#',
  tough: '+',
  indestructible: 'X',
  explosive: '!',
} as const

export const CHAR_TO_BRICK: Readonly<Record<string, BrickType | null>> = {
  [LEVEL_CHARS.empty]: null,
  [LEVEL_CHARS.normal]: 'normal',
  [LEVEL_CHARS.tough]: 'tough',
  [LEVEL_CHARS.indestructible]: 'indestructible',
  [LEVEL_CHARS.explosive]: 'explosive',
}

export interface LevelGridLayout {
  readonly rows: number
  readonly cols: number
  readonly brickWidth: number
  readonly brickHeight: number
  /** Y of the bottom edge of the last row; used to validate level depth. */
  readonly lowestEdgeY: number
}
