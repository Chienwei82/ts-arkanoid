import {
  AdditiveBlending,
  CanvasTexture,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three'
import { RENDER } from '../config/gameConfig'

/** Canvas the label is painted on; wide enough for "NIVEL 4 · NÚCLEO". */
const CANVAS = { width: 640, height: 120 }
const CANVAS_ASPECT = CANVAS.width / CANVAS.height

/**
 * The big arcade card ("NIVEL 2 · FORTÍN") that pops over the field while a
 * fresh level settles in. One pooled sprite; textures are painted once per
 * text + colour combination and cached per instance, so the frame loop only
 * nudges scale and opacity — it never paints.
 */
export class LevelTitleCard {
  private readonly sprite: Sprite
  private readonly material: SpriteMaterial
  private readonly cache = new Map<string, Texture>()
  private clock = 0
  private active = false
  private aspect = CANVAS_ASPECT
  private motionScale = 1

  constructor() {
    this.material = new SpriteMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    this.sprite = new Sprite(this.material)
    this.sprite.visible = false
    this.sprite.position.set(0, RENDER.titleCard.y, RENDER.titleCard.z)
    // The first paint may happen before Fredoka finishes loading; drop the
    // cache once fonts settle so the card re-renders with the arcade typeface.
    document.fonts?.ready
      .then(() => {
        this.clearCache()
      })
      .catch(() => {})
  }

  get object(): Sprite {
    return this.sprite
  }

  /** Pops the card with a fresh label, restarting its whole lifecycle. */
  show(text: string, colour: number): void {
    const texture = this.textureFor(text, colour)
    this.material.map = texture
    this.material.needsUpdate = true
    const image = texture.image as { width?: number; height?: number }
    this.aspect =
      typeof image.width === 'number' && typeof image.height === 'number' && image.height > 0
        ? image.width / image.height
        : CANVAS_ASPECT
    this.clock = 0
    this.active = true
    this.sprite.visible = true
    this.update(0)
  }

  /** Reduced motion keeps the pop frozen; the opacity fades survive. */
  setMotionScale(scale: number): void {
    this.motionScale = scale
  }

  /** Advances the pop-in and the fade-out; safe to call every frame. */
  update(dt: number): void {
    if (!this.active) return
    this.clock += dt
    const config = RENDER.titleCard
    if (this.clock >= config.life) {
      this.hide()
      return
    }
    const edge = Math.min(this.clock, config.life - this.clock)
    this.material.opacity = config.opacity * Math.min(1, edge / config.fadeTime)
    const popEnv = Math.max(0, 1 - this.clock / (config.life * 0.3))
    const pop = 1 + config.pop * Math.sin(this.clock * config.popSpeed) * popEnv * this.motionScale
    this.sprite.scale.set(config.width * pop, (config.width / this.aspect) * pop, 1)
  }

  hide(): void {
    this.active = false
    this.sprite.visible = false
  }

  dispose(): void {
    this.hide()
    this.clearCache()
    this.material.dispose()
    this.sprite.removeFromParent()
  }

  /** Paints the label once per text + colour pair (jsdom-safe: null ctx skips). */
  private textureFor(text: string, colour: number): Texture {
    const key = `${text}:${colour}`
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    const canvas = document.createElement('canvas')
    canvas.width = CANVAS.width
    canvas.height = CANVAS.height
    const ctx = canvas.getContext('2d')
    if (ctx !== null) {
      const hex = `#${colour.toString(16).padStart(6, '0')}`
      ctx.font = 'bold 58px Fredoka, Trebuchet MS, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Soft halo first so the glyphs read against any sky.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
      ctx.shadowBlur = 12
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
      ctx.shadowBlur = 0
      ctx.fillStyle = hex
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    this.cache.set(key, texture)
    return texture
  }

  private clearCache(): void {
    for (const texture of this.cache.values()) texture.dispose()
    this.cache.clear()
  }
}
