/**
 * Central tuning for gameplay and rendering. Systems import named values from
 * here instead of embedding magic numbers.
 */

export const FIELD = {
  halfWidth: 32,
  halfHeight: 24,
  wallThickness: 1.6,
} as const

export const BALL = {
  radius: 1.15,
  baseSpeed: 36,
  maxBounceAngleDeg: 68,
  maxCount: 6,
  outMargin: 4,
} as const

export const PADDLE = {
  baseHalfWidth: 5,
  halfHeight: 1.1,
  depth: 1.6,
  bottomOffset: 3.4,
  keyboardSpeed: 70,
  pointerSpeed: 105,
  wideMultiplier: 1.7,
  laserCooldown: 0.3,
} as const

export const BRICK = {
  sidePadding: 3,
  gap: 0.7,
  height: 2.4,
  depth: 1.8,
  topOffset: 4.2,
  toughHits: 3,
  /** Brick rows may never reach below this Y, or they would crowd the paddle. */
  zoneBottom: -FIELD.halfHeight / 4,
} as const

export const PHYSICS = {
  fixedStep: 1 / 120,
  maxFrameDelta: 0.2,
} as const

export const SCORING = {
  points: { normal: 50, tough: 180, explosive: 90, indestructible: 0 },
  comboStep: 4,
  maxMultiplier: 6,
  startLives: 3,
  maxLives: 6,
} as const

export const POWER_UPS = {
  fallSpeed: 13,
  poolSize: 10,
  /** Default drop rate for levels that do not override it. */
  dropChance: 0.2,
  weights: { wide: 25, multi: 18, slow: 14, fast: 10, laser: 23, life: 10 } as const,
  durations: { wide: 14, slow: 12, fast: 10, laser: 9 } as const,
  slowFactor: 0.7,
  fastFactor: 1.45,
  laserBoltSpeed: 62,
  laserPoolSize: 16,
} as const

export const EXPLOSION = {
  radius: 6.5,
} as const

/**
 * Visual tuning for the papercraft renderer. Every value below is consumed by
 * `src/rendering`; gameplay never reads this block.
 */
export const RENDER = {
  maxPixelRatio: 2,
  camera: { fov: 42, margin: 1.32, tilt: 2.4, dolly: 0.16 },
  // Gentle bloom only lifts the brightest paper highlights (keeps the craft look).
  bloom: { strength: 0.35, radius: 0.5, threshold: 0.92 },
  vignette: 0.34,
  grain: 0.045,
  shake: { maxTrauma: 1, decay: 1.9, offset: 0.9, roll: 0.035 },
  /** Z planes per gameplay layer; keeps depth sorting obvious and readable. */
  depth: {
    panel: -2.6,
    brick: 0,
    paddle: 2.6,
    ball: 2.6,
    drop: 3.4,
    confetti: 3.8,
    trail: 2.2,
    guide: 2.8,
  },
  /** Three stacked boxes per brick: ink casing, paper frame, tinted body. */
  brickLayers: {
    ink: { x: 1.12, y: 1.16, z: -0.45 },
    paper: { x: 1, y: 1, z: 0 },
    body: { x: 0.88, y: 0.84, z: 0.5 },
  },
  brickHit: { duration: 0.25, pop: 0.55, squash: 0.2, flash: 0.65 },
  brickDeath: { duration: 0.34, spin: 6, lift: 3.5, gravity: 22, shrink: 0.15 },
  paddleLayers: {
    ink: { x: 1.06, y: 1.34, z: -0.2 },
    paper: { x: 1, y: 1.06, z: 0 },
    body: { x: 0.94, y: 0.8, z: 0.32 },
  },
  paddlePulse: { duration: 0.25, amount: 0.24 },
  /** Inverted-hull outline factor for round actors (balls, paddle cannons). */
  outlineScale: { actor: 1.14 },
  confettiCapacity: 600,
  confetti: { life: 1.05, spread: 15, rise: 11, gravity: 30, spin: 8, size: 0.62 },
  trail: { length: 22, spacing: 0.45, size: 2.3, color: '#fff2c4' },
  ballLight: { intensity: 45, distance: 34, color: '#fff1c9' },
  waves: { capacity: 4, duration: 0.45, maxRadius: 9 },
  background: { cloudCount: 7, floaterCount: 5, boxCount: 8, bobAmplitude: 0.9 },
  card: { size: 3.6, bob: 0.55, spin: 1.3 },
  levelIntro: { duration: 0.9, scaleFrom: 0.86, tilt: 0.05 },
  guide: { width: 0.7, alpha: 0.5 },
} as const

/**
 * Rendering quality presets. Mobile devices get `low` (no antialias, no bloom
 * and a tighter pixel-ratio cap) so the frame rate stays steady on phone GPUs;
 * tablets and desktops render with `high`. Gameplay tuning is identical.
 */
export const QUALITY = {
  high: { maxPixelRatio: RENDER.maxPixelRatio, antialias: true, bloom: true },
  low: { maxPixelRatio: 1.5, antialias: false, bloom: false },
} as const

export type QualityConfig = (typeof QUALITY)[keyof typeof QUALITY]
