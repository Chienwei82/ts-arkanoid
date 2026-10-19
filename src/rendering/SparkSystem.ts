import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  type Texture,
} from 'three'
import { RENDER } from '../config/gameConfig'

const GRAVITY = RENDER.sparks.gravity
const SIZE = RENDER.sparks.size
const SPEED = RENDER.sparks.speed
const LIFE = RENDER.sparks.life
const HIDDEN_SCALE = 0.0001

interface Spark {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  life: number
  r: number
  g: number
  b: number
}

/**
 * Additive impact sparks for brick hits, pickups and laser shots. A fixed pool
 * of points drawn in a single `Points` call; sparks recycle from a free stack so
 * the render loop never allocates and only touches the sparks still in flight.
 */
export class SparkSystem {
  private readonly mesh: Points
  private readonly material: PointsMaterial
  private readonly geometry: BufferGeometry
  private readonly positions: Float32Array
  private readonly colours: Float32Array
  private readonly sizes: Float32Array
  private readonly sparks: Spark[]
  private readonly freeSlots: number[]
  private readonly activeSlots: number[] = []

  private readonly colour = new Color()
  private colourDirty = false

  constructor(map: Texture) {
    const capacity = RENDER.sparks.capacity
    this.positions = new Float32Array(capacity * 3)
    this.colours = new Float32Array(capacity * 3)
    this.sizes = new Float32Array(capacity)
    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new BufferAttribute(this.colours, 3))
    this.geometry.setAttribute('size', new BufferAttribute(this.sizes, 1))
    this.geometry.setDrawRange(0, 0)

    this.material = new PointsMaterial({
      map,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    })
    this.mesh = new Points(this.geometry, this.material)
    this.mesh.frustumCulled = false

    this.sparks = Array.from({ length: capacity }, () => ({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, life: 0, r: 1, g: 1, b: 1,
    }))
    this.freeSlots = Array.from({ length: capacity }, (_, i) => capacity - 1 - i)
    for (let slot = 0; slot < capacity; slot += 1) this.hide(slot)
  }

  get object(): Points {
    return this.mesh
  }

  /** Emit a burst of sparks at a world point, tinted by colour. */
  burst(x: number, y: number, z: number, colour: number, count: number): void {
    this.colour.setHex(colour)
    for (let i = 0; i < count; i += 1) this.spawn(x, y, z, this.colour.r, this.colour.g, this.colour.b)
  }

  update(dt: number): void {
    if (this.activeSlots.length === 0) {
      if (this.colourDirty) this.flushColours()
      return
    }
    let live = 0
    for (let i = 0; i < this.activeSlots.length; i += 1) {
      const slot = this.activeSlots[i]
      const spark = this.sparks[slot]
      spark.life -= dt
      if (spark.life <= 0) {
        this.hide(slot)
        this.freeSlots.push(slot)
        continue
      }
      spark.vy -= GRAVITY * dt
      spark.x += spark.vx * dt
      spark.y += spark.vy * dt
      spark.z += spark.vz * dt
      this.activeSlots[live] = slot
      live += 1
    }
    this.activeSlots.length = live
    this.write()
    this.mesh.geometry.attributes.position.needsUpdate = true
    this.mesh.geometry.attributes.color.needsUpdate = true
    this.mesh.geometry.attributes.size.needsUpdate = true
    if (this.colourDirty) this.flushColours()
  }

  clear(): void {
    for (const slot of this.activeSlots) {
      this.hide(slot)
      this.freeSlots.push(slot)
    }
    this.activeSlots.length = 0
    this.geometry.setDrawRange(0, 0)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }

  private spawn(x: number, y: number, z: number, r: number, g: number, b: number): void {
    const slot = this.freeSlots.pop()
    if (slot === undefined) return
    const spark = this.sparks[slot]
    const angle = Math.random() * Math.PI * 2
    const speed = SPEED * (0.4 + Math.random() * 1.2)
    spark.x = x
    spark.y = y
    spark.z = z
    spark.vx = Math.cos(angle) * speed
    spark.vy = (Math.random() * 0.6 + 0.4) * speed * 1.4
    spark.vz = (Math.random() - 0.5) * speed * 0.6
    spark.size = SIZE * (0.6 + Math.random() * 0.8)
    spark.life = LIFE * (0.6 + Math.random() * 0.8)
    spark.r = r
    spark.g = g
    spark.b = b
    this.activeSlots.push(slot)
  }

  private hide(slot: number): void {
    this.positions[slot * 3] = 0
    this.positions[slot * 3 + 1] = 0
    this.positions[slot * 3 + 2] = HIDDEN_SCALE
    this.colours[slot * 3] = 0
    this.colours[slot * 3 + 1] = 0
    this.colours[slot * 3 + 2] = 0
    this.sizes[slot] = HIDDEN_SCALE
  }

  private write(): void {
    for (let i = 0; i < this.activeSlots.length; i += 1) {
      const slot = this.activeSlots[i]
      const spark = this.sparks[slot]
      const fade = spark.life / LIFE
      const target = slot * 3
      this.positions[target] = spark.x
      this.positions[target + 1] = spark.y
      this.positions[target + 2] = spark.z
      this.colours[target] = spark.r * fade
      this.colours[target + 1] = spark.g * fade
      this.colours[target + 2] = spark.b * fade
      this.sizes[slot] = spark.size * fade
    }
    this.geometry.setDrawRange(0, this.activeSlots.length)
  }

  private flushColours(): void {
    this.colourDirty = false
  }
}
