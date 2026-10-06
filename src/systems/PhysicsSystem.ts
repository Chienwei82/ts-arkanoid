import { FIELD, PADDLE, POWER_UPS } from '../config/gameConfig'
import { clamp } from '../utils/math'
import type { World } from './World'

const LASER_SPEED = POWER_UPS.laserBoltSpeed

/** Pure integration: paddle steering, ball flight, falling drops, lasers. */
export class PhysicsSystem {
  update(world: World, dt: number): void {
    world.capturePrevious()
    this.movePaddle(world, dt)
    this.moveBalls(world, dt)
    this.movePowerUps(world, dt)
    this.moveLasers(world, dt)
  }

  private movePaddle(world: World, dt: number): void {
    const paddle = world.paddle
    if (paddle.axisInput !== 0) {
      // Keyboard input takes over from a stale pointer target.
      paddle.targetX = null
      paddle.pos.x += paddle.axisInput * PADDLE.keyboardSpeed * dt
    } else if (paddle.targetX !== null) {
      const maxStep = PADDLE.pointerSpeed * dt
      paddle.pos.x += clamp(paddle.targetX - paddle.pos.x, -maxStep, maxStep)
    }
    const limit = FIELD.halfWidth - paddle.halfWidth
    paddle.pos.x = clamp(paddle.pos.x, -limit, limit)
    for (const ball of world.balls) {
      if (ball.active && ball.stuck) world.placeStuckBall(ball)
    }
  }

  private moveBalls(world: World, dt: number): void {
    const speed = world.currentSpeed
    for (const ball of world.balls) {
      if (!ball.active || ball.stuck) continue
      ball.pos.x += ball.vel.x * dt
      ball.pos.y += ball.vel.y * dt
      const length = Math.hypot(ball.vel.x, ball.vel.y)
      if (length > 1e-6) {
        ball.vel.x = (ball.vel.x / length) * speed
        ball.vel.y = (ball.vel.y / length) * speed
      }
    }
  }

  private movePowerUps(world: World, dt: number): void {
    for (const powerUp of world.powerUps) {
      if (!powerUp.active) continue
      powerUp.pos.x += powerUp.vel.x * dt
      powerUp.pos.y += powerUp.vel.y * dt
    }
  }

  private moveLasers(world: World, dt: number): void {
    for (const bolt of world.lasers) {
      if (!bolt.active) continue
      bolt.pos.y += LASER_SPEED * dt
    }
  }
}
