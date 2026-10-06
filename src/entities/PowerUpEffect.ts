import { PADDLE, POWER_UPS } from '../config/gameConfig'
import type { Ball, Paddle, PowerUpType } from './types'

/**
 * Capabilities a power-up effect may touch. `World` implements this, so
 * effects stay free of engine details and are trivial to unit-test.
 */
export interface PowerUpTarget {
  readonly paddle: Paddle
  readonly balls: readonly Ball[]
  widenPaddle(): void
  narrowPaddle(): void
  addBalls(count: number): void
  setSpeedFactor(factor: number): void
  setLaserEnabled(enabled: boolean): void
  addLife(): void
}

/** Strategy: what collecting a power-up does while it is active. */
export interface PowerUpEffect {
  readonly type: PowerUpType
  /** Seconds of effect; null for instant power-ups. */
  readonly duration: number | null
  apply(target: PowerUpTarget): void
  revert(target: PowerUpTarget): void
}

const noop = (): void => undefined

const wideEffect: PowerUpEffect = {
  type: 'wide',
  duration: POWER_UPS.durations.wide,
  apply: (target) => {
    target.widenPaddle()
  },
  revert: (target) => {
    target.narrowPaddle()
  },
}

const slowEffect: PowerUpEffect = {
  type: 'slow',
  duration: POWER_UPS.durations.slow,
  apply: (target) => target.setSpeedFactor(POWER_UPS.slowFactor),
  revert: (target) => target.setSpeedFactor(1),
}

const fastEffect: PowerUpEffect = {
  type: 'fast',
  duration: POWER_UPS.durations.fast,
  apply: (target) => target.setSpeedFactor(POWER_UPS.fastFactor),
  revert: (target) => target.setSpeedFactor(1),
}

const laserEffect: PowerUpEffect = {
  type: 'laser',
  duration: POWER_UPS.durations.laser,
  apply: (target) => target.setLaserEnabled(true),
  revert: (target) => target.setLaserEnabled(false),
}

const multiEffect: PowerUpEffect = {
  type: 'multi',
  duration: null,
  apply: (target) => target.addBalls(2),
  revert: noop,
}

const lifeEffect: PowerUpEffect = {
  type: 'life',
  duration: null,
  apply: (target) => target.addLife(),
  revert: noop,
}

export const powerUpEffects: Readonly<Record<PowerUpType, PowerUpEffect>> = {
  wide: wideEffect,
  multi: multiEffect,
  slow: slowEffect,
  fast: fastEffect,
  laser: laserEffect,
  life: lifeEffect,
}

export const SPEED_POWER_UPS: readonly PowerUpType[] = ['slow', 'fast']

export const PADDLE_WIDE_HALF_WIDTH = PADDLE.baseHalfWidth * PADDLE.wideMultiplier
