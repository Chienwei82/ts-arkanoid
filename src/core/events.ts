import type { BrickType, PowerUpStatus, PowerUpType } from '../entities/types'
import type { Vec2 } from '../utils/math'
import type { GameStatus, HudError } from './types'

/**
 * Typed contract between gameplay, effects and UI. Everything that crosses a
 * module boundary (renderer, React store) travels as one of these payloads.
 */
export interface GameEventMap {
  statusChanged: { from: GameStatus; to: GameStatus }
  /** Help guide overlay opened or closed. */
  helpChanged: { visible: boolean }
  scoreChanged: { score: number; combo: number; multiplier: number; gained: number }
  recordChanged: { record: number }
  livesChanged: { lives: number }
  levelChanged: { index: number; name: string; total: number }
  levelCompleted: { index: number; isFinal: boolean }
  gameOver: { score: number; record: number; isRecord: boolean }
  brickDamaged: { id: number; pos: Vec2; color: number; hitsLeft: number }
  brickDestroyed: {
    id: number
    pos: Vec2
    color: number
    type: BrickType
    points: number
    chain: boolean
  }
  powerUpCollected: { type: PowerUpType }
  powerUpExpired: { type: PowerUpType }
  powerUpsChanged: { active: readonly PowerUpStatus[] }
  lifeLost: { lives: number }
  ballLaunched: { count: number }
  paddleHit: { strength: number }
  wallHit: { strength: number }
  laserFired: { pos: Vec2 }
  /** Raised by the engine loop or the renderer when something unrecoverable happens. */
  engineError: HudError
}

export type GameEventName = keyof GameEventMap
