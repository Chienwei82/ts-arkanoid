import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  PointsMaterial,
  type Texture,
} from 'three'
import { RENDER } from '../config/gameConfig'
import { hexToInt } from '../utils/math'

const SPACING_SQUARED = RENDER.trail.spacing * RENDER.trail.spacing
/** Seconds between dropped samples while the ball is gone. */
const DRAIN_STEP = 0.05
const INTENSITY_FALLOFF = 1.4

/**
 * Luminous ribbon behind the primary ball: a single Points draw call with
 * vertex colours (additive blending turns colour magnitude into glow), driven
 * by a fixed-size ring buffer of samples so nothing is allocated per frame.
 */
export class BallTrail {
  private readonly geometry: BufferGeometry
  private readonly material: PointsMaterial
  private readonly points: Points
  private readonly positions: Float32Array
  private readonly colours: Float32Array
  private readonly samples: Float32Array
  private readonly positionAttribute: BufferAttribute
  private readonly colourAttribute: BufferAttribute
  private readonly baseColour = new Color(hexToInt(RENDER.trail.color))

  private head = -1
  private count = 0
  private drain = 0

  constructor(map: Texture) {
    const length = RENDER.trail.length
    this.positions = new Float32Array(length * 3)
    this.colours = new Float32Array(length * 3)
    this.samples = new Float32Array(length * 2)
    this.positionAttribute = new BufferAttribute(this.positions, 3)
    this.colourAttribute = new BufferAttribute(this.colours, 3)
    this.positionAttribute.setUsage(DynamicDrawUsage)
    this.colourAttribute.setUsage(DynamicDrawUsage)

    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', this.positionAttribute)
    this.geometry.setAttribute('color', this.colourAttribute)
    this.geometry.setDrawRange(0, 0)

    this.material = new PointsMaterial({
      size: RENDER.trail.size,
      map,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
      vertexColors: true,
    })
    this.points = new Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  get object(): Points {
    return this.points
  }

  /** Adds a sample once the ball has travelled one spacing unit. */
  follow(x: number, y: number): void {
    const length = RENDER.trail.length
    if (this.count > 0) {
      const dx = x - this.samples[this.head * 2]
      const dy = y - this.samples[this.head * 2 + 1]
      if (dx * dx + dy * dy < SPACING_SQUARED) {
        this.samples[this.head * 2] = x
        this.samples[this.head * 2 + 1] = y
        return
      }
    }
    this.head = (this.head + 1) % length
    this.samples[this.head * 2] = x
    this.samples[this.head * 2 + 1] = y
    if (this.count < length) this.count += 1
    this.drain = 0
  }

  /** Called when no ball is flying: the ribbon drains from its oldest sample. */
  update(dt: number, following: boolean): void {
    if (this.count === 0) return
    if (!following) {
      this.drain += dt
      while (this.drain >= DRAIN_STEP && this.count > 0) {
        this.count -= 1
        this.drain -= DRAIN_STEP
      }
    }
    this.write()
  }

  /** Recomputes the vertex buffers from the ring buffer (no allocation). */
  write(): void {
    const length = RENDER.trail.length
    for (let i = 0; i < this.count; i += 1) {
      const index = (this.head - i + length * 2) % length
      const target = i * 3
      this.positions[target] = this.samples[index * 2]
      this.positions[target + 1] = this.samples[index * 2 + 1]
      this.positions[target + 2] = RENDER.depth.trail
      const intensity = Math.pow(1 - i / length, INTENSITY_FALLOFF)
      this.colours[target] = this.baseColour.r * intensity
      this.colours[target + 1] = this.baseColour.g * intensity
      this.colours[target + 2] = this.baseColour.b * intensity
    }
    this.geometry.setDrawRange(0, this.count)
    this.positionAttribute.needsUpdate = true
    this.colourAttribute.needsUpdate = true
  }

  clear(): void {
    this.count = 0
    this.head = -1
    this.drain = 0
    this.geometry.setDrawRange(0, 0)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
