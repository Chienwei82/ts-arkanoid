import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { BRICK, RENDER } from '../config/gameConfig'
import type { Brick } from '../entities/types'
import { brickMaterialFor, type BrickMaterial } from './brickMaterial'
import { createInkMaterial, createPaperMaterial, createTintablePaperMaterial } from './materials'
import type { CraftTextures } from './textures'

const BODY_LAYER = 2
const LAYER_COUNT = 3
/** Draw order of the three stacked layers: ink casing, paper frame, body. */
const LAYER_ORDER = [
  RENDER.brickLayers.ink,
  RENDER.brickLayers.paper,
  RENDER.brickLayers.body,
] as const
/** Scale used instead of zero: keeps the instance matrix invertible. */
const HIDDEN_SCALE = 0.0001
const WHITE = new Color(1, 1, 1)
/** Tough bricks darken as they lose hit points, so damage is readable. */
const DAMAGED_FLOOR = 0.55
/** Pop toward the camera while shattering, in world units. */
const DEATH_POP = 2.2
/** Extra uniform scale at the peak of the hit pulse. */
const HIT_SWELL = 0.05

interface BrickVisual {
  hit: number
  dying: number
  alive: boolean
  hitsLeft: number
}

/** One material family: its three stacked instanced layers plus its textures. */
interface MaterialGroup {
  readonly layers: InstancedMesh[]
  readonly geometry: BoxGeometry
  readonly ink: MeshBasicMaterial
  readonly paper: MeshLambertMaterial
  readonly body: MeshLambertMaterial
}

interface BrickSize {
  readonly width: number
  readonly height: number
}

/**
 * Renders the whole brick field with three InstancedMesh layers - ink casing,
 * paper frame and tinted body - per material family present in the level (wood
 * crates, sheet metal, cast concrete, hazard crates). Each family keeps its own
 * texture, so a level still costs a handful of draw calls while reading as
 * different materials. Hit pulses and the shatter animation rewrite only the
 * instances that are actually moving, so a calm frame costs nothing.
 */
export class BrickRenderer {
  private readonly root = new Group()
  private readonly textures: CraftTextures
  private readonly groups: MaterialGroup[] = []
  private readonly matrices = [new Matrix4(), new Matrix4(), new Matrix4()]
  private readonly position = new Vector3()
  private readonly rotation = new Euler()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly colour = new Color()

  private bricks: readonly Brick[] = []
  private visuals: BrickVisual[] = []
  /** Per-brick lookup into `groups` and the instance slot inside that group. */
  private groupIndex = new Int32Array(0)
  private slotIndex = new Int32Array(0)
  private colourDirty = false

  constructor(textures: CraftTextures) {
    this.textures = textures
  }

  get object(): Group {
    return this.root
  }

  /** Rebuilds the instanced layers for a new level layout, bucketed by material. */
  setBricks(bricks: readonly Brick[]): void {
    this.disposeGroups()
    this.bricks = bricks
    this.visuals = bricks.map((brick) => ({
      hit: 0,
      dying: 0,
      alive: brick.alive,
      hitsLeft: brick.hitsLeft,
    }))
    this.groupIndex = new Int32Array(bricks.length)
    this.slotIndex = new Int32Array(bricks.length)
    if (bricks.length === 0) return

    const sample = bricks[0]
    const size: BrickSize = { width: sample.halfWidth * 2, height: sample.halfHeight * 2 }

    const buckets = new Map<BrickMaterial, number[]>()
    for (let index = 0; index < bricks.length; index += 1) {
      const material = brickMaterialFor(bricks[index].type)
      const bucket = buckets.get(material)
      if (bucket === undefined) buckets.set(material, [index])
      else bucket.push(index)
    }

    for (const [material, indices] of buckets) {
      const groupIdx = this.groups.length
      this.groups.push(this.createGroup(material, size, indices.length))
      for (let slot = 0; slot < indices.length; slot += 1) {
        const index = indices[slot]
        this.groupIndex[index] = groupIdx
        this.slotIndex[index] = slot
      }
    }

    for (let index = 0; index < bricks.length; index += 1) {
      this.writeBrick(index, bricks[index], this.visuals[index])
    }
    this.flushMatrices()
    this.flushColours()
  }

  /** Observes the simulation and starts the matching visual reaction. */
  sync(): void {
    if (this.bricks.length === 0) return
    let matricesChanged = false
    for (let index = 0; index < this.bricks.length; index += 1) {
      const brick = this.bricks[index]
      const visual = this.visuals[index]
      if (!brick.alive) {
        if (visual.alive) {
          visual.alive = false
          visual.hit = 0
          visual.dying = RENDER.brickDeath.duration
          this.writeBrick(index, brick, visual)
          matricesChanged = true
        }
        continue
      }
      if (brick.hitsLeft !== visual.hitsLeft) {
        visual.hitsLeft = brick.hitsLeft
        if (brick.hitsLeft > 0) visual.hit = RENDER.brickHit.duration
        this.writeColour(index, brick, 0)
      }
    }
    if (matricesChanged) this.flushMatrices()
    this.flushColours()
  }

  /** Advances pulses and shatter animations for the bricks in motion. */
  animate(dt: number): void {
    if (this.bricks.length === 0) return
    let matricesChanged = false

    for (let index = 0; index < this.bricks.length; index += 1) {
      const visual = this.visuals[index]
      if (visual.hit <= 0 && visual.dying <= 0) continue
      const brick = this.bricks[index]

      if (visual.dying > 0) {
        visual.dying -= dt
        if (visual.dying <= 0) {
          visual.dying = 0
          this.hideBrick(index)
          matricesChanged = true
          continue
        }
      } else {
        visual.hit = Math.max(0, visual.hit - dt)
        if (visual.hit === 0 && !visual.alive) {
          this.hideBrick(index)
          matricesChanged = true
          continue
        }
      }

      // writeColour flags the colour buffer; matrices are flushed once below.
      this.writeBrick(index, brick, visual)
      matricesChanged = true
    }

    if (matricesChanged) this.flushMatrices()
    this.flushColours()
  }

  dispose(): void {
    this.disposeGroups()
    this.bricks = []
    this.visuals = []
    this.root.clear()
  }

  private createGroup(material: BrickMaterial, size: BrickSize, count: number): MaterialGroup {
    const geometry = new BoxGeometry(size.width, size.height, BRICK.depth)
    const texture = this.textures.brickMaterials[material]
    const ink = createInkMaterial()
    const paper = createPaperMaterial(texture)
    const body = createTintablePaperMaterial(texture)
    const layers: InstancedMesh[] = []
    for (const layerMaterial of [ink, paper, body]) {
      const layer = new InstancedMesh(geometry, layerMaterial, count)
      layer.frustumCulled = false
      layer.instanceMatrix.setUsage(DynamicDrawUsage)
      this.root.add(layer)
      layers.push(layer)
    }
    return { layers, geometry, ink, paper, body }
  }

  private writeBrick(index: number, brick: Brick, visual: BrickVisual): void {
    let uniform = 1
    let stretch = 1
    let rise = 0
    let pop = 0
    let spin = 0

    if (visual.dying > 0) {
      const t = 1 - visual.dying / RENDER.brickDeath.duration
      uniform = 1 - (1 - RENDER.brickDeath.shrink) * t
      rise = RENDER.brickDeath.lift * t - RENDER.brickDeath.gravity * t * t * 0.5
      pop = t * DEATH_POP
      spin = RENDER.brickDeath.spin * t
      this.writeColour(index, brick, 0)
    } else if (visual.hit > 0) {
      const t = 1 - visual.hit / RENDER.brickHit.duration
      const pulse = Math.sin(t * Math.PI)
      uniform = 1 + HIT_SWELL * pulse
      stretch = 1 - RENDER.brickHit.squash * pulse
      pop = RENDER.brickHit.pop * pulse
      this.writeColour(index, brick, pulse)
    } else {
      this.writeColour(index, brick, 0)
    }

    const group = this.groups[this.groupIndex[index]]
    const slot = this.slotIndex[index]
    this.rotation.set(0, 0, spin)
    this.quaternion.setFromEuler(this.rotation)
    this.position.set(brick.pos.x, brick.pos.y + rise, 0)
    for (let layer = 0; layer < LAYER_COUNT; layer += 1) {
      const config = LAYER_ORDER[layer]
      this.position.z = RENDER.depth.brick + config.z + pop
      this.scale.set(uniform * config.x, uniform * stretch * config.y, 1)
      this.matrices[layer].compose(this.position, this.quaternion, this.scale)
      group.layers[layer].setMatrixAt(slot, this.matrices[layer])
    }
  }

  private writeColour(index: number, brick: Brick, pulse: number): void {
    this.colour.setHex(brick.color)
    if (brick.baseHits > 1) {
      const wear = DAMAGED_FLOOR + (1 - DAMAGED_FLOOR) * (brick.hitsLeft / brick.baseHits)
      this.colour.multiplyScalar(wear)
    }
    if (pulse > 0) this.colour.lerp(WHITE, RENDER.brickHit.flash * pulse)
    const group = this.groups[this.groupIndex[index]]
    group.layers[BODY_LAYER].setColorAt(this.slotIndex[index], this.colour)
    this.colourDirty = true
  }

  private hideBrick(index: number): void {
    this.quaternion.identity()
    this.position.set(0, 0, 0)
    this.scale.set(HIDDEN_SCALE, HIDDEN_SCALE, HIDDEN_SCALE)
    const group = this.groups[this.groupIndex[index]]
    const slot = this.slotIndex[index]
    for (let layer = 0; layer < LAYER_COUNT; layer += 1) {
      this.matrices[layer].compose(this.position, this.quaternion, this.scale)
      group.layers[layer].setMatrixAt(slot, this.matrices[layer])
    }
  }

  private flushMatrices(): void {
    for (const group of this.groups) {
      for (const layer of group.layers) layer.instanceMatrix.needsUpdate = true
    }
  }

  private flushColours(): void {
    if (!this.colourDirty) return
    this.colourDirty = false
    for (const group of this.groups) {
      const colours = group.layers[BODY_LAYER].instanceColor
      if (colours !== null) colours.needsUpdate = true
    }
  }

  private disposeGroups(): void {
    for (const group of this.groups) {
      for (const layer of group.layers) {
        this.root.remove(layer)
        layer.dispose()
      }
      group.geometry.dispose()
      group.ink.dispose()
      group.paper.dispose()
      group.body.dispose()
    }
    this.groups.length = 0
  }
}
