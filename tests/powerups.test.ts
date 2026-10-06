import { describe, expect, it } from 'vitest'
import { PADDLE, POWER_UPS } from '../src/config/gameConfig'
import type { Paddle, PowerUpType } from '../src/entities/types'
import {
  PADDLE_WIDE_HALF_WIDTH,
  powerUpEffects,
  type PowerUpTarget,
} from '../src/entities/PowerUpEffect'
import { rollPowerUpType } from '../src/entities/powerUpFactory'
import { vec2 } from '../src/utils/math'
import { collect, createScene } from './helpers'

const ALL_TYPES: readonly PowerUpType[] = ['wide', 'multi', 'slow', 'fast', 'laser', 'life']

const paddleStub = (): Paddle => ({
  pos: vec2(),
  prev: vec2(),
  halfWidth: PADDLE.baseHalfWidth,
  baseHalfWidth: PADDLE.baseHalfWidth,
  halfHeight: PADDLE.halfHeight,
  axisInput: 0,
  targetX: null,
  laserCooldownLeft: 0,
})

interface Stub {
  readonly target: PowerUpTarget
  readonly calls: string[]
}

/** Stand-in for World so effects can be asserted call by call. */
const createTarget = (): Stub => {
  const calls: string[] = []
  const target: PowerUpTarget = {
    paddle: paddleStub(),
    balls: [],
    widenPaddle: () => calls.push('widen'),
    narrowPaddle: () => calls.push('narrow'),
    addBalls: (count) => calls.push(`balls:${count}`),
    setSpeedFactor: (factor) => calls.push(`speed:${factor}`),
    setLaserEnabled: (enabled) => calls.push(`laser:${enabled}`),
    addLife: () => calls.push('life'),
  }
  return { target, calls }
}

describe('power-up effects (Strategy)', () => {
  it('defines one effect per power-up type', () => {
    for (const type of ALL_TYPES) {
      expect(powerUpEffects[type].type).toBe(type)
    }
  })

  it('applies and reverts the paddle widening', () => {
    const { target, calls } = createTarget()
    powerUpEffects.wide.apply(target)
    powerUpEffects.wide.revert(target)
    expect(calls).toEqual(['widen', 'narrow'])
    expect(powerUpEffects.wide.duration).toBe(POWER_UPS.durations.wide)
    expect(PADDLE_WIDE_HALF_WIDTH).toBeGreaterThan(PADDLE.baseHalfWidth)
  })

  it('spawns extra balls instantly', () => {
    const { target, calls } = createTarget()
    powerUpEffects.multi.apply(target)
    powerUpEffects.multi.revert(target)
    expect(calls).toEqual(['balls:2'])
    expect(powerUpEffects.multi.duration).toBeNull()
  })

  it('drives the two speed effects and their reversions', () => {
    const { target, calls } = createTarget()
    powerUpEffects.slow.apply(target)
    powerUpEffects.slow.revert(target)
    powerUpEffects.fast.apply(target)
    powerUpEffects.fast.revert(target)
    expect(calls).toEqual([
      `speed:${POWER_UPS.slowFactor}`,
      'speed:1',
      `speed:${POWER_UPS.fastFactor}`,
      'speed:1',
    ])
  })

  it('toggles the laser and grants a life', () => {
    const { target, calls } = createTarget()
    powerUpEffects.laser.apply(target)
    powerUpEffects.laser.revert(target)
    powerUpEffects.life.apply(target)
    expect(calls).toEqual(['laser:true', 'laser:false', 'life'])
    expect(powerUpEffects.life.duration).toBeNull()
  })
})

describe('power-up drop table', () => {
  it('picks a type from the weighted table', () => {
    expect(rollPowerUpType(() => 0)).toBe('wide')
    expect(rollPowerUpType(() => 0.999)).toBe('life')
  })

  it('walks the weights in declaration order', () => {
    const beforeSlow = (POWER_UPS.weights.wide + POWER_UPS.weights.multi) / 100 + 0.001
    expect(rollPowerUpType(() => beforeSlow)).toBe('slow')
  })
})

describe('PowerUpSystem', () => {
  it('spawns a drop only when the roll succeeds', () => {
    const hit = createScene({ dropRate: 0.5, random: () => 0.4 })
    hit.powerUpSystem.maybeSpawn(hit.world, vec2(0, 0))
    expect(hit.world.powerUps.filter((powerUp) => powerUp.active)).toHaveLength(1)

    const miss = createScene({ dropRate: 0.5, random: () => 0.6 })
    miss.powerUpSystem.maybeSpawn(miss.world, vec2(0, 0))
    expect(miss.world.powerUps.filter((powerUp) => powerUp.active)).toHaveLength(0)
  })

  it('keeps a timed effect until its duration elapses', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'slow')

    expect(scene.powerUpSystem.isActive('slow')).toBe(true)
    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.slowFactor)
    expect(scene.powerUpSystem.snapshot()).toEqual([
      { type: 'slow', remaining: POWER_UPS.durations.slow },
    ])

    scene.powerUpSystem.update(scene.world, POWER_UPS.durations.slow - 0.5)
    expect(scene.powerUpSystem.isActive('slow')).toBe(true)

    scene.powerUpSystem.update(scene.world, 1)
    expect(scene.powerUpSystem.isActive('slow')).toBe(false)
    expect(scene.world.ballSpeedFactor).toBe(1)
    expect(scene.powerUpSystem.snapshot()).toEqual([])
  })

  it('restores the surviving speed effect when its twin expires', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'slow')
    scene.powerUpSystem.collect(scene.world, 'fast')
    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.fastFactor)

    scene.powerUpSystem.update(scene.world, POWER_UPS.durations.fast + 0.1)

    expect(scene.powerUpSystem.isActive('fast')).toBe(false)
    expect(scene.powerUpSystem.isActive('slow')).toBe(true)
    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.slowFactor)
  })

  it('keeps the last collected speed effect as the winner while both run', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'slow')
    scene.powerUpSystem.collect(scene.world, 'fast')

    // Crosses a whole-second HUD tick, which must not flip the factor back.
    scene.powerUpSystem.update(scene.world, 1.5)

    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.fastFactor)
  })

  it('lets a refreshed speed effect take the factor back', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'slow')
    scene.powerUpSystem.collect(scene.world, 'fast')

    scene.powerUpSystem.collect(scene.world, 'slow')

    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.slowFactor)
  })

  it('keeps the winner running when the losing twin expires first', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'fast')
    scene.powerUpSystem.collect(scene.world, 'slow')

    scene.powerUpSystem.update(scene.world, POWER_UPS.durations.fast + 0.1)

    expect(scene.powerUpSystem.isActive('fast')).toBe(false)
    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.slowFactor)
  })

  it('applies instant effects straight away', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'life')
    expect(scene.world.lives).toBe(3 + 1)
    expect(scene.powerUpSystem.snapshot()).toEqual([])

    scene.world.spawnStuckBall()
    scene.world.launchStuckBalls()
    scene.powerUpSystem.collect(scene.world, 'multi')
    expect(scene.world.activeBallCount).toBe(3)
  })

  it('keeps every running effect in the HUD snapshot', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'slow')
    scene.powerUpSystem.collect(scene.world, 'laser')

    const types = scene.powerUpSystem
      .snapshot()
      .map((status) => status.type)
      .sort()
    expect(types).toEqual(['laser', 'slow'])
  })

  it('announces each effect that runs out', () => {
    const scene = createScene()
    const expired = collect(scene.bus, 'powerUpExpired')
    scene.powerUpSystem.collect(scene.world, 'fast')

    scene.powerUpSystem.update(scene.world, POWER_UPS.durations.fast + 0.1)

    expect(expired).toEqual([{ type: 'fast' }])
    expect(scene.powerUpSystem.snapshot()).toEqual([])
  })

  it('does not announce effects cancelled by a reset', () => {
    const scene = createScene()
    const expired = collect(scene.bus, 'powerUpExpired')
    scene.powerUpSystem.collect(scene.world, 'laser')

    scene.powerUpSystem.reset(scene.world)

    expect(expired).toHaveLength(0)
  })

  it('collecting the same timed effect again refreshes its timer', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'wide')
    scene.powerUpSystem.update(scene.world, POWER_UPS.durations.wide - 1)
    const nearExpiry = scene.powerUpSystem.snapshot()[0].remaining

    scene.powerUpSystem.collect(scene.world, 'wide')

    expect(nearExpiry).toBeLessThan(1.5)
    expect(scene.powerUpSystem.snapshot()).toHaveLength(1)
    expect(scene.powerUpSystem.snapshot()[0].remaining).toBe(POWER_UPS.durations.wide)
    expect(scene.world.paddle.halfWidth).toBe(PADDLE_WIDE_HALF_WIDTH)
  })

  it('runs several different effects at the same time', () => {
    const scene = createScene()
    for (const type of ['wide', 'slow', 'fast', 'laser'] as const) {
      scene.powerUpSystem.collect(scene.world, type)
    }

    expect(scene.powerUpSystem.snapshot()).toHaveLength(4)
    expect(scene.world.laserEnabled).toBe(true)
    expect(scene.world.ballSpeedFactor).toBe(POWER_UPS.fastFactor)
  })

  it('returns nothing when the ball pool is exhausted', () => {
    const scene = createScene()
    for (const ball of scene.world.balls) {
      ball.active = true
      ball.stuck = false
    }

    expect(scene.world.spawnStuckBall()).toBeUndefined()
  })

  it('returns nothing when the drop pool is exhausted', () => {
    const scene = createScene()
    while (scene.world.spawnPowerUp('wide', vec2(0, 0)) !== undefined) {
      // Fill the power-up pool completely.
    }

    expect(scene.world.spawnPowerUp('wide', vec2(0, 0))).toBeUndefined()
    expect(scene.world.powerUps.filter((drop) => drop.active)).toHaveLength(POWER_UPS.poolSize)
  })

  it('cannot clone balls while none is flying', () => {
    const scene = createScene()
    scene.world.addBalls(2)
    expect(scene.world.activeBallCount).toBe(0)
  })

  it('recycles every pooled entity when the world is cleared', () => {
    const scene = createScene()
    scene.world.spawnPowerUp('wide', vec2(0, 0))
    scene.world.spawnLaser(0, 0)
    scene.world.spawnStuckBall()

    scene.world.clearTransient()

    expect(scene.world.powerUps.filter((drop) => drop.active)).toHaveLength(0)
    expect(scene.world.lasers.filter((bolt) => bolt.active)).toHaveLength(0)
    expect(scene.world.activeBallCount).toBe(0)
    expect(scene.world.paddle.halfWidth).toBe(PADDLE.baseHalfWidth)
    expect(scene.world.laserEnabled).toBe(false)
    expect(scene.world.ballSpeedFactor).toBe(1)
  })

  it('reverts every running effect when a level resets', () => {
    const scene = createScene()
    scene.powerUpSystem.collect(scene.world, 'wide')
    scene.powerUpSystem.collect(scene.world, 'laser')
    expect(scene.world.paddle.halfWidth).toBe(PADDLE_WIDE_HALF_WIDTH)
    expect(scene.world.laserEnabled).toBe(true)

    scene.powerUpSystem.reset(scene.world)

    expect(scene.world.paddle.halfWidth).toBe(PADDLE.baseHalfWidth)
    expect(scene.world.laserEnabled).toBe(false)
    expect(scene.powerUpSystem.snapshot()).toEqual([])
  })
})
