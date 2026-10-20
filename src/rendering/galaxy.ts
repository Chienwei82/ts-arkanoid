/**
 * Deterministic description of the galactic backdrop.
 *
 * The module is pure: no three.js, no DOM. It turns a seed into the exact
 * placement of every star, dust lane, nebula blob and core glow, so the same
 * seed always paints the same sky and the layout can be unit-tested in Node.
 *
 * `GalaxyBackdrop` turns this description into instanced geometry.
 */

import { hashSeed, mulberry32, randomRange } from '../utils/rng'

/** One background star, in the backdrop's own units. */
export interface GalaxyStar {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly size: number
  /** 0..1: how bright the star glows. */
  readonly brightness: number
  /** 0..1: hue position used to pick the star colour. */
  readonly tone: number
}
/** A point of a spiral arm: a cluster of stars hugging the arm path. */
export interface GalaxyArmPoint {
  readonly x: number
  readonly y: number
  /** Distance from the core, normalised 0..1. */
  readonly radius: number
  /** How far the point strays from the arm's spine, in units. */
  readonly scatter: number
  readonly size: number
  readonly brightness: number
  readonly tone: number
}

/** The centre line of a spiral arm: the spine the stars scatter around. */
export interface GalaxySpinePoint {
  readonly x: number
  readonly y: number
  /** Distance from the core, normalised 0..1. */
  readonly radius: number
}

/** A soft nebula blob: a wide, faint disc of colour. */
export interface GalaxyNebula {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly opacity: number
  /** 0..1: hue position used to pick the blob colour. */
  readonly tone: number
}

/** The bright bulge at the centre of the galaxy. */
export interface GalaxyCore {
  readonly radius: number
  readonly glowRadius: number
  readonly opacity: number
}

/** A sporadic meteor streaking across the far sky. */
export interface GalaxyMeteor {
  /** Start point of the streak, in the backdrop's own units. */
  readonly x: number
  readonly y: number
  /** Flight direction in radians. */
  readonly angle: number
  /** Travel speed in units per second. */
  readonly speed: number
  /** Seconds before this meteor first appears. */
  readonly delay: number
  /** Streak length in units. */
  readonly length: number
  /** 0..1: hue position used to pick the streak colour. */
  readonly tone: number
}

/** A dust lane: a dark, slightly offset spiral that cuts through the arms. */
export interface GalaxyDustLane {
  readonly points: readonly (readonly [number, number])[]
  readonly width: number
  readonly opacity: number
}

/** The whole description of the sky, ready to be turned into geometry. */
export interface GalaxyLayout {
  readonly seed: number
  readonly core: GalaxyCore
  readonly arms: readonly (readonly GalaxyArmPoint[])[]
  readonly spines: readonly (readonly GalaxySpinePoint[])[]
  readonly dustLanes: readonly GalaxyDustLane[]
  readonly nebulae: readonly GalaxyNebula[]
  readonly fieldStars: readonly GalaxyStar[]
  readonly meteors: readonly GalaxyMeteor[]
}

/** Tuning knobs; the defaults come from `RENDER.space.galaxy`. */
export interface GalaxyOptions {
  readonly armCount: number
  readonly armPoints: number
  readonly armInnerRadius: number
  readonly armOuterRadius: number
  readonly armTurns: number
  readonly armWidth: number
  readonly starsPerArmPoint: number
  readonly fieldStarCount: number
  readonly nebulaCount: number
  readonly dustLaneCount: number
  readonly fieldRadius: number
  readonly fieldDepth: number
  readonly meteorCount: number
}

/** Default shape of the sky; mirrored by `RENDER.space.galaxy`. */
export const DEFAULT_GALAXY_OPTIONS: GalaxyOptions = {
  armCount: 4,
  armPoints: 90,
  armInnerRadius: 6,
  armOuterRadius: 62,
  armTurns: 1.35,
  armWidth: 7,
  starsPerArmPoint: 5,
  fieldStarCount: 320,
  nebulaCount: 9,
  dustLaneCount: 3,
  fieldRadius: 92,
  fieldDepth: 26,
  meteorCount: 3,
}

const TAU = Math.PI * 2

/**
 * Position of a point on a logarithmic spiral arm.
 *
 * The spiral is log-like so the inner turns stay tight and the outer ones
 * spread out, which is what makes a galaxy read as a galaxy.
 */
const armPoint = (
  armIndex: number,
  armCount: number,
  step: number,
  steps: number,
  innerRadius: number,
  outerRadius: number,
  turns: number,
): { readonly x: number; readonly y: number; readonly radius: number } => {
  const t = steps <= 1 ? 0 : step / (steps - 1)
  const radius = innerRadius * (outerRadius / innerRadius) ** t
  const angle = armIndex * (TAU / armCount) + t * turns * TAU
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, radius }
}

/** Builds the star clouds that trace the spiral arms, plus their spines. */
const buildArms = (
  rng: () => number,
  options: GalaxyOptions,
): {
  readonly arms: GalaxyArmPoint[][]
  readonly spines: GalaxySpinePoint[][]
} => {
  const arms: GalaxyArmPoint[][] = []
  const spines: GalaxySpinePoint[][] = []
  for (let arm = 0; arm < options.armCount; arm += 1) {
    const points: GalaxyArmPoint[] = []
    const spine: GalaxySpinePoint[] = []
    for (let step = 0; step < options.armPoints; step += 1) {
      const centre = armPoint(
        arm,
        options.armCount,
        step,
        options.armPoints,
        options.armInnerRadius,
        options.armOuterRadius,
        options.armTurns,
      )
      spine.push({
        x: centre.x,
        y: centre.y,
        radius: centre.radius / options.armOuterRadius,
      })
      for (let star = 0; star < options.starsPerArmPoint; star += 1) {
        // Scatter shrinks towards the core: the centre is crowded, the rim loose.
        const spread = options.armWidth * (1.4 - 0.7 * (centre.radius / options.armOuterRadius))
        const scatter = randomRange(rng, -spread, spread)
        const along = randomRange(rng, -1.2, 1.2)
        const angle = Math.atan2(centre.y, centre.x) + randomRange(rng, -0.12, 0.12)
        const radius = Math.max(options.armInnerRadius * 0.5, centre.radius + scatter + along)
        points.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          radius: radius / options.armOuterRadius,
          scatter: Math.abs(scatter),
          size: randomRange(rng, 0.45, 1.5),
          brightness: randomRange(rng, 0.35, 1),
          tone: rng(),
        })
      }
    }
    arms.push(points)
    spines.push(spine)
  }
  return { arms, spines }
}

/** Dust lanes: darker spiral ribbons that sit just inside each arm. */
const buildDustLanes = (rng: () => number, options: GalaxyOptions): GalaxyDustLane[] => {
  const lanes: GalaxyDustLane[] = []
  for (let lane = 0; lane < options.dustLaneCount; lane += 1) {
    const points: (readonly [number, number])[] = []
    const steps = Math.max(12, Math.floor(options.armPoints / 3))
    const inner = options.armInnerRadius * 1.1
    const outer = options.armOuterRadius * 0.92
    for (let step = 0; step < steps; step += 1) {
      const spine = armPoint(lane, options.armCount, step, steps, inner, outer, options.armTurns)
      // Offset the lane inwards so it hugs the trailing edge of the arm.
      const angle = Math.atan2(spine.y, spine.x) - 0.16
      const radius = spine.radius * 0.94
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
    }
    lanes.push({
      points,
      width: randomRange(rng, 2.4, 5.2),
      opacity: randomRange(rng, 0.16, 0.34),
    })
  }
  return lanes
}

/** Wide, faint colour clouds that give the sky depth. */
const buildNebulae = (rng: () => number, options: GalaxyOptions): GalaxyNebula[] => {
  const nebulae: GalaxyNebula[] = []
  for (let index = 0; index < options.nebulaCount; index += 1) {
    const angle = rng() * TAU
    const distance = randomRange(rng, options.armInnerRadius * 0.6, options.fieldRadius * 0.85)
    nebulae.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      radius: randomRange(rng, 14, 46),
      opacity: randomRange(rng, 0.08, 0.24),
      tone: rng(),
    })
  }
  return nebulae
}

/** Sporadic meteors: short-lived streaks crossing the far sky. */
const buildMeteors = (rng: () => number, options: GalaxyOptions): GalaxyMeteor[] => {
  const meteors: GalaxyMeteor[] = []
  for (let index = 0; index < options.meteorCount; index += 1) {
    const angle = randomRange(rng, -Math.PI * 0.85, -Math.PI * 0.15)
    const spread = options.fieldRadius * 1.1
    meteors.push({
      x: randomRange(rng, -spread, spread),
      y: randomRange(rng, -spread * 0.4, spread * 0.9),
      angle,
      speed: randomRange(rng, 28, 55),
      delay: index * randomRange(rng, 1.6, 4.2),
      length: randomRange(rng, 9, 18),
      tone: rng(),
    })
  }
  return meteors
}

/** The far field: sparse stars scattered across the whole sky. */
const buildFieldStars = (rng: () => number, options: GalaxyOptions): GalaxyStar[] => {
  const stars: GalaxyStar[] = []
  for (let index = 0; index < options.fieldStarCount; index += 1) {
    // Square-root radius keeps the density even instead of clumping in the middle.
    const radius = Math.sqrt(rng()) * options.fieldRadius
    const angle = rng() * TAU
    stars.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: randomRange(rng, -options.fieldDepth, options.fieldDepth),
      size: randomRange(rng, 0.25, 0.95),
      brightness: randomRange(rng, 0.2, 0.85),
      tone: rng(),
    })
  }
  return stars
}

/**
 * Builds the whole galactic layout for a seed.
 *
 * Deterministic: the same seed and options always return the same layout, and
 * different seeds produce visibly different skies.
 */
export const buildGalaxyLayout = (
  seed: number | string,
  options: GalaxyOptions = DEFAULT_GALAXY_OPTIONS,
): GalaxyLayout => {
  const resolvedSeed = hashSeed(seed)
  const rng = mulberry32(resolvedSeed)
  const coreRadius = options.armInnerRadius * 0.72
  const { arms, spines } = buildArms(rng, options)
  return {
    seed: resolvedSeed,
    core: {
      radius: coreRadius,
      glowRadius: coreRadius * 4.2,
      opacity: 0.95,
    },
    arms,
    spines,
    dustLanes: buildDustLanes(rng, options),
    nebulae: buildNebulae(rng, options),
    fieldStars: buildFieldStars(rng, options),
    meteors: buildMeteors(rng, options),
  }
}
