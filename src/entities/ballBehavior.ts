import type { BallType } from './types'

/** How a ball treats the brick it just hit. */
export interface BallBehavior {
  readonly type: BallType
  /** Destroys the struck brick regardless of its remaining hit points. */
  readonly lethal: boolean
  /** Chain-detonates the struck brick's neighbourhood when it is destroyed. */
  readonly chains: boolean
}

/**
 * Strategy per ball flavour. Reuses the engine's existing brick-damage path: a
 * `lethal` ball one-shots tough bricks and a `chains` ball reuses the explosive
 * neighbourhood sweep.
 */
export const ballBehaviors: Readonly<Record<BallType, BallBehavior>> = {
  standard: { type: 'standard', lethal: false, chains: false },
  heavy: { type: 'heavy', lethal: true, chains: false },
  fire: { type: 'fire', lethal: false, chains: true },
  bomb: { type: 'bomb', lethal: true, chains: true },
}

/** Special flavours the "power ball" power-up can hand out. */
export const SPECIAL_BALL_TYPES: readonly BallType[] = ['fire', 'heavy', 'bomb']

/** Uniform roll over the special flavours; RNG is injectable for tests. */
export const rollSpecialBallType = (random: () => number = Math.random): BallType => {
  const index = Math.min(
    SPECIAL_BALL_TYPES.length - 1,
    Math.floor(random() * SPECIAL_BALL_TYPES.length),
  )
  return SPECIAL_BALL_TYPES[index]
}
