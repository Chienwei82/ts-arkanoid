import type { PowerUpStatus } from '../entities/types'

export type GameStatus = 'menu' | 'playing' | 'paused' | 'levelComplete' | 'gameOver'

export const GAME_STATUSES: readonly GameStatus[] = [
  'menu',
  'playing',
  'paused',
  'levelComplete',
  'gameOver',
]

/** Failure the UI must surface instead of showing a frozen board. */
export interface HudError {
  readonly kind: 'engine' | 'context' | 'unsupported'
  readonly message: string
}

/** Snapshot the UI bridge publishes; pure data, no React involved. */
export interface HudState {
  readonly status: GameStatus
  readonly score: number
  readonly lives: number
  readonly combo: number
  readonly multiplier: number
  readonly record: number
  readonly levelIndex: number
  readonly levelName: string
  readonly levelTotal: number
  readonly powerUps: readonly PowerUpStatus[]
  readonly isRecord: boolean
  readonly isFinalLevel: boolean
  /** Help guide overlay: open from the start and toggled with the H key. */
  readonly helpVisible: boolean
  readonly error: HudError | null
}
