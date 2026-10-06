import { BALL, EXPLOSION, FIELD } from '../config/gameConfig'
import type { GameBus } from '../core/EventBus'
import type { Brick, Ball } from '../entities/types'
import { DEG2RAD, clamp, vecDistance } from '../utils/math'
import { boxesOverlap, circleIntersectsBox, resolveCircleBox } from '../utils/collision'
import type { PowerUpSystem } from './PowerUpSystem'
import type { ScoringSystem } from './ScoringSystem'
import type { World } from './World'

const EPSILON = 1e-6
const MAX_BOUNCE_ANGLE = BALL.maxBounceAngleDeg * DEG2RAD
const PICKUP_RADIUS = 1.2
const LASER_HALF_WIDTH = 0.17
const LASER_HALF_HEIGHT = 0.8
const POWER_UP_OUT_MARGIN = 2

/**
 * Resolves every contact in the simulation. Owns brick damage (Strategy) so
 * that scoring, drops and chain explosions stay in a single ordered flow.
 */
export class CollisionSystem {
  private readonly bus: GameBus
  private readonly scoring: ScoringSystem
  private readonly powerUpSystem: PowerUpSystem

  constructor(bus: GameBus, scoring: ScoringSystem, powerUpSystem: PowerUpSystem) {
    this.bus = bus
    this.scoring = scoring
    this.powerUpSystem = powerUpSystem
  }

  update(world: World): void {
    for (const ball of world.balls) {
      if (!ball.active || ball.stuck) continue
      this.collideWalls(world, ball)
      this.collidePaddle(world, ball)
      this.collideBricks(world, ball)
      if (ball.pos.y < -FIELD.halfHeight - BALL.outMargin) {
        ball.active = false
        ball.stuck = false
      }
    }
    this.updatePickups(world)
    this.updateLasers(world)
  }

  private collideWalls(world: World, ball: Ball): void {
    const limitX = FIELD.halfWidth - ball.radius
    const limitY = FIELD.halfHeight - ball.radius
    const strength = world.currentSpeed

    if (ball.pos.x < -limitX) {
      ball.pos.x = -limitX
      if (ball.vel.x < 0) {
        ball.vel.x = -ball.vel.x
        this.bus.emit('wallHit', { strength: clamp(Math.abs(ball.vel.x) / strength, 0, 1) })
      }
    } else if (ball.pos.x > limitX) {
      ball.pos.x = limitX
      if (ball.vel.x > 0) {
        ball.vel.x = -ball.vel.x
        this.bus.emit('wallHit', { strength: clamp(Math.abs(ball.vel.x) / strength, 0, 1) })
      }
    }

    if (ball.pos.y > limitY) {
      ball.pos.y = limitY
      if (ball.vel.y > 0) {
        ball.vel.y = -ball.vel.y
        this.bus.emit('wallHit', { strength: clamp(Math.abs(ball.vel.y) / strength, 0, 1) })
      }
    }
  }

  private collidePaddle(world: World, ball: Ball): void {
    if (ball.vel.y >= 0) return
    const paddle = world.paddle
    if (
      !circleIntersectsBox(ball.pos, ball.radius, paddle.pos, paddle.halfWidth, paddle.halfHeight)
    ) {
      return
    }
    // Bounce angle depends on where the ball struck the paddle.
    const offset = clamp((ball.pos.x - paddle.pos.x) / paddle.halfWidth, -1, 1)
    const angle = offset * MAX_BOUNCE_ANGLE
    const speed = world.currentSpeed
    ball.vel.x = Math.sin(angle) * speed
    ball.vel.y = Math.abs(Math.cos(angle) * speed)
    ball.pos.y = paddle.pos.y + paddle.halfHeight + ball.radius + EPSILON
    this.bus.emit('paddleHit', { strength: clamp(0.35 + Math.abs(offset) * 0.65, 0, 1) })
  }

  private collideBricks(world: World, ball: Ball): void {
    for (const brick of world.bricks) {
      if (!brick.alive) continue
      if (
        !circleIntersectsBox(ball.pos, ball.radius, brick.pos, brick.halfWidth, brick.halfHeight)
      ) {
        continue
      }
      resolveCircleBox(
        ball.pos,
        ball.radius,
        brick.pos,
        brick.halfWidth,
        brick.halfHeight,
        ball.vel,
      )
      this.damageBrick(world, brick, false)
      return
    }
  }

  /**
   * Applies the brick's hit Strategy; on destruction it scores, drops power-ups
   * and (for explosives) recursively detonates the neighbourhood. `alive` flips
   * before recursion, which makes chain loops impossible.
   */
  private damageBrick(world: World, brick: Brick, chain: boolean): void {
    if (!brick.alive) return
    const outcome = brick.behavior.hit(brick)

    if (!outcome.destroyed) {
      this.bus.emit('brickDamaged', {
        id: brick.id,
        pos: brick.pos,
        color: brick.color,
        hitsLeft: brick.hitsLeft,
      })
      return
    }

    brick.alive = false
    const points = this.scoring.registerBrickDestroy(brick.type)
    this.bus.emit('brickDestroyed', {
      id: brick.id,
      pos: brick.pos,
      color: brick.color,
      type: brick.type,
      points,
      chain,
    })
    this.powerUpSystem.maybeSpawn(world, brick.pos)

    if (!outcome.explodes) return
    for (const other of world.bricks) {
      if (!other.alive) continue
      if (vecDistance(other.pos, brick.pos) > EXPLOSION.radius) continue
      this.damageBrick(world, other, true)
    }
  }

  private updatePickups(world: World): void {
    const paddle = world.paddle
    for (const powerUp of world.powerUps) {
      if (!powerUp.active) continue
      if (
        circleIntersectsBox(
          powerUp.pos,
          PICKUP_RADIUS,
          paddle.pos,
          paddle.halfWidth,
          paddle.halfHeight,
        )
      ) {
        const type = powerUp.type
        world.releasePowerUp(powerUp)
        this.powerUpSystem.collect(world, type)
      } else if (powerUp.pos.y < -FIELD.halfHeight - POWER_UP_OUT_MARGIN) {
        world.releasePowerUp(powerUp)
      }
    }
  }

  private updateLasers(world: World): void {
    for (const bolt of world.lasers) {
      if (!bolt.active) continue
      if (bolt.pos.y > FIELD.halfHeight + 1) {
        world.releaseLaser(bolt)
        continue
      }
      for (const brick of world.bricks) {
        if (!brick.alive) continue
        if (
          !boxesOverlap(
            bolt.pos,
            LASER_HALF_WIDTH,
            LASER_HALF_HEIGHT,
            brick.pos,
            brick.halfWidth,
            brick.halfHeight,
          )
        ) {
          continue
        }
        world.releaseLaser(bolt)
        this.damageBrick(world, brick, false)
        break
      }
    }
  }
}
