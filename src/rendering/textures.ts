import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { PALETTE } from '../config/palette'
import type { PowerUpType } from '../entities/types'
import type { BrickMaterial } from './brickMaterial'

/**
 * Every texture is painted on a canvas at start-up: the papercraft look needs
 * fibre speckles and sticker-like icons, and generating them once is far
 * cheaper than shipping images (and keeps the bundle tiny).
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

/** Soft vertical gradient standing in for the illustration sky. */
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
  }
  return toTexture(canvas, null)
}

/** Paper fibre noise: barely visible, but it sells the "printed on card" look. */
const paintFiber = (repeat: Repeat): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#fffdf7'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    for (let i = 0; i < 900; i += 1) {
      const dark = Math.random() > 0.55
      ctx.fillStyle = dark ? 'rgba(58, 36, 23, 0.045)' : 'rgba(255, 255, 255, 0.65)'
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

/** Radial falloff used for the trail sprites and the sun disc. */
const paintGlow = (): CanvasTexture => {
  const canvas = createCanvas(GLOW_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const half = GLOW_SIZE / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.35, 'rgba(255, 246, 214, 0.55)')
    gradient.addColorStop(1, 'rgba(255, 246, 214, 0)')
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

/** Red/cream chequerboard for the floating board platforms. */
const paintChecker = (): CanvasTexture => {
  const canvas = createCanvas(CHECKER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const half = CHECKER_SIZE / 2
    ctx.fillStyle = PALETTE.paper
    ctx.fillRect(0, 0, CHECKER_SIZE, CHECKER_SIZE)
    ctx.fillStyle = PALETTE.checkerRed
    ctx.fillRect(0, 0, half, half)
    ctx.fillRect(half, half, half, half)
  }
  return toTexture(canvas, [1, 1])
}

/** Random speckle used by concrete: light and dark grains plus a few cracks. */
const paintConcrete = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#f6f4ef'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90, 90, 90, 0.1)' : 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(
        Math.random() * FIBER_SIZE,
        Math.random() * FIBER_SIZE,
        Math.random() * 3 + 0.5,
        Math.random() * 3 + 0.5,
      )
    }
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.4)'
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

/** Wooden crate: three planks with seams and a light grain streak pass. */
const paintPlanks = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#fdf6ea'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    const planks = 3
    const step = FIBER_SIZE / planks
    ctx.strokeStyle = 'rgba(74, 48, 30, 0.42)'
    ctx.lineWidth = 3
    for (let i = 1; i < planks; i += 1) {
      ctx.beginPath()
      ctx.moveTo(0, i * step)
      ctx.lineTo(FIBER_SIZE, i * step)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(120, 84, 52, 0.18)'
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

/** Sheet metal: brushed streaks, an inset panel border and four rivets. */
const paintMetalPanel = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#f4f6f8'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    ctx.strokeStyle = 'rgba(148, 162, 178, 0.22)'
    ctx.lineWidth = 1
    for (let i = 0; i < 60; i += 1) {
      const y = Math.random() * FIBER_SIZE
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(FIBER_SIZE, y + (Math.random() - 0.5) * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(58, 36, 23, 0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(10, 10, FIBER_SIZE - 20, FIBER_SIZE - 20)
    ctx.fillStyle = 'rgba(58, 36, 23, 0.5)'
    const rivets: readonly (readonly [number, number])[] = [
      [18, 18],
      [FIBER_SIZE - 18, 18],
      [18, FIBER_SIZE - 18],
      [FIBER_SIZE - 18, FIBER_SIZE - 18],
    ]
    for (const [x, y] of rivets) {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return toTexture(canvas, [1, 1])
}

/** Hazard crate: diagonal dark stripes over a near-white base (TNT-style). */
const paintHazard = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = '#fdf6ea'
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    ctx.strokeStyle = 'rgba(58, 36, 23, 0.5)'
    ctx.lineWidth = 12
    const step = 30
    for (let x = -FIBER_SIZE; x < FIBER_SIZE * 2; x += step * 2) {
      ctx.beginPath()
      ctx.moveTo(x, FIBER_SIZE)
      ctx.lineTo(x + FIBER_SIZE, 0)
      ctx.stroke()
    }
  }
  return toTexture(canvas, [1, 1])
}

/** Window pane: a glass gradient with an ink mullion cross and outer frame. */
const paintWindow = (): CanvasTexture => {
  const canvas = createCanvas(FIBER_SIZE)
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIBER_SIZE)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(1, 'rgba(198, 212, 234, 1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, FIBER_SIZE, FIBER_SIZE)
    ctx.strokeStyle = 'rgba(58, 36, 23, 0.5)'
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

/** Sticker recipe: colour fill, thick paper halo, thin ink border. */
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
