import { PADDLE } from '../config/gameConfig'
import type { GameBus } from '../core/EventBus'
import type { World } from './World'

/** Fires paired laser bolts from the paddle while the effect is active. */
export class LaserSystem {
  private readonly bus: GameBus

  constructor(bus: GameBus) {
    this.bus = bus
  }

  update(world: World, dt: number, wantsFire: boolean): void {
    const paddle = world.paddle
    paddle.laserCooldownLeft = Math.max(0, paddle.laserCooldownLeft - dt)
    if (!world.laserEnabled || !wantsFire || paddle.laserCooldownLeft > 0) return

    const y = paddle.pos.y + paddle.halfHeight + 1
    const spread = paddle.halfWidth * 0.6
    const left = world.spawnLaser(paddle.pos.x - spread, y)
    const right = world.spawnLaser(paddle.pos.x + spread, y)
    // A fully busy pool must not burn the cooldown on shots that never existed.
    if (left === undefined && right === undefined) return

    paddle.laserCooldownLeft = PADDLE.laserCooldown
    this.bus.emit('laserFired', { pos: paddle.pos })
  }
}
