import { BALL, FIELD, PADDLE, POWER_UPS, SCORING } from '../config/gameConfig'
import { PADDLE_WIDE_HALF_WIDTH, type PowerUpTarget } from '../entities/PowerUpEffect'
import { createPowerUp } from '../entities/powerUpFactory'
import type { Ball, Brick, LaserBolt, Paddle, PowerUp, PowerUpType } from '../entities/types'
import { copyVec, setVec, vec2 } from '../utils/math'
import { ObjectPool } from '../utils/ObjectPool'

const BALL_ROTATION_DEG = 32
const HALF_FIELD_BOTTOM = -FIELD.halfHeight
/** Below this speed a ball counts as still and cannot be cloned by rotation. */
const STILL_EPSILON = 1e-3

const createBall = (id: number): Ball => ({
  id,
  pos: vec2(),
  prev: vec2(),
  vel: vec2(),
  radius: BALL.radius,
  active: false,
  stuck: false,
  stuckOffset: 0,
})

/**
 * Holds every simulation entity and exposes the capability surface used by
 * power-up strategies. Pure data + small operations: no rendering knowledge.
 */
export class World implements PowerUpTarget {
  readonly paddle: Paddle
  readonly balls: Ball[]
  readonly powerUps: readonly PowerUp[]
  readonly lasers: readonly LaserBolt[]

  bricks: Brick[] = []
  lives: number = SCORING.startLives
  levelIndex = 0
  levelName = ''
  levelTotal = 1
  powerUpDropRate = 0
  ballSpeed: number = BALL.baseSpeed
  ballSpeedFactor = 1
  laserEnabled = false

  private readonly powerUpPool: ObjectPool<PowerUp>
  private readonly laserPool: ObjectPool<LaserBolt>
  private nextId = 1

  constructor() {
    const paddleY = HALF_FIELD_BOTTOM + PADDLE.bottomOffset
    this.paddle = {
      pos: vec2(0, paddleY),
      prev: vec2(0, paddleY),
      halfWidth: PADDLE.baseHalfWidth,
      baseHalfWidth: PADDLE.baseHalfWidth,
      halfHeight: PADDLE.halfHeight,
      axisInput: 0,
      targetX: null,
      laserCooldownLeft: 0,
    }
    this.balls = Array.from({ length: BALL.maxCount }, (_, index) => createBall(index))
    // Pooled drops are born inactive: they only become visible once spawned.
    this.powerUpPool = new ObjectPool<PowerUp>(
      () => {
        const powerUp = createPowerUp(0, 'wide', vec2())
        powerUp.active = false
        return powerUp
      },
      (powerUp) => {
        powerUp.active = false
      },
      POWER_UPS.poolSize,
    )
    this.powerUps = this.powerUpPool.all
    this.laserPool = new ObjectPool<LaserBolt>(
      () => ({ id: 0, pos: vec2(), prev: vec2(), active: false }),
      (bolt) => {
        bolt.active = false
      },
      POWER_UPS.laserPoolSize,
    )
    this.lasers = this.laserPool.all
  }

  get activeBallCount(): number {
    let count = 0
    for (const ball of this.balls) if (ball.active) count += 1
    return count
  }

  get destructibleAlive(): boolean {
    for (const brick of this.bricks) {
      if (brick.alive && brick.type !== 'indestructible') return true
    }
    return false
  }

  get currentSpeed(): number {
    return this.ballSpeed * this.ballSpeedFactor
  }

  /**
   * Installs a new brick field. The array instance is replaced on every call,
   * which is the signal renderers use to rebuild their instanced layers.
   */
  setBricks(bricks: Brick[], levelIndex: number, levelName: string, levelTotal: number): void {
    this.bricks = bricks
    this.levelIndex = levelIndex
    this.levelName = levelName
    this.levelTotal = levelTotal
  }

  /** Clears projectiles/balls/effect state between levels or runs. */
  clearTransient(): void {
    this.powerUpPool.releaseAll()
    this.laserPool.releaseAll()
    for (const ball of this.balls) {
      ball.active = false
      ball.stuck = false
      ball.vel.x = 0
      ball.vel.y = 0
    }
    this.ballSpeedFactor = 1
    this.laserEnabled = false
    this.paddle.halfWidth = this.paddle.baseHalfWidth
    this.paddle.targetX = null
    this.paddle.axisInput = 0
    this.paddle.laserCooldownLeft = 0
  }

  resetRun(): void {
    this.lives = SCORING.startLives
    this.clearTransient()
  }

  spawnStuckBall(): Ball | undefined {
    const ball = this.balls.find((candidate) => !candidate.active)
    if (ball === undefined) return undefined
    ball.active = true
    ball.stuck = true
    ball.radius = BALL.radius
    ball.stuckOffset = 0
    ball.vel.x = 0
    ball.vel.y = 0
    this.placeStuckBall(ball)
    copyVec(ball.prev, ball.pos)
    return ball
  }

  launchStuckBalls(): number {
    let launched = 0
    const speed = this.currentSpeed
    for (const ball of this.balls) {
      if (!ball.active || !ball.stuck) continue
      const ratio = ball.stuckOffset / this.paddle.halfWidth
      const angle = (ratio * (BALL.maxBounceAngleDeg / 2) * Math.PI) / 180
      ball.stuck = false
      ball.vel.x = Math.sin(angle) * speed
      ball.vel.y = Math.cos(angle) * speed
      launched += 1
    }
    return launched
  }

  /**
   * Multiball: clones the first active ball with rotated trajectories.
   *
   * A stuck (or momentarily still) source has no direction to rotate, so the
   * clones are launched instead of copied: cloning a zero velocity would leave
   * live-but-frozen balls that keep the run alive forever.
   */
  addBalls(count: number): void {
    const source = this.balls.find((ball) => ball.active)
    if (source === undefined) return
    const speed = this.currentSpeed
    const drifting = Math.hypot(source.vel.x, source.vel.y) > STILL_EPSILON
    for (let i = 0; i < count; i += 1) {
      if (this.activeBallCount >= BALL.maxCount) return
      const clone = this.balls.find((ball) => !ball.active)
      if (clone === undefined) return
      const angle = ((i % 2 === 0 ? -BALL_ROTATION_DEG : BALL_ROTATION_DEG) * Math.PI) / 180
      clone.active = true
      clone.stuck = false
      clone.stuckOffset = 0
      clone.radius = source.radius
      copyVec(clone.pos, source.pos)
      copyVec(clone.prev, source.pos)
      if (source.stuck || !drifting) {
        setVec(clone.vel, Math.sin(angle) * speed, Math.cos(angle) * speed)
        continue
      }
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      setVec(
        clone.vel,
        source.vel.x * cos - source.vel.y * sin,
        source.vel.x * sin + source.vel.y * cos,
      )
    }
  }

  placeStuckBall(ball: Ball): void {
    const x = this.paddle.pos.x + ball.stuckOffset
    const y = this.paddle.pos.y + this.paddle.halfHeight + ball.radius + 0.2
    setVec(ball.pos, x, y)
    copyVec(ball.prev, ball.pos)
  }

  // ---- Power-up capabilities ------------------------------------------

  widenPaddle(): void {
    this.paddle.halfWidth = PADDLE_WIDE_HALF_WIDTH
  }

  narrowPaddle(): void {
    this.paddle.halfWidth = this.paddle.baseHalfWidth
  }

  setSpeedFactor(factor: number): void {
    this.ballSpeedFactor = factor
  }

  setLaserEnabled(enabled: boolean): void {
    this.laserEnabled = enabled
  }

  addLife(): void {
    this.lives = Math.min(this.lives + 1, SCORING.maxLives)
  }

  // ---- Pooled entities -------------------------------------------------

  spawnPowerUp(type: PowerUpType, at: { x: number; y: number }): PowerUp | undefined {
    const powerUp = this.powerUpPool.acquire()
    if (powerUp === undefined) return undefined
    powerUp.id = this.nextId
    this.nextId += 1
    powerUp.type = type
    setVec(powerUp.pos, at.x, at.y)
    copyVec(powerUp.prev, at)
    setVec(powerUp.vel, 0, -POWER_UPS.fallSpeed)
    powerUp.active = true
    return powerUp
  }

  releasePowerUp(powerUp: PowerUp): void {
    this.powerUpPool.release(powerUp)
  }

  spawnLaser(x: number, y: number): LaserBolt | undefined {
    const bolt = this.laserPool.acquire()
    if (bolt === undefined) return undefined
    bolt.id = this.nextId
    this.nextId += 1
    setVec(bolt.pos, x, y)
    copyVec(bolt.prev, bolt.pos)
    bolt.active = true
    return bolt
  }

  releaseLaser(bolt: LaserBolt): void {
    this.laserPool.release(bolt)
  }

  capturePrevious(): void {
    copyVec(this.paddle.prev, this.paddle.pos)
    for (const ball of this.balls) {
      if (ball.active) copyVec(ball.prev, ball.pos)
    }
    for (const powerUp of this.powerUps) {
      if (powerUp.active) copyVec(powerUp.prev, powerUp.pos)
    }
    for (const bolt of this.lasers) {
      if (bolt.active) copyVec(bolt.prev, bolt.pos)
    }
  }
}
