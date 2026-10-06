import type { Vec2 } from '../utils/math'
import type { BrickBehavior } from './BrickBehavior'

export type BrickType = 'normal' | 'tough' | 'indestructible' | 'explosive'

export type PowerUpType = 'wide' | 'multi' | 'slow' | 'fast' | 'laser' | 'life'

export interface Ball {
  readonly id: number
  readonly pos: Vec2
  readonly prev: Vec2
  readonly vel: Vec2
  radius: number
  active: boolean
  /** Attached to the paddle until the launch command arrives. */
  stuck: boolean
  stuckOffset: number
}

export interface Paddle {
  readonly pos: Vec2
  readonly prev: Vec2
  halfWidth: number
  readonly baseHalfWidth: number
  readonly halfHeight: number
  /** Keyboard contribution in [-1, 1]; non-zero overrides the pointer target. */
  axisInput: number
  /** Pointer target in world units, or null when the pointer has not moved. */
  targetX: number | null
  laserCooldownLeft: number
}

export interface Brick {
  readonly id: number
  readonly pos: Vec2
  readonly halfWidth: number
  readonly halfHeight: number
  readonly type: BrickType
  readonly row: number
  readonly col: number
  /** 0xrrggbb tint; special types override the row palette. */
  readonly color: number
  readonly baseHits: number
  /** Behaviour strategy resolved at creation time (Factory + Strategy). */
  readonly behavior: BrickBehavior
  hitsLeft: number
  alive: boolean
}

export interface PowerUp {
  id: number
  type: PowerUpType
  readonly pos: Vec2
  readonly prev: Vec2
  readonly vel: Vec2
  active: boolean
}

export interface LaserBolt {
  id: number
  readonly pos: Vec2
  readonly prev: Vec2
  active: boolean
}

/** HUD-facing description of a running power-up effect. */
export interface PowerUpStatus {
  readonly type: PowerUpType
  readonly remaining: number
}
