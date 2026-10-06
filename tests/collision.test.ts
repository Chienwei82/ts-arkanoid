import { describe, expect, it } from 'vitest'
import { BALL, BRICK, FIELD } from '../src/config/gameConfig'
import { createBricks } from '../src/entities/brickFactory'
import { collect, createScene, launchBall, testLevel } from './helpers'

/** Scene with a level already loaded (rows must contain a destructible brick). */
const withBricks = (rows: readonly string[]) => {
  const scene = createScene()
  scene.world.setBricks(createBricks(testLevel(rows)), 0, 'TEST', 1)
  return scene
}

const bottomOf = (y: number, halfHeight: number): number => y - halfHeight - 0.5

describe('CollisionSystem walls and paddle', () => {
  it('bounces the ball off the side wall and reports the hit', () => {
    const scene = withBricks(['#'])
    const wallHits = collect(scene.bus, 'wallHit')
    const ball = launchBall(scene.world, -FIELD.halfWidth + BALL.radius - 0.2, 0, -30, 0)

    scene.collision.update(scene.world)

    expect(ball.vel.x).toBeGreaterThan(0)
    expect(ball.pos.x).toBeCloseTo(-(FIELD.halfWidth - BALL.radius))
    expect(wallHits).toHaveLength(1)
    expect(wallHits[0].strength).toBeGreaterThan(0)
  })

  it('bounces the ball off the top wall', () => {
    const scene = withBricks(['#'])
    const ball = launchBall(scene.world, -30, FIELD.halfHeight - BALL.radius + 0.3, 0, 30)

    scene.collision.update(scene.world)

    expect(ball.vel.y).toBeLessThan(0)
    expect(ball.pos.y).toBeCloseTo(FIELD.halfHeight - BALL.radius)
  })

  it('steers the outgoing angle with the paddle impact point', () => {
    const scene = withBricks(['#'])
    const { paddle } = scene.world
    const hits = collect(scene.bus, 'paddleHit')
    const ball = launchBall(scene.world, paddle.halfWidth * 0.8, paddle.pos.y + 2, 0, -30)

    scene.collision.update(scene.world)

    expect(ball.vel.x).toBeGreaterThan(0)
    expect(ball.vel.y).toBeGreaterThan(0)
    expect(ball.pos.y).toBeGreaterThan(paddle.pos.y)
    expect(hits).toHaveLength(1)
    expect(hits[0].strength).toBeGreaterThan(0)
    expect(hits[0].strength).toBeLessThanOrEqual(1)
  })

  it('sends a centre hit straight up and mirrors a left hit', () => {
    const centreScene = withBricks(['#'])
    const centreBall = launchBall(centreScene.world, 0, centreScene.world.paddle.pos.y + 2, 0, -30)
    centreScene.collision.update(centreScene.world)
    expect(centreBall.vel.x).toBeCloseTo(0)

    const leftScene = withBricks(['#'])
    const offset = -leftScene.world.paddle.halfWidth * 0.6
    const leftBall = launchBall(leftScene.world, offset, leftScene.world.paddle.pos.y + 2, 0, -30)
    leftScene.collision.update(leftScene.world)
    expect(leftBall.vel.x).toBeLessThan(0)
  })

  it('deactivates a ball that falls past the bottom edge', () => {
    const scene = withBricks(['#'])
    const ball = launchBall(
      scene.world,
      0,
      -FIELD.halfHeight - BALL.outMargin - 1,
      0,
      -BALL.baseSpeed,
    )

    scene.collision.update(scene.world)

    expect(ball.active).toBe(false)
  })
})

describe('CollisionSystem edge cases', () => {
  it('escapes a brick when the ball centre is already inside it', () => {
    const scene = withBricks(['#'])
    const brick = scene.world.bricks[0]
    const ball = launchBall(scene.world, brick.pos.x, brick.pos.y, 0, -30)

    scene.collision.update(scene.world)

    expect(brick.alive).toBe(false)
    // Pushed out of the box: never left embedded in the grid.
    const outsideX = Math.abs(ball.pos.x - brick.pos.x) > brick.halfWidth
    const outsideY = Math.abs(ball.pos.y - brick.pos.y) > brick.halfHeight
    expect(outsideX || outsideY).toBe(true)
  })

  it('ignores a ball moving away from the paddle', () => {
    const scene = withBricks(['#'])
    const { paddle } = scene.world
    const hits = collect(scene.bus, 'paddleHit')
    const ball = launchBall(scene.world, 0, paddle.pos.y + 1, 0, 30)

    scene.collision.update(scene.world)

    expect(hits).toHaveLength(0)
    expect(ball.vel.y).toBeGreaterThan(0)
  })

  it('bounces twice off the same wall on opposite sides', () => {
    const scene = withBricks(['#'])
    const ball = launchBall(scene.world, FIELD.halfWidth - BALL.radius + 0.2, 0, 30, 0)

    scene.collision.update(scene.world)

    expect(ball.vel.x).toBeLessThan(0)
    expect(ball.pos.x).toBeCloseTo(FIELD.halfWidth - BALL.radius)
  })

  it('escapes sideways when the shallowest push is horizontal', () => {
    const scene = withBricks(['....#....'])
    const brick = scene.world.bricks[0]
    const ball = launchBall(scene.world, brick.pos.x + brick.halfWidth - 0.2, brick.pos.y, 0, -30)

    scene.collision.update(scene.world)

    // Embedded recovery: the ball leaves the box through its nearest face, and a
    // contact with no separating direction must not invent an upward bounce.
    expect(Math.abs(ball.pos.x - brick.pos.x)).toBeGreaterThan(brick.halfWidth)
    expect(ball.pos.y).toBe(brick.pos.y)
  })

  it('escapes to the left when the centre sits left of the brick', () => {
    const scene = withBricks(['....#....'])
    const brick = scene.world.bricks[0]
    const ball = launchBall(scene.world, brick.pos.x - brick.halfWidth + 0.2, brick.pos.y, 0, -30)

    scene.collision.update(scene.world)

    expect(ball.pos.x).toBeLessThan(brick.pos.x)
    expect(Math.abs(ball.pos.x - brick.pos.x)).toBeGreaterThan(brick.halfWidth)
  })
})

describe('CollisionSystem bricks', () => {
  it('destroys a normal brick, scores it and emits the payload', () => {
    const scene = withBricks(['#'])
    const destroyed = collect(scene.bus, 'brickDestroyed')
    const brick = scene.world.bricks[0]
    const ball = launchBall(
      scene.world,
      brick.pos.x,
      bottomOf(brick.pos.y, brick.halfHeight),
      0,
      30,
    )

    scene.collision.update(scene.world)

    expect(brick.alive).toBe(false)
    expect(ball.vel.y).toBeLessThan(0)
    expect(destroyed).toHaveLength(1)
    expect(destroyed[0].points).toBe(50)
    expect(destroyed[0].type).toBe('normal')
    expect(scene.scoring.score).toBe(50)
  })

  it('reports partial damage on tough bricks', () => {
    const scene = withBricks(['+'])
    const damaged = collect(scene.bus, 'brickDamaged')
    const destroyed = collect(scene.bus, 'brickDestroyed')
    const brick = scene.world.bricks[0]
    launchBall(scene.world, brick.pos.x, bottomOf(brick.pos.y, brick.halfHeight), 0, 30)

    scene.collision.update(scene.world)

    expect(brick.hitsLeft).toBe(BRICK.toughHits - 1)
    expect(damaged).toHaveLength(1)
    expect(damaged[0].hitsLeft).toBe(BRICK.toughHits - 1)
    expect(destroyed).toHaveLength(0)
    expect(scene.scoring.score).toBe(0)
  })

  it('bounces off indestructible bricks without scoring', () => {
    const scene = withBricks(['X#'])
    const brick = scene.world.bricks[0]
    expect(brick.type).toBe('indestructible')
    const ball = launchBall(
      scene.world,
      brick.pos.x,
      bottomOf(brick.pos.y, brick.halfHeight),
      0,
      30,
    )

    scene.collision.update(scene.world)

    expect(brick.alive).toBe(true)
    expect(ball.vel.y).toBeLessThan(0)
    expect(scene.scoring.score).toBe(0)
  })

  it('chain-detonates the neighbourhood of an explosive brick', () => {
    const scene = withBricks(['!!!..........'])
    const destroyed = collect(scene.bus, 'brickDestroyed')
    const middle = scene.world.bricks[1]
    launchBall(scene.world, middle.pos.x, bottomOf(middle.pos.y, middle.halfHeight), 0, 30)

    scene.collision.update(scene.world)

    expect(destroyed).toHaveLength(3)
    expect(destroyed[0].chain).toBe(false)
    expect(destroyed.slice(1).every((event) => event.chain)).toBe(true)
    expect(scene.world.destructibleAlive).toBe(false)
  })

  it('drops a power-up when the level roll succeeds', () => {
    const scene = createScene({ dropRate: 1, random: () => 0 })
    scene.world.setBricks(createBricks(testLevel(['#'])), 0, 'TEST', 1)
    const brick = scene.world.bricks[0]
    launchBall(scene.world, brick.pos.x, bottomOf(brick.pos.y, brick.halfHeight), 0, 30)

    scene.collision.update(scene.world)

    const dropped = scene.world.powerUps.filter((powerUp) => powerUp.active)
    expect(dropped).toHaveLength(1)
    expect(dropped[0].type).toBe('wide')
  })
})

describe('CollisionSystem pickups and lasers', () => {
  it('collects a power-up touching the paddle and applies its effect', () => {
    const scene = withBricks(['#'])
    const collected = collect(scene.bus, 'powerUpCollected')
    const paddle = scene.world.paddle
    const before = paddle.halfWidth
    const powerUp = scene.world.spawnPowerUp('wide', { x: paddle.pos.x, y: paddle.pos.y + 0.5 })
    if (powerUp === undefined) throw new Error('expected a power-up')

    scene.collision.update(scene.world)

    expect(powerUp.active).toBe(false)
    expect(collected).toEqual([{ type: 'wide' }])
    expect(paddle.halfWidth).toBeGreaterThan(before)
  })

  it('recycles power-ups that fall out of the field', () => {
    const scene = withBricks(['#'])
    const powerUp = scene.world.spawnPowerUp('slow', { x: 0, y: -FIELD.halfHeight - 5 })
    if (powerUp === undefined) throw new Error('expected a power-up')

    scene.collision.update(scene.world)

    expect(powerUp.active).toBe(false)
  })

  it('lets laser bolts destroy bricks', () => {
    const scene = withBricks(['#'])
    const brick = scene.world.bricks[0]
    const bolt = scene.world.spawnLaser(brick.pos.x, brick.pos.y)
    if (bolt === undefined) throw new Error('expected a laser bolt')

    scene.collision.update(scene.world)

    expect(brick.alive).toBe(false)
    expect(bolt.active).toBe(false)
    expect(scene.scoring.score).toBe(50)
  })

  it('recycles laser bolts that leave the field', () => {
    const scene = withBricks(['#'])
    const bolt = scene.world.spawnLaser(0, FIELD.halfHeight + 2)
    if (bolt === undefined) throw new Error('expected a laser bolt')

    scene.collision.update(scene.world)

    expect(bolt.active).toBe(false)
  })
})
