import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  type MeshLambertMaterial,
  Quaternion,
  Vector3,
  type Texture,
} from 'three'
import { RENDER } from '../config/gameConfig'
import { createTintablePaperMaterial } from './materials'

/** Scrap aspect and drag: flat confetti, not volumetric debris. */
const SCRAP_DEPTH = 0.14
const SCRAP_ASPECT = 0.75
const DRAG = 0.86
const FADE_SECONDS = 0.45
/** Scale used instead of zero: keeps the instance matrix invertible. */
const HIDDEN_SCALE = 0.0001

interface Scrap {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  rz: number
  spinX: number
  spinY: number
  spinZ: number
  size: number
  life: number
}

/**
 * Paper confetti for brick impacts (Object Pool + a single InstancedMesh).
 * Slots are recycled from a free stack, so spawns never allocate and the render
 * loop only touches the scraps that are still in the air.
 */
export class ConfettiSystem {
  private readonly mesh: InstancedMesh
  private readonly material: MeshLambertMaterial
  private readonly geometry: BoxGeometry
  private readonly scraps: Scrap[]
  private readonly freeSlots: number[]
  private readonly activeSlots: number[] = []

  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly rotation = new Euler()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly colour = new Color()
  private colourDirty = false

  constructor(map: Texture) {
    const capacity = RENDER.confettiCapacity
    this.geometry = new BoxGeometry(1, 1, SCRAP_DEPTH)
    this.material = createTintablePaperMaterial(map)
    this.mesh = new InstancedMesh(this.geometry, this.material, capacity)
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.scraps = Array.from({ length: capacity }, () => ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      size: 0,
      life: 0,
    }))
    this.freeSlots = Array.from({ length: capacity }, (_, index) => capacity - 1 - index)
    for (let slot = 0; slot < capacity; slot += 1) this.hide(slot)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  get object(): InstancedMesh {
    return this.mesh
  }

  /** Confetti burst tinted with the brick's own colour. */
  burst(x: number, y: number, z: number, colour: number, count: number): void {
    for (let i = 0; i < count; i += 1) this.spawn(x, y, z, colour)
  }

  /** Celebration shower from the top of the field (level cleared). */
  shower(halfWidth: number, top: number, colours: readonly number[], count: number): void {
    for (let i = 0; i < count; i += 1) {
      const colour = colours[i % colours.length]
      this.spawn((Math.random() * 2 - 1) * halfWidth, top, RENDER.depth.confetti, colour, 0.4)
    }
  }

  update(dt: number): void {
    if (this.activeSlots.length === 0) {
      if (this.colourDirty) this.flushColours()
      return
    }
    const { gravity, spin } = RENDER.confetti
    let live = 0

    for (let i = 0; i < this.activeSlots.length; i += 1) {
      const slot = this.activeSlots[i]
      const scrap = this.scraps[slot]
      scrap.life -= dt
      if (scrap.life <= 0) {
        this.hide(slot)
        this.freeSlots.push(slot)
        continue
      }
      scrap.vy -= gravity * dt
      scrap.vx *= DRAG
      scrap.vz *= DRAG
      scrap.x += scrap.vx * dt
      scrap.y += scrap.vy * dt
      scrap.z += scrap.vz * dt
      scrap.rz += scrap.spinZ * dt
      scrap.rx += scrap.spinX * dt
      scrap.ry += scrap.spinY * dt
      this.compose(slot, scrap, Math.min(1, scrap.life / FADE_SECONDS), spin)
      this.activeSlots[live] = slot
      live += 1
    }

    this.activeSlots.length = live
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.colourDirty) this.flushColours()
  }

  /** Recycles every scrap (level change, new run). */
  clear(): void {
    for (const slot of this.activeSlots) {
      this.hide(slot)
      this.freeSlots.push(slot)
    }
    this.activeSlots.length = 0
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.dispose()
  }

  private spawn(x: number, y: number, z: number, colour: number, spreadScale = 1): void {
    const slot = this.freeSlots.pop()
    if (slot === undefined) return
    const scrap = this.scraps[slot]
    const { spread, rise, size, life } = RENDER.confetti
    const angle = Math.random() * Math.PI * 2
    const speed = spread * spreadScale * (0.35 + Math.random() * 0.65)
    scrap.x = x
    scrap.y = y
    scrap.z = z
    scrap.vx = Math.cos(angle) * speed
    scrap.vy = rise * spreadScale * (0.3 + Math.random() * 0.7)
    scrap.vz = (Math.random() - 0.35) * speed * 0.5
    scrap.rx = Math.random() * Math.PI
    scrap.ry = Math.random() * Math.PI
    scrap.rz = Math.random() * Math.PI
    scrap.spinX = (Math.random() - 0.5) * 12
    scrap.spinY = (Math.random() - 0.5) * 12
    scrap.spinZ = (Math.random() - 0.5) * 12
    scrap.size = size * (0.7 + Math.random() * 0.8)
    scrap.life = life * (0.75 + Math.random() * 0.6)
    this.activeSlots.push(slot)
    this.colour.setHex(colour)
    this.mesh.setColorAt(slot, this.colour)
    this.colourDirty = true
  }

  private flushColours(): void {
    this.colourDirty = false
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true
  }

  private compose(slot: number, scrap: Scrap, fade: number, spin: number): void {
    this.rotation.set(scrap.rx, scrap.ry, scrap.rz + spin * (1 - fade))
    this.quaternion.setFromEuler(this.rotation)
    this.position.set(scrap.x, scrap.y, scrap.z)
    const size = scrap.size * fade
    this.scale.set(size, size * SCRAP_ASPECT, size)
    this.matrix.compose(this.position, this.quaternion, this.scale)
    this.mesh.setMatrixAt(slot, this.matrix)
  }

  private hide(slot: number): void {
    this.scale.set(HIDDEN_SCALE, HIDDEN_SCALE, HIDDEN_SCALE)
    this.position.set(0, 0, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scale)
    this.mesh.setMatrixAt(slot, this.matrix)
  }
}
