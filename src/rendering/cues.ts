import type { PowerUpStatus, PowerUpType } from '../entities/types'

/**
 * Visual priority when several power-ups are active at once: the paddle can only
 * wear one cue, so the most "loud" effect wins. Pure and DOM-free on purpose, so
 * the choice is unit-tested without a GPU.
 */
export const POWER_UP_PRIORITY: readonly PowerUpType[] = [
  'laser',
  'powerBall',
  'wide',
  'multi',
  'fast',
  'slow',
  'life',
]

/**
 * Picks the power-up the paddle should dress up as, or `null` when nothing is
 * running. Deterministic so the renderer (and its tests) never disagree.
 */
export const primaryPowerUp = (active: readonly PowerUpStatus[]): PowerUpType | null => {
  for (const type of POWER_UP_PRIORITY) {
    if (active.some((status) => status.type === type)) return type
  }
  return null
}
