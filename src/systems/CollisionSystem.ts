import { BALL, EXPLOSION, FIELD } from '../config/gameConfig'
import type { GameBus } from '../core/EventBus'
import { ballBehaviors, type BallBehavior } from '../entities/ballBehavior'
import type { BrickHitOutcome } from '../entities/BrickBehavior'
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
/** Cell size for the brick spatial grid: ~3-4 bricks per cell side. */
const GRID_CELL_SIZE = 8
/** Conservative upper bounds for brick half-dimensions used by the grid query radius. */
const BRICK_HALF_WIDTH_MAX = 4
const BRICK_HALF_HEIGHT_MAX = 1.5

/** Lethal balls bypass hit points: the brick dies (explosives still chain). */
const forceDestroy = (brick: Brick): BrickHitOutcome => {
  brick.hitsLeft = 0
  return { destroyed: true, explodes: brick.type === 'explosive' }
}

/**
 * Spatial grid that buckets bricks by world position. Rebuilt when the brick
 * field changes (level load / destruction), so collision queries only scan
 * bricks in the ball's cell and adjacent cells instead of the whole field.
 */
class BrickGrid {
  private readonly cellSize: number
  private readonly cols: number
  private readonly rows: number
  private readonly originX: number
  private readonly originY: number
  /** Flat array of linked-list heads: each entry stores the first brick index
   *  in that cell, and bricks link via `nextInGrid`. -1 means empty. */
  private heads: Int32Array
  /** Next-brick index in the same cell, parallel to `world.bricks`. */
  private nextInGrid: Int32Array | null = null

  constructor(fieldWidth: number, fieldHeight: number, cellSize: number) {
    this.cellSize = cellSize
    this.originX = -fieldWidth / 2
    this.originY = -fieldHeight / 2
    this.cols = Math.ceil(fieldWidth / cellSize)
    this.rows = Math.ceil(fieldHeight / cellSize)
    this.heads = new Int32Array(this.cols * this.rows)
    this.heads.fill(-1)
  }

  /** World x → grid column index. */
  private colOf(x: number): number {
    return Math.floor((x - this.originX) / this.cellSize)
  }

  /** World y → grid row index. */
  private rowOf(y: number): number {
    return Math.floor((y - this.originY) / this.cellSize)
  }

  private cellIndex(col: number, row: number): number {
    return row * this.cols + col
  }

  /** Rebuild the grid from the current brick list. Call when bricks change. */
  rebuild(bricks: readonly Brick[]): void {
    this.heads.fill(-1)
    this.nextInGrid = new Int32Array(bricks.length)
    for (let i = 0; i < bricks.length; i += 1) {
      const brick = bricks[i]
      if (!brick.alive) continue
      const col = this.colOf(brick.pos.x)
      const row = this.rowOf(brick.pos.y)
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue
      const idx = this.cellIndex(col, row)
      this.nextInGrid[i] = this.heads[idx]
      this.heads[idx] = i
    }
  }

  /** Collect indices of alive bricks whose cell overlaps the circle around
   *  `(x, y)` with the given radius. */
  queryCircle(x: number, y: number, radius: number, out: number[]): void {
    if (this.nextInGrid === null) return
    const minCol = this.colOf(x - radius)
    const maxCol = this.colOf(x + radius)
    const minRow = this.rowOf(y - radius)
    const maxRow = this.rowOf(y + radius)
    for (let c = minCol; c <= maxCol; c += 1) {
      if (c < 0 || c >= this.cols) continue
      for (let r = minRow; r <= maxRow; r += 1) {
        if (r < 0 || r >= this.rows) continue
        let idx = this.heads[this.cellIndex(c, r)]
        while (idx !== -1) {
          out.push(idx)
          idx = this.nextInGrid[idx]
        }
      }
    }
  }
}

/**
 * Resolves every contact in the simulation. Owns brick damage (Strategy) so
 * that scoring, drops and chain explosions stay in a single ordered flow.
 */
export class CollisionSystem {
  private readonly bus: GameBus
  private readonly scoring: ScoringSystem
  private readonly powerUpSystem: PowerUpSystem
  /** Spatial grid over the brick field; rebuilt on level load and brick destruction. */
  private readonly grid: BrickGrid
  /** Bricks touched this frame, reused across balls to avoid re-allocating. */
  private readonly nearby: number[] = []

  constructor(bus: GameBus, scoring: ScoringSystem, powerUpSystem: PowerUpSystem) {
    this.bus = bus
    this.scoring = scoring
    this.powerUpSystem = powerUpSystem
    this.grid = new BrickGrid(FIELD.halfWidth * 2, FIELD.halfHeight * 2, GRID_CELL_SIZE)
  }

  update(world: World): void {
    // Rebuild the grid when the brick array reference changed (new level) or
    // when any brick died. The grid holds alive bricks only.
    this.grid.rebuild(world.bricks)
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
    this.nearby.length = 0
    this.grid.queryCircle(
      ball.pos.x,
      ball.pos.y,
      ball.radius + Math.max(BRICK_HALF_WIDTH_MAX, BRICK_HALF_HEIGHT_MAX),
      this.nearby,
    )
    for (const idx of this.nearby) {
      const brick = world.bricks[idx]
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
      this.damageBrick(world, brick, false, ballBehaviors[ball.type])
      return
    }
  }

  /**
   * Applies the brick's hit Strategy; on destruction it scores, drops power-ups
   * and (for explosives) recursively detonates the neighbourhood. `alive` flips
   * before recursion, which makes chain loops impossible. The passing ball's
   * behaviour can force the kill (`lethal`) and/or start the sweep (`chains`);
   * chain hops pass no ball, so a sweep never recurses with its own rules.
   */
  private damageBrick(
    world: World,
    brick: Brick,
    chain: boolean,
    ball: BallBehavior | null = null,
  ): void {
    if (!brick.alive) return
    const lethal = ball?.lethal === true && brick.type !== 'indestructible'
    const outcome = lethal ? forceDestroy(brick) : brick.behavior.hit(brick)

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

    if (!outcome.explodes && ball?.chains !== true) return
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
