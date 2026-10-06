import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { PALETTE } from '../config/palette'
import type { PowerUpType } from '../entities/types'

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

  constructor() {
    this.sky = paintSky()
    this.glow = paintGlow()
    this.dash = paintDash()
    this.checker = paintChecker()
    this.brickPaper = paintFiber([3, 1.4])
    this.panelPaper = paintFiber([7, 5])
    this.cardPaper = paintFiber([2, 2])
    this.cardIcons = paintIcons()
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
    ]
    for (const texture of all) texture.dispose()
  }
}
