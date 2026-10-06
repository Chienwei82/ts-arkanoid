import { describe, expect, it } from 'vitest'
import { PADDLE, POWER_UPS } from '../src/config/gameConfig'
import { LaserSystem } from '../src/systems/LaserSystem'
import { collect, createScene } from './helpers'

const createLaserScene = () => {
  const scene = createScene()
  const laser = new LaserSystem(scene.bus)
  return { ...scene, laser }
}

describe('LaserSystem', () => {
  it('fires a symmetric pair of bolts from the paddle', () => {
    const { world, laser, bus } = createLaserScene()
    const fired = collect(bus, 'laserFired')
    world.setLaserEnabled(true)

    laser.update(world, 1 / 120, true)

    const bolts = world.lasers.filter((bolt) => bolt.active)
    expect(bolts).toHaveLength(2)
    const xs = bolts.map((bolt) => bolt.pos.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(-PADDLE.baseHalfWidth * 0.6)
    expect(xs[1]).toBeCloseTo(PADDLE.baseHalfWidth * 0.6)
    expect(bolts.every((bolt) => bolt.pos.y > world.paddle.pos.y)).toBe(true)
    expect(fired).toHaveLength(1)
  })

  it('stays silent while the effect is off or the trigger is released', () => {
    const { world, laser } = createLaserScene()

    laser.update(world, 1 / 120, true)
    expect(world.lasers.filter((bolt) => bolt.active)).toHaveLength(0)

    world.setLaserEnabled(true)
    laser.update(world, 1 / 120, false)
    expect(world.lasers.filter((bolt) => bolt.active)).toHaveLength(0)
  })

  it('respects the cooldown between volleys', () => {
    const { world, laser } = createLaserScene()
    world.setLaserEnabled(true)

    laser.update(world, 1 / 120, true)
    laser.update(world, 1 / 120, true)
    expect(world.lasers.filter((bolt) => bolt.active)).toHaveLength(2)

    laser.update(world, PADDLE.laserCooldown, true)
    expect(world.lasers.filter((bolt) => bolt.active)).toHaveLength(4)
  })

  it('does not burn the cooldown when the pool is exhausted', () => {
    const { world, laser } = createLaserScene()
    world.setLaserEnabled(true)
    while (world.spawnLaser(0, 0) !== undefined) {
      // Fill the bolt pool completely.
    }

    laser.update(world, 1 / 120, true)

    expect(world.paddle.laserCooldownLeft).toBe(0)
    expect(world.lasers.filter((bolt) => bolt.active)).toHaveLength(POWER_UPS.laserPoolSize)
  })

  it('drains the cooldown over time', () => {
    const { world, laser } = createLaserScene()
    world.setLaserEnabled(true)
    laser.update(world, 1 / 120, true)

    laser.update(world, PADDLE.laserCooldown / 2, false)

    expect(world.paddle.laserCooldownLeft).toBeGreaterThan(0)
    expect(world.paddle.laserCooldownLeft).toBeCloseTo(PADDLE.laserCooldown / 2)
  })
})
