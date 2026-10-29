import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Texture,
} from 'three'

/** How long a floating label survives. */
const LABEL_LIFE = 0.9
/** World units per second the label rises. */
const LABEL_RISE_SPEED = 5
/** World units the label starts above the brick. */
const LABEL_START_OFFSET = 0.4
/** Max sprites alive at once — keeps the pool bounded. */
const MAX_LABELS = 32
/** Scale of the sprite quad in world units. */
const LABEL_SCALE_X = 2.8
const LABEL_SCALE_Y = 1.0
/** Opacity of the floating label. */
const LABEL_OPACITY = 0.85

/** Cached canvas textures keyed by point value + colour, so we never paint
 *  the same number twice. */
const textureCache = new Map<string, Texture>()

/** Renders a point value onto a small transparent canvas and returns a texture. */
const scoreTexture = (points: number, color: number): Texture => {
  const key = `${points}:${color}`
  const cached = textureCache.get(key)
  if (cached !== undefined) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 28
  const ctx = canvas.getContext('2d')
  if (ctx !== null) {
    const hex = `#${color.toString(16).padStart(6, '0')}`
    ctx.font = 'bold 16px Fredoka, Trebuchet MS, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // White glow outline for readability against any background.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 4
    ctx.fillText(`+${points}`, canvas.width / 2, canvas.height / 2)
    // Main glyph in the brick's colour.
    ctx.fillStyle = hex
    ctx.shadowBlur = 0
    ctx.fillText(`+${points}`, canvas.width / 2 - 1, canvas.height / 2)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  textureCache.set(key, texture)
  return texture
}

interface FloatingLabel {
  sprite: Sprite
  life: number
}

/**
 * Floating "+50" / "+180" score labels that pop above destroyed bricks.
 * Uses a tiny pool of Sprite objects with cached textures so the hot path
 * never allocates GPU resources after warm-up.
 */
export class FloatingScoreSystem {
  private readonly root = new Group()
  private readonly pool: Sprite[] = []
  private readonly active: FloatingLabel[] = []

  get object(): Group {
    return this.root
  }

  spawn(x: number, y: number, points: number, color: number): void {
    if (this.active.length >= MAX_LABELS) return
    let sprite = this.pool.pop()
    if (sprite === undefined) {
      const material = new SpriteMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
      })
      sprite = new Sprite(material)
      this.root.add(sprite)
    }
    const spriteMaterial = sprite.material
    spriteMaterial.map = scoreTexture(points, color)
    spriteMaterial.needsUpdate = true
    spriteMaterial.color.set(1, 1, 1)

    sprite.position.set(x, y + LABEL_START_OFFSET, 0)
    sprite.scale.set(LABEL_SCALE_X * 1.4, LABEL_SCALE_Y * 1.4, 1)
    sprite.material.opacity = LABEL_OPACITY
    sprite.visible = true

    this.active.push({ sprite, life: LABEL_LIFE })
  }

  update(dt: number): void {
    if (this.active.length === 0) return
    let live = 0
    for (let i = 0; i < this.active.length; i += 1) {
      const label = this.active[i]
      label.life -= dt
      if (label.life <= 0) {
        this.pool.push(label.sprite)
        label.sprite.visible = false
        continue
      }
      label.sprite.position.y += LABEL_RISE_SPEED * dt
      // Fade in for the first 15%, hold, then fade out over the last 25%.
      const fadeStart = 0.15 * LABEL_LIFE
      const fadeEnd = 0.25 * LABEL_LIFE
      let alpha = 1
      if (label.life < fadeEnd) alpha = label.life / fadeEnd
      else if (LABEL_LIFE - label.life < fadeStart) alpha = (LABEL_LIFE - label.life) / fadeStart
      label.sprite.material.opacity = LABEL_OPACITY * alpha
      this.active[live] = label
      live += 1
    }
    this.active.length = live
  }

  clear(): void {
    for (const label of this.active) {
      this.pool.push(label.sprite)
      label.sprite.visible = false
    }
    this.active.length = 0
  }

  dispose(): void {
    for (const sprite of this.pool) {
      const material = sprite.material
      material.dispose()
      this.root.remove(sprite)
    }
    this.pool.length = 0
    for (const label of this.active) {
      this.pool.push(label.sprite)
      label.sprite.visible = false
    }
    this.active.length = 0
    for (const texture of textureCache.values()) texture.dispose()
    textureCache.clear()
  }
}
