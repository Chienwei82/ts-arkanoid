import { BRICK } from '../config/gameConfig'
import type { Brick, BrickType } from './types'

export interface BrickHitOutcome {
  readonly destroyed: boolean
  /** Explosive bricks chain-detonate neighbours when they are destroyed. */
  readonly explodes: boolean
}

/** Strategy: how a brick reacts to a single hit. */
export interface BrickBehavior {
  readonly type: BrickType
  hit(brick: Brick): BrickHitOutcome
}

const NO_DAMAGE: BrickHitOutcome = { destroyed: false, explodes: false }

const normalBehavior: BrickBehavior = {
  type: 'normal',
  hit(brick) {
    brick.hitsLeft = 0
    return { destroyed: true, explodes: false }
  },
}

const toughBehavior: BrickBehavior = {
  type: 'tough',
  hit(brick) {
    brick.hitsLeft -= 1
    return { destroyed: brick.hitsLeft <= 0, explodes: false }
  },
}

const indestructibleBehavior: BrickBehavior = {
  type: 'indestructible',
  hit() {
    return NO_DAMAGE
  },
}

const explosiveBehavior: BrickBehavior = {
  type: 'explosive',
  hit(brick) {
    brick.hitsLeft = 0
    return { destroyed: true, explodes: true }
  },
}

export const brickBehaviors: Readonly<Record<BrickType, BrickBehavior>> = {
  normal: normalBehavior,
  tough: toughBehavior,
  indestructible: indestructibleBehavior,
  explosive: explosiveBehavior,
}

export const brickHitPoints = (type: BrickType): number => (type === 'tough' ? BRICK.toughHits : 1)
