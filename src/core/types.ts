import type { PowerUpStatus } from '../entities/types'
import type { GenreId } from './audio'

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
  /** Procedural audio mute state; the UI renders its toggle from this. */
  readonly audioEnabled: boolean
  /** Current music genre; the UI renders its selector from this. */
  readonly audioGenre: GenreId
  /** How much of the destructible wall is cleared (0..1), for the HUD bar. */
  readonly clearance: number
  readonly error: HudError | null
}
