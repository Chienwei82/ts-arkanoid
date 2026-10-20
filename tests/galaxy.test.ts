// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { AdditiveBlending, InstancedMesh, Mesh, Texture } from 'three'
import { RENDER } from '../src/config/gameConfig'
import { GalaxyBackdrop } from '../src/rendering/GalaxyBackdrop'
import {
  buildGalaxyLayout,
  DEFAULT_GALAXY_OPTIONS,
  type GalaxyLayout,
} from '../src/rendering/galaxy'
import type { CraftTextures } from '../src/rendering/textures'

/** A compact snapshot of a layout, used to compare two builds cheaply. */
const snapshot = (layout: GalaxyLayout): string =>
  JSON.stringify({
    seed: layout.seed,
    core: layout.core,
    arms: layout.arms,
    spines: layout.spines,
    dustLanes: layout.dustLanes,
    nebulae: layout.nebulae,
    fieldStars: layout.fieldStars,
    meteors: layout.meteors,
  })

describe('galaxy layout', () => {
  it('is deterministic for the same seed', () => {
    const first = buildGalaxyLayout('arkanoid.galaxy.v1')
    const second = buildGalaxyLayout('arkanoid.galaxy.v1')

    expect(snapshot(first)).toBe(snapshot(second))
  })

  it('produces a different sky for a different seed', () => {
    const first = buildGalaxyLayout('arkanoid.galaxy.v1')
    const second = buildGalaxyLayout('arkanoid.galaxy.v2')

    expect(snapshot(first)).not.toBe(snapshot(second))
  })

  it('builds one spine and one star cloud per arm', () => {
    const layout = buildGalaxyLayout('arkanoid.galaxy.v1', {
      ...DEFAULT_GALAXY_OPTIONS,
      armCount: 4,
      armPoints: 12,
      starsPerArmPoint: 3,
    })

    expect(layout.arms).toHaveLength(4)
    expect(layout.spines).toHaveLength(4)
    expect(layout.arms[0]).toHaveLength(12 * 3)
    expect(layout.spines[0]).toHaveLength(12)
    expect(layout.arms.flat()).toHaveLength(4 * 12 * 3)
  })

  it('keeps the arms evenly spread around the core', () => {
    const layout = buildGalaxyLayout('arkanoid.galaxy.v1', {
      ...DEFAULT_GALAXY_OPTIONS,
      armCount: 4,
      armPoints: 8,
    })
    const firstAngles = layout.spines[0].map((point) => Math.atan2(point.y, point.x))
    const secondAngles = layout.spines[1].map((point) => Math.atan2(point.y, point.x))

    for (let index = 0; index < firstAngles.length; index += 1) {
      const gap = Math.abs(secondAngles[index] - firstAngles[index])
      // A quarter turn between neighbouring arms, wrapped into [0, PI].
      const wrapped = Math.min(gap, Math.PI * 2 - gap)
      expect(wrapped).toBeCloseTo(Math.PI / 2, 5)
    }
  })

  it('grows the radius from the inner to the outer arm edge', () => {
    const layout = buildGalaxyLayout('arkanoid.galaxy.v1', {
      ...DEFAULT_GALAXY_OPTIONS,
      armPoints: 16,
    })
    const radii = layout.spines[0].map((point) => Math.hypot(point.x, point.y))

    expect(radii[0]).toBeLessThan(radii[radii.length - 1])
    expect(radii[0]).toBeGreaterThanOrEqual(DEFAULT_GALAXY_OPTIONS.armInnerRadius * 0.9)
  })

  it('places the field stars inside the configured radius', () => {
    const options = { ...DEFAULT_GALAXY_OPTIONS, fieldStarCount: 64, fieldRadius: 40 }
    const layout = buildGalaxyLayout('arkanoid.galaxy.v1', options)

    expect(layout.fieldStars).toHaveLength(64)
    for (const star of layout.fieldStars) {
      expect(Math.hypot(star.x, star.y)).toBeLessThanOrEqual(options.fieldRadius)
      expect(star.size).toBeGreaterThan(0)
      expect(star.brightness).toBeGreaterThanOrEqual(0)
      expect(star.brightness).toBeLessThanOrEqual(1)
    }
  })

  it('matches the render configuration', () => {
    const layout = buildGalaxyLayout(RENDER.space.galaxy.seed, {
      armCount: RENDER.space.galaxy.armCount,
      armPoints: RENDER.space.galaxy.armPoints,
      armInnerRadius: RENDER.space.galaxy.armInnerRadius,
      armOuterRadius: RENDER.space.galaxy.armOuterRadius,
      armTurns: RENDER.space.galaxy.armTurns,
      armWidth: RENDER.space.galaxy.armWidth,
      starsPerArmPoint: RENDER.space.galaxy.starsPerArmPoint,
      fieldStarCount: RENDER.space.galaxy.fieldStarCount,
      nebulaCount: RENDER.space.galaxy.nebulaCount,
      dustLaneCount: RENDER.space.galaxy.dustLaneCount,
      fieldRadius: RENDER.space.galaxy.fieldRadius,
      fieldDepth: RENDER.space.galaxy.fieldDepth,
      meteorCount: RENDER.space.galaxy.meteors.count,
    })

    expect(layout.arms).toHaveLength(RENDER.space.galaxy.armCount)
    expect(layout.nebulae).toHaveLength(RENDER.space.galaxy.nebulaCount)
    expect(layout.dustLanes).toHaveLength(RENDER.space.galaxy.dustLaneCount)
    expect(layout.fieldStars).toHaveLength(RENDER.space.galaxy.fieldStarCount)
    expect(layout.meteors).toHaveLength(RENDER.space.galaxy.meteors.count)
  })

  it('aims every meteor diagonally downwards with a staggered delay', () => {
    const layout = buildGalaxyLayout('arkanoid.galaxy.v1')

    expect(layout.meteors.length).toBeGreaterThan(0)
    let previousDelay = -1
    for (const meteor of layout.meteors) {
      expect(meteor.angle).toBeLessThan(0)
      expect(meteor.angle).toBeGreaterThan(-Math.PI)
      expect(meteor.speed).toBeGreaterThan(0)
      expect(meteor.length).toBeGreaterThan(0)
      expect(meteor.delay).toBeGreaterThanOrEqual(previousDelay)
      previousDelay = meteor.delay
    }
  })
})

/**
 * The backdrop only needs the glow sprite, so a bare texture keeps the test
 * independent from the canvas painting (jsdom has no 2D context).
 */
const createTextures = (): CraftTextures => ({ glow: new Texture() }) as unknown as CraftTextures

describe('galaxy backdrop', () => {
  it('builds the sky behind the diorama', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    // Core, arm ribbons, dust lanes, nebulae and two instanced star layers.
    expect(backdrop.object.children.length).toBeGreaterThan(0)
    expect(backdrop.object.position.z).toBe(RENDER.space.galaxy.depth)
    expect(backdrop.object.position.x).toBe(RENDER.space.galaxy.offsetX)
    expect(backdrop.object.position.y).toBe(RENDER.space.galaxy.offsetY)

    backdrop.dispose()
  })

  it('instancises the stars and meteors instead of adding one mesh per star', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    const instanced = backdrop.object.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh,
    )
    expect(instanced).toHaveLength(3)
    for (const mesh of instanced) {
      expect(mesh.count).toBeGreaterThan(0)
      expect(mesh.frustumCulled).toBe(false)
    }

    backdrop.dispose()
  })

  it('draws the arms additively and the dust lanes with normal blending', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    const additive = backdrop.object.children.filter(
      (child): child is Mesh =>
        child instanceof Mesh &&
        (child.material as { blending?: number }).blending === AdditiveBlending,
    )
    expect(additive.length).toBeGreaterThan(0)

    // The dust lanes subtract light, so they must not blend additively.
    const normal = backdrop.object.children.filter(
      (child): child is Mesh =>
        child instanceof Mesh &&
        (child.material as { blending?: number }).blending !== AdditiveBlending,
    )
    expect(normal.length).toBeGreaterThan(0)

    backdrop.dispose()
  })

  it('spins the sky and pulses the core over time', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    backdrop.update(1)
    const firstRotation = backdrop.object.rotation.z
    backdrop.update(1)
    const secondRotation = backdrop.object.rotation.z

    expect(secondRotation).toBeGreaterThan(firstRotation)
    expect(firstRotation).toBeCloseTo(RENDER.space.galaxy.spin, 6)

    backdrop.dispose()
  })

  it('fires a decaying flash that blooms the core halo', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    expect(backdrop.flashEnergy).toBe(0)
    backdrop.flash(1)
    expect(backdrop.flashEnergy).toBeGreaterThan(0)

    backdrop.update(0.1)
    const midEnergy = backdrop.flashEnergy
    expect(midEnergy).toBeGreaterThan(0)
    expect(midEnergy).toBeLessThan(1)

    // After one full decay window the ripple has eased back to calm.
    backdrop.update(1)
    expect(backdrop.flashEnergy).toBe(0)

    backdrop.dispose()
  })

  it('releases its children and stops animating once disposed', () => {
    const backdrop = new GalaxyBackdrop(createTextures())

    backdrop.dispose()
    expect(backdrop.object.children.length).toBe(0)

    // A disposed backdrop must not keep touching the (already freed) scene.
    backdrop.update(1)
    expect(backdrop.object.rotation.z).toBe(0)

    // Disposing twice is safe.
    expect(() => backdrop.dispose()).not.toThrow()
  })
})
