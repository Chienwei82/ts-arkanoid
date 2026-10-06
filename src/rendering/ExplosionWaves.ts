import { Color, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three'
import { RENDER } from '../config/gameConfig'

const WAVE_SEGMENTS = 48
const WAVE_INNER_RATIO = 0.72
const WAVE_OPACITY = 0.75

interface Wave {
  readonly mesh: Mesh
  readonly material: MeshBasicMaterial
  readonly geometry: RingGeometry
  life: number
}

/**
 * Shockwave ring for explosive bricks. A tiny fixed pool of rings: when the pool
 * is empty the extra blast is simply dropped, never allocated on the spot.
 */
export class ExplosionWaves {
  private readonly root = new Group()
  private readonly waves: Wave[] = []
  private readonly free: Wave[] = []
  private readonly active: Wave[] = []
  private readonly colour = new Color()

  constructor() {
    for (let i = 0; i < RENDER.waves.capacity; i += 1) {
      const geometry = new RingGeometry(WAVE_INNER_RATIO, 1, WAVE_SEGMENTS)
      const material = new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 })
      const mesh = new Mesh(geometry, material)
      mesh.visible = false
      this.root.add(mesh)
      const wave: Wave = { mesh, material, geometry, life: 0 }
      this.waves.push(wave)
      this.free.push(wave)
    }
  }

  get object(): Group {
    return this.root
  }

  spawn(x: number, y: number, z: number, colour: number): void {
    const wave = this.free.pop()
    if (wave === undefined) return
    this.colour.setHex(colour)
    wave.material.color.copy(this.colour)
    wave.material.opacity = WAVE_OPACITY
    wave.mesh.position.set(x, y, z)
    wave.mesh.scale.setScalar(0.001)
    wave.mesh.visible = true
    wave.life = RENDER.waves.duration
    this.active.push(wave)
  }

  update(dt: number): void {
    if (this.active.length === 0) return
    let live = 0
    for (let i = 0; i < this.active.length; i += 1) {
      const wave = this.active[i]
      wave.life -= dt
      if (wave.life <= 0) {
        wave.mesh.visible = false
        this.free.push(wave)
        continue
      }
      const progress = 1 - wave.life / RENDER.waves.duration
      wave.mesh.scale.setScalar(RENDER.waves.maxRadius * progress)
      wave.material.opacity = WAVE_OPACITY * (1 - progress)
      this.active[live] = wave
      live += 1
    }
    this.active.length = live
  }

  clear(): void {
    for (const wave of this.active) {
      wave.mesh.visible = false
      this.free.push(wave)
    }
    this.active.length = 0
  }

  dispose(): void {
    for (const wave of this.waves) {
      wave.geometry.dispose()
      wave.material.dispose()
    }
    this.root.clear()
  }
}
