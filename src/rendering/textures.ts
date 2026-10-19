import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { PALETTE } from '../config/palette'
import type { PowerUpType } from '../entities/types'
import type { BrickMaterial } from './brickMaterial'

/**
 * Every texture is painted on a canvas at start-up: the space-arcade look
 * needs nebula gradients, hull speckles and neon sticker-like icons, and
 * generating them once is far cheaper than shipping images (and keeps the
 * bundle tiny).
 */

const SKY_SIZE = 256
const FIBER_SIZE = 128
const GLOW_SIZE = 128
const ICON_SIZE = 128
const CHECKER_SIZE = 128
const DASH_SIZE = 64

const createCanvas = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

type Repeat = readonly [number, number]

const toTexture = (canvas: HTMLCanvasElement, repeat: Repeat | null): CanvasTexture => {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 2
  if (repeat !== null) {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
  }
  return texture
}

/** Deep-space gradient with magenta/cyan nebula blobs standing in for the sky. */
const paintSky = (): CanvasTexture => {
  const canvas = createCanvas(SKY_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SKY_SIZE)
    gradient.addColorStop(0, PALETTE.skyTop)
    gradient.addColorStop(0.46, PALETTE.skyMid)
    gradient.addColorStop(0.78, PALETTE.skyHorizon)
    gradient.addColorStop(1, PALETTE.skyHorizon)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, SKY_SIZE, SKY_SIZE)
    const blobs: readonly (readonly [number, number, number, string])[] = [
      [70, 90, 90, 'rgba(160, 107, 255, 0.24)'],
      [190, 160, 70, 'rgba(63, 216, 224, 0.2)'],
      [130, 200, 60, 'rgba(255, 61, 240, 0.12)'],
    ]
    for (const [x, y, radius, colour] of blobs) {
      const blob = ctx.createRadialGradient(x, y, 0, x, y, radius)
      blob.addColorStop(0, colour)
      blob.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = blob
      ctx.fillRect(0, 0, SKY_SIZE, SKY_SIZE)
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    for (let i = 0; i < 90; i += 1) {
      const size = Math.random() < 0.12 ? 2 : 1
      ctx.fillRect(Math.random() * SKY_SIZE, Math.random() * SKY_SIZE, size, size)
    }
  }
  return toTexture(canvas, null)
}

/** Brushed hull noise: barely visible, but it sells the "painted starship" look. */
const paintFiber = (repeat: Repeat): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#0e1533'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    for (let i = 0; i < 900; i += 1) {
      const dark = Math.random() > 0.55
      ctx.fillStyle = dark ? 'rgba(4, 8, 26, 0.16)' : 'rgba(125, 249, 255, 0.08)'
      ctx.fillRect(
        Math.random() * FIBER_SIZE,
        Math.random() * FIBER_SIZE,
        Math.random() * 3 + 0.6,
        Math.random() * 1.4 + 0.4,
      )
    }
  }
  return toTexture(canvas, repeat)
}

/** Radial falloff used for trail sprites, engine glow and the planet disc. */
const paintGlow = (): CanvasTexture => {
  const canvas = createCanvas(GLOW_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const half = GLOW_SIZE / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.35, 'rgba(125, 249, 255, 0.6)')
    gradient.addColorStop(1, 'rgba(125, 249, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE)
  }
  return toTexture(canvas, null)
}

/** Dashed strip for the launch guide; repeats along the guide's length. */
const paintDash = (): CanvasTexture => {
  const canvas = createCanvas(DASH_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createLinearGradient(0, 0, DASH_SIZE, 0)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    const dashes = 4
    const dashHeight = DASH_SIZE / (dashes * 2)
    for (let i = 0; i < dashes; i += 1) {
      ctx.fillRect(0, i * dashHeight * 2, DASH_SIZE, dashHeight)
    }
  }
  return toTexture(canvas, [1, 5])
}

/** Neon chequerboard for the docking platforms: dark hull with cyan inlay. */
const paintChecker = (): CanvasTexture => {
  const canvas = createCanvas(CHECKER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const half = CHECKER_SIZE / 2
    ctx.fillStyle = '#0b1230'
    ctx.fillRect(0, 0, CHECKER_SIZE, CHECKER_SIZE)
    ctx.fillStyle = 'rgba(53, 196, 255, 0.85)'
    ctx.fillRect(0, 0, half, half)
    ctx.fillRect(half, half, half, half)
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.5)'
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, CHECKER_SIZE - 3, CHECKER_SIZE - 3)
  }
  return toTexture(canvas, [1, 1])
}

/** Station-core plating: bright grains, panel seams and energy cracks. */
const paintConcrete = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#dbe1f4'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 55, 120, 0.16)' : 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(
        Math.random() * FIBER_SIZE,
        Math.random() * FIBER_SIZE,
        Math.random() * 3 + 0.5,
        Math.random() * 3 + 0.5,
      )
    }
    // Luminous top edge + dark seams keep the core readable at distance.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.fillRect(0, 0, FIBER_SIZE, 8)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 5
    ctx.strokeRect(3, 3, FIBER_SIZE - 6, FIBER_SIZE - 6)
    ctx.strokeStyle = 'rgba(35, 55, 130, 0.55)'
    ctx.lineWidth = 2
    for (let crack = 0; crack < 3; crack += 1) {
      let x = Math.random() * FIBER_SIZE
      let y = Math.random() * FIBER_SIZE
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let segment = 0; segment < 4; segment += 1) {
        x += (Math.random() - 0.5) * 30
        y += (Math.random() - 0.5) * 30
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  return toTexture(canvas, [1, 1])
}

/** Hull plating: bright alloy with seams so instance tints stay vivid. */
const paintPlanks = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#c9d4f5'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    const planks = 3
    const step = FIBER_SIZE / planks
    // Soft vertical shading per plank for volume.
    for (let p = 0; p < planks; p += 1) {
      const shade = ctx.createLinearGradient(0, p * step, 0, (p + 1) * step)
      shade.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
      shade.addColorStop(1, 'rgba(20, 30, 80, 0.22)')
      ctx.fillStyle = shade
      ctx.fillRect(0, p * step, FIBER_SIZE, step)
    }
    ctx.strokeStyle = 'rgba(10, 16, 50, 0.55)'
    ctx.lineWidth = 4
    for (let i = 1; i < planks; i += 1) {
      ctx.beginPath()
      ctx.moveTo(0, i * step)
      ctx.lineTo(FIBER_SIZE, i * step)
      ctx.stroke()
    }
    // Neon top bevel: catches the eye even at a distance.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.fillRect(0, 0, FIBER_SIZE, 7)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 5
    ctx.strokeRect(3, 3, FIBER_SIZE - 6, FIBER_SIZE - 6)
    ctx.strokeStyle = 'rgba(90, 140, 255, 0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i < 26; i += 1) {
      const x = Math.random() * FIBER_SIZE
      const y = Math.random() * FIBER_SIZE
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 12 + Math.random() * 26, y + (Math.random() - 0.5) * 3)
      ctx.stroke()
    }
  }
  return toTexture(canvas, [1, 1])
}

/** Shielded armour: bright plating, energy border and corner bolts. */
const paintMetalPanel = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#d5dcf2'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    ctx.strokeStyle = 'rgba(40, 60, 130, 0.25)'
    ctx.lineWidth = 1
    for (let i = 0; i < 60; i += 1) {
      const y = Math.random() * FIBER_SIZE
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(FIBER_SIZE, y + (Math.random() - 0.5) * 2)
      ctx.stroke()
    }
    // Bright inset frame so tough bricks read as armoured shells.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.fillRect(0, 0, FIBER_SIZE, 10)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 6
    ctx.strokeRect(7, 7, FIBER_SIZE - 14, FIBER_SIZE - 14)
    ctx.strokeStyle = 'rgba(30, 50, 120, 0.6)'
    ctx.lineWidth = 3
    ctx.strokeRect(14, 14, FIBER_SIZE - 28, FIBER_SIZE - 28)
    ctx.fillStyle = 'rgba(30, 50, 120, 0.9)'
    const rivets: readonly (readonly [number, number])[] = [
      [20, 20],
      [FIBER_SIZE - 20, 20],
      [20, FIBER_SIZE - 20],
      [FIBER_SIZE - 20, FIBER_SIZE - 20],
    ]
    for (const [x, y] of rivets) {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.beginPath()
      ctx.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(30, 50, 120, 0.9)'
    }
  }
  return toTexture(canvas, [1, 1])
}

/** Reactor cell: bright hull with glowing chevrons (volatile cargo). */
const paintHazard = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#f3c8b8'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    // Bright chevron bands alternate with the instance tint.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    const step = 32
    for (let x = -FIBER_SIZE; x < FIBER_SIZE * 2; x += step * 2) {
      ctx.beginPath()
      ctx.moveTo(x, FIBER_SIZE)
      ctx.lineTo(x + FIBER_SIZE / 2, 0)
      ctx.lineTo(x + FIBER_SIZE / 2 + 16, 0)
      ctx.lineTo(x + 16, FIBER_SIZE)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(120, 20, 20, 0.55)'
    ctx.lineWidth = 4
    for (let x = -FIBER_SIZE; x < FIBER_SIZE * 2; x += step * 2) {
      ctx.beginPath()
      ctx.moveTo(x, FIBER_SIZE)
      ctx.lineTo(x + FIBER_SIZE, 0)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, FIBER_SIZE - 6, FIBER_SIZE - 6)
  }
  return toTexture(canvas, [1, 1])
}

/** Docking porthole: a glowing viewport with a neon cross and outer hull ring. */
const paintWindow = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIBER_SIZE)
    gradient.addColorStop(0, 'rgba(125, 249, 255, 1)')
    gradient.addColorStop(1, 'rgba(29, 52, 120, 1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    ctx.strokeStyle = 'rgba(4, 8, 26, 0.85)'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(FIBER_SIZE / 2, 0)
    ctx.lineTo(FIBER_SIZE / 2, FIBER_SIZE)
    ctx.moveTo(0, FIBER_SIZE / 2)
    ctx.lineTo(FIBER_SIZE, FIBER_SIZE / 2)
    ctx.stroke()
    ctx.lineWidth = 12
    ctx.strokeRect(0, 0, FIBER_SIZE, FIBER_SIZE)
  }
  return toTexture(canvas, [1, 1])
}

/** Every painted brick-material detail, keyed by the material family. */
const paintBrickMaterials = (): Readonly<Record<BrickMaterial, CanvasTexture>> => ({
  wood: paintPlanks(),
  metal: paintMetalPanel(),
  concrete: paintConcrete(),
  explosive: paintHazard(),
})

/** Neon capsule badge: colour fill, dark halo, thin ion rim. */
const paintIcon = (
  colour: string,
  path: (ctx: CanvasRenderingContext2D) => void,
): CanvasTexture => {
  const canvas = createCanvas(ICON_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    path(ctx)
    ctx.fillStyle = colour
    ctx.fill()
    ctx.lineWidth = 14
    ctx.strokeStyle = PALETTE.paper
    ctx.stroke()
    ctx.lineWidth = 5
    ctx.strokeStyle = PALETTE.ink
    ctx.stroke()
  }
  return toTexture(canvas, null)
}

/** Adds a rounded bar as its own subpath (never resets the shared path). */
const roundedBar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const r = height / 2
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

const paintIcons = (): Readonly<Record<PowerUpType, CanvasTexture>> => ({
  wide: paintIcon(PALETTE.powerUp.wide, (ctx) => {
    roundedBar(ctx, 16, 70, 96, 30)
    ctx.moveTo(14, 40)
    ctx.lineTo(38, 24)
    ctx.lineTo(38, 56)
    ctx.closePath()
    ctx.moveTo(114, 40)
    ctx.lineTo(90, 24)
    ctx.lineTo(90, 56)
    ctx.closePath()
  }),
  multi: paintIcon(PALETTE.powerUp.multi, (ctx) => {
    const dots: readonly (readonly [number, number])[] = [
      [64, 30],
      [34, 86],
      [94, 86],
    ]
    for (const [x, y] of dots) {
      ctx.moveTo(x + 24, y)
      ctx.arc(x, y, 24, 0, Math.PI * 2)
    }
  }),
  slow: paintIcon(PALETTE.powerUp.slow, (ctx) => {
    ctx.arc(64, 64, 44, 0, Math.PI * 2)
    ctx.moveTo(64, 64)
    ctx.lineTo(64, 32)
    ctx.moveTo(64, 64)
    ctx.lineTo(90, 78)
  }),
  fast: paintIcon(PALETTE.powerUp.fast, (ctx) => {
    ctx.moveTo(74, 10)
    ctx.lineTo(34, 70)
    ctx.lineTo(60, 74)
    ctx.lineTo(50, 118)
    ctx.lineTo(94, 56)
    ctx.lineTo(66, 50)
    ctx.closePath()
  }),
  laser: paintIcon(PALETTE.powerUp.laser, (ctx) => {
    roundedBar(ctx, 56, 44, 16, 74)
    ctx.moveTo(64, 8)
    ctx.lineTo(84, 44)
    ctx.lineTo(44, 44)
    ctx.closePath()
    roundedBar(ctx, 20, 96, 24, 12)
    roundedBar(ctx, 84, 96, 24, 12)
  }),
  life: paintIcon(PALETTE.powerUp.life, (ctx) => {
    ctx.moveTo(64, 112)
    ctx.bezierCurveTo(10, 74, 20, 22, 50, 22)
    ctx.bezierCurveTo(60, 22, 64, 32, 64, 38)
    ctx.bezierCurveTo(64, 32, 68, 22, 78, 22)
    ctx.bezierCurveTo(108, 22, 118, 74, 64, 112)
    ctx.closePath()
  }),
  powerBall: paintIcon(PALETTE.powerUp.powerBall, (ctx) => {
    ctx.moveTo(64, 10)
    ctx.lineTo(106, 64)
    ctx.lineTo(64, 118)
    ctx.lineTo(22, 64)
    ctx.closePath()
  }),
})

/** All textures one renderer instance needs, owned and disposed as a unit. */
export class CraftTextures {
  readonly sky: CanvasTexture
  readonly glow: CanvasTexture
  readonly dash: CanvasTexture
  readonly checker: CanvasTexture
  readonly brickPaper: CanvasTexture
  readonly panelPaper: CanvasTexture
  readonly cardPaper: CanvasTexture
  readonly cardIcons: Readonly<Record<PowerUpType, CanvasTexture>>
  readonly brickMaterials: Readonly<Record<BrickMaterial, CanvasTexture>>
  readonly windowGlass: CanvasTexture

  constructor() {
    this.sky = paintSky()
    this.glow = paintGlow()
    this.dash = paintDash()
    this.checker = paintChecker()
    this.brickPaper = paintFiber([3, 1.4])
    this.panelPaper = paintFiber([7, 5])
    this.cardPaper = paintFiber([2, 2])
    this.cardIcons = paintIcons()
    this.brickMaterials = paintBrickMaterials()
    this.windowGlass = paintWindow()
  }

  dispose(): void {
    const all: Texture[] = [
      this.sky,
      this.glow,
      this.dash,
      this.checker,
      this.brickPaper,
      this.panelPaper,
      this.cardPaper,
      ...Object.values(this.cardIcons),
      ...Object.values(this.brickMaterials),
      this.windowGlass,
    ]
    for (const texture of all) texture.dispose()
  }
}
