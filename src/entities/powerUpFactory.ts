import { POWER_UPS } from '../config/gameConfig'
import { vec2, type Vec2 } from '../utils/math'
import type { PowerUp, PowerUpType } from './types'

/** Factory: a falling power-up entity spawned from a destroyed brick. */
export const createPowerUp = (id: number, type: PowerUpType, at: Vec2): PowerUp => ({
  id,
  type,
  pos: vec2(at.x, at.y),
  prev: vec2(at.x, at.y),
  vel: vec2(0, -POWER_UPS.fallSpeed),
  active: true,
})

const WEIGHT_ENTRIES = Object.entries(POWER_UPS.weights) as [PowerUpType, number][]

const TOTAL_WEIGHT = WEIGHT_ENTRIES.reduce((sum, [, weight]) => sum + weight, 0)

/** Weighted roll over the configured drop table; `random` is injectable. */
export const rollPowerUpType = (random: () => number): PowerUpType => {
  let roll = random() * TOTAL_WEIGHT
  for (const [type, weight] of WEIGHT_ENTRIES) {
    roll -= weight
    if (roll < 0) return type
  }
  return WEIGHT_ENTRIES[WEIGHT_ENTRIES.length - 1][0]
}
