import { describe, expect, it } from 'vitest'
import { FIELD, PADDLE, POWER_UPS } from '../src/config/gameConfig'
import { PhysicsSystem } from '../src/systems/PhysicsSystem'
import { setVec } from '../src/utils/math'
import { createScene, launchBall } from './helpers'

const physics = new PhysicsSystem()

describe('PhysicsSystem', () => {
  it('moves the paddle with the keyboard axis', () => {
    const { world } = createScene()
    world.paddle.axisInput = 1
    physics.update(world, 0.2)
    expect(world.paddle.pos.x).toBeCloseTo(PADDLE.keyboardSpeed * 0.2)
  })

  it('clamps the paddle inside the field', () => {
    const { world } = createScene()
    world.paddle.axisInput = 1
    for (let step = 0; step < 20; step += 1) physics.update(world, 0.2)
    expect(world.paddle.pos.x).toBeCloseTo(FIELD.halfWidth - world.paddle.halfWidth)
  })

  it('eases the paddle towards the pointer target without teleporting', () => {
    const { world } = createScene()
    world.paddle.targetX = 10
    physics.update(world, 0.05)
    expect(world.paddle.pos.x).toBeCloseTo(PADDLE.pointerSpeed * 0.05)
    expect(world.paddle.pos.x).toBeLessThan(10)
  })

  it('lets keyboard input take over from a stale pointer target', () => {
    const { world } = createScene()
    world.paddle.targetX = 20
    world.paddle.axisInput = -1
    physics.update(world, 0.1)
    expect(world.paddle.targetX).toBeNull()
    expect(world.paddle.pos.x).toBeCloseTo(-PADDLE.keyboardSpeed * 0.1)
  })

  it('keeps a stuck ball riding on the paddle', () => {
    const { world } = createScene()
    const ball = world.spawnStuckBall()
    if (ball === undefined) throw new Error('expected a stuck ball')

    world.paddle.targetX = 8
    for (let step = 0; step < 40; step += 1) physics.update(world, 0.05)
    expect(ball.pos.x).toBeCloseTo(world.paddle.pos.x + ball.stuckOffset)
    expect(ball.pos.y).toBeGreaterThan(world.paddle.pos.y)
  })

  it('normalises the ball speed while it flies', () => {
    const { world } = createScene()
    world.ballSpeed = 40
    const ball = launchBall(world, 0, 0, 3, 4)
    physics.update(world, 0.05)
    expect(Math.hypot(ball.vel.x, ball.vel.y)).toBeCloseTo(40)
  })

  it('ignores inactive balls', () => {
    const { world } = createScene()
    const ball = world.balls[0]
    setVec(ball.vel, 10, 0)
    physics.update(world, 0.5)
    expect(ball.pos.x).toBe(0)
  })

  it('drops power-ups at the configured fall speed', () => {
    const { world } = createScene()
    const powerUp = world.spawnPowerUp('wide', { x: 1, y: 10 })
    if (powerUp === undefined) throw new Error('expected a power-up')

    physics.update(world, 0.5)
    expect(powerUp.pos.y).toBeCloseTo(10 - POWER_UPS.fallSpeed * 0.5)
  })

  it('moves laser bolts upwards', () => {
    const { world } = createScene()
    const bolt = world.spawnLaser(0, 0)
    if (bolt === undefined) throw new Error('expected a laser bolt')

    physics.update(world, 0.1)
    expect(bolt.pos.y).toBeCloseTo(POWER_UPS.laserBoltSpeed * 0.1)
  })

  it('captures the previous transform before moving, which drives interpolation', () => {
    const { world } = createScene()
    world.paddle.axisInput = 1

    physics.update(world, 0.1)
    expect(world.paddle.prev.x).toBeCloseTo(0)

    physics.update(world, 0.1)
    expect(world.paddle.prev.x).toBeCloseTo(PADDLE.keyboardSpeed * 0.1)
  })
})
