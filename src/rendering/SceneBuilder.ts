import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Scene,
} from 'three'
import { BRICK, FIELD, RENDER } from '../config/gameConfig'
import { PALETTE } from '../config/palette'
import { hexToInt } from '../utils/math'
import {
  createGlowMaterial,
  createHullMaterial,
  createInkMaterial,
  createNeonMaterial,
  createPaperMaterial,
  createTintablePaperMaterial,
} from './materials'
import type { CraftTextures } from './textures'
import { createPylonGeometry } from './props'

const PLANET_DISTANCE = RENDER.space.planet.distance
const PLANET_SIZE = RENDER.space.planet.size
const STAR_DEPTH = { near: RENDER.space.stars.depthNear, far: RENDER.space.stars.depthFar }
const DEBRIS_DEPTH = { near: -9, far: -24 }
const FIELD_THICKNESS = 0.9
const PLANET_COLOUR = 0x6f5cff
const RING_COLOUR = 0x35c4ff

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min)

interface Drifter {
  readonly x0: number
  readonly y0: number
  readonly z: number
  readonly phase: number
  readonly drift: number
  readonly bob: number
  readonly size: number
}

interface Tumbler {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly size: number
  readonly speed: number
  readonly phase: number
}

/**
 * Scene composition: deep space above a neon play board - a layered twinkling
 * starfield, a ringed planet on the horizon, side energy pylons, a grid deck
 * and tumbling hull debris. Every prop is instanced and animated in place, so
 * the diorama costs a handful of draw calls on top of the board.
 */
export class SceneBuilder {
  readonly stage = new Group()
  readonly board = new Group()

  private readonly scene: Scene
  private readonly textures: CraftTextures
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []
  private readonly cloudDrift: Drifter[] = []
  private readonly tumblers: Tumbler[] = []
  private readonly windowLit: boolean[] = []
  private readonly windowPhase: number[] = []
  private readonly clouds: InstancedMesh
  private readonly windows: InstancedMesh
  private readonly blocks: InstancedMesh

  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly rotation = new Euler()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly colour = new Color()
  private elapsed = 0
  private flickerTimer = 0

  constructor(scene: Scene, textures: CraftTextures) {
    this.scene = scene
    this.textures = textures
    scene.background = textures.sky

    this.buildGround()
    this.buildLights()
    this.buildPlanet()
    this.clouds = this.buildStars()
    this.windows = this.buildPylons()
    this.buildPipes()
    this.blocks = this.buildBlocks()
    this.buildBoard()
    this.scene.add(this.stage, this.board)

    // Only now is every instanced mesh on its field, so posing them is safe.
    this.driftClouds()
    this.spinBlocks()
  }

  update(dt: number): void {
    this.elapsed += dt
    this.driftClouds()
    this.spinBlocks()
    this.flickerWindows(dt)
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.geometries.length = 0
    this.materials.length = 0
    this.scene.remove(this.stage, this.board)
    this.stage.clear()
    this.board.clear()
  }

  private buildLights(): void {
    const hemisphere = new HemisphereLight(0x3d5bff, 0x0b1030, 0.7)
    const ambient = new AmbientLight(0x8f9bff, 0.28)
    const key = new DirectionalLight(0x9df3ff, 1.1)
    key.position.set(16, 26, 28)
    // Magenta rim from the opposite side keeps dark hulls edged in neon.
    const fill = new DirectionalLight(0xff3df0, 0.4)
    fill.position.set(-20, -12, 24)
    this.scene.add(hemisphere, ambient, key, fill)
  }

  private buildPlanet(): void {
    const geometry = new CircleGeometry(PLANET_SIZE / 2, 48)
    const material = createGlowMaterial(this.textures.glow)
    material.color.setHex(PLANET_COLOUR)
    this.geometries.push(geometry)
    this.materials.push(material)
    const planet = new Mesh(geometry, material)
    planet.position.set(-FIELD.halfWidth * 0.4, FIELD.halfHeight * 1.45, PLANET_DISTANCE)
    this.stage.add(planet)

    const ringGeometry = new TorusGeometry(RENDER.space.planet.ringSize / 2, 0.5, 12, 64)
    const ringMaterial = createNeonMaterial(RING_COLOUR, 0.55)
    this.geometries.push(ringGeometry)
    this.materials.push(ringMaterial)
    const ring = new Mesh(ringGeometry, ringMaterial)
    ring.position.copy(planet.position)
    ring.rotation.set(1.2, 0.2, 0)
    this.stage.add(ring)
  }

  private buildStars(): InstancedMesh {
    const geometry = new PlaneGeometry(RENDER.space.stars.size, RENDER.space.stars.size)
    const material = createGlowMaterial(this.textures.glow)
    material.color.setHex(0xbfe9ff)
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, RENDER.background.cloudCount * 40)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    for (let index = 0; index < RENDER.background.cloudCount * 40; index += 1) {
      this.cloudDrift.push({
        x0: randomBetween(-1.6, 1.6) * FIELD.halfWidth,
        // Spread across the whole void, from behind the board to deep space.
        y0: randomBetween(-1.1, 1.6) * FIELD.halfHeight,
        z: randomBetween(STAR_DEPTH.far, STAR_DEPTH.near),
        phase: Math.random() * Math.PI * 2,
        drift: randomBetween(0.6, 2.2),
        bob: randomBetween(0.2, 0.6) * RENDER.background.bobAmplitude,
        size: randomBetween(0.7, 1.6),
      })
    }
    this.stage.add(mesh)
    return mesh
  }

  /** Neon grid deck under the board (the visible launch-bay strip). */
  private buildGround(): void {
    const ground = RENDER.space.grid
    const geometry = new BoxGeometry(FIELD.halfWidth * 2 * 1.4, ground.height, ground.depthSize)
    this.textures.checker.repeat.set(7, 2)
    const material = createTintablePaperMaterial(this.textures.checker)
    material.color.setHex(hexToInt(PALETTE.ground))
    this.geometries.push(geometry)
    this.materials.push(material)
    const slab = new Mesh(geometry, material)
    slab.position.set(0, ground.top - ground.height / 2, ground.depth)
    this.stage.add(slab)
  }

  /** Energy pylons flanking the board, each crowned with a pulsing beacon. */
  private buildPylons(): InstancedMesh {
    const { count, x } = RENDER.space.pylon
    const z = RENDER.space.pylon.z
    const geometry = createPylonGeometry()
    const material = createHullMaterial(hexToInt(PALETTE.metalTrim), this.textures.panelPaper)
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1
      this.position.set(side * x, -FIELD.halfHeight + (index % 3) * 9, z + randomBetween(-2, 2))
      this.rotation.set(0, side * randomBetween(0.1, 0.3), 0)
      this.quaternion.setFromEuler(this.rotation)
      this.scale.setScalar(randomBetween(0.9, 1.4))
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
      const lit = Math.random() < 0.7
      this.windowLit.push(lit)
      this.windowPhase.push(Math.random() * Math.PI * 2)
      this.colour.setHex(hexToInt(lit ? PALETTE.windowLit : PALETTE.windowDark))
      mesh.setColorAt(index, this.colour)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.stage.add(mesh)
    return mesh
  }

  /** Energy conduits arcing behind the board margins. */
  private buildPipes(): void {
    const { count } = RENDER.space.pylon
    const depth = RENDER.space.pylon.z
    const geometry = new CylinderGeometry(0.22, 0.22, FIELD.halfHeight * 2.4, 8)
    const material = createNeonMaterial(hexToInt(PALETTE.guide), 0.5)
    this.geometries.push(geometry)
    this.materials.push(material)
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1
      const pipe = new Mesh(geometry, material)
      pipe.position.set(
        side * randomBetween(0.75, 1.3) * FIELD.halfWidth,
        randomBetween(-0.95, -0.1) * FIELD.halfHeight,
        depth + randomBetween(-0.6, 0.6),
      )
      pipe.scale.setScalar(randomBetween(0.8, 1.3))
      this.stage.add(pipe)
    }
  }

  /** Tumbling hull debris drifting beside the launch bay. */
  private buildBlocks(): InstancedMesh {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = createTintablePaperMaterial(this.textures.brickPaper)
    this.geometries.push(geometry)
    this.materials.push(material)
    const count = RENDER.background.boxCount
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1
      this.tumblers.push({
        x: side * randomBetween(1.28, 1.62) * FIELD.halfWidth,
        y: randomBetween(-1, 1) * FIELD.halfHeight * 0.8,
        z: randomBetween(DEBRIS_DEPTH.far, DEBRIS_DEPTH.near),
        size: randomBetween(1.6, 3.4),
        speed: randomBetween(0.25, 0.7),
        phase: Math.random() * Math.PI * 2,
      })
      this.colour.setHex(hexToInt(PALETTE.brickRows[index % PALETTE.brickRows.length]))
      mesh.setColorAt(index, this.colour)
    }
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.stage.add(mesh)
    return mesh
  }

  private driftClouds(): void {
    for (let index = 0; index < this.cloudDrift.length; index += 1) {
      const cloud = this.cloudDrift[index]
      this.position.set(
        cloud.x0 + Math.sin(this.elapsed * 0.08 * cloud.drift + cloud.phase) * cloud.drift,
        cloud.y0 + Math.sin(this.elapsed * 0.35 + cloud.phase) * cloud.bob,
        cloud.z,
      )
      const twinkle = 0.75 + 0.25 * Math.sin(this.elapsed * 1.7 + cloud.phase)
      this.scale.set(cloud.size * twinkle, cloud.size * twinkle, 1)
      this.quaternion.identity()
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.clouds.setMatrixAt(index, this.matrix)
    }
    this.clouds.instanceMatrix.needsUpdate = true
  }

  private spinBlocks(): void {
    for (let index = 0; index < this.tumblers.length; index += 1) {
      const block = this.tumblers[index]
      this.rotation.set(
        block.phase + this.elapsed * block.speed,
        block.phase * 1.7 + this.elapsed * block.speed * 0.8,
        block.phase * 0.6,
      )
      this.quaternion.setFromEuler(this.rotation)
      this.position.set(
        block.x,
        block.y + Math.sin(this.elapsed * 0.5 + block.phase) * RENDER.background.bobAmplitude,
        block.z,
      )
      this.scale.setScalar(block.size)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.blocks.setMatrixAt(index, this.matrix)
    }
    this.blocks.instanceMatrix.needsUpdate = true
  }

  /** Random beacon toggling on the pylons, gated by a per-beacon phase. */
  private flickerWindows(dt: number): void {
    this.flickerTimer -= dt
    if (this.flickerTimer > 0) return
    this.flickerTimer = RENDER.building.window.flickerInterval
    const chance = RENDER.building.window.flickerChance
    let changed = false
    for (let index = 0; index < this.windowLit.length; index += 1) {
      const wave = Math.sin(this.elapsed * 0.4 + this.windowPhase[index])
      if (wave < 0.75) continue
      if (Math.random() >= chance) continue
      this.windowLit[index] = !this.windowLit[index]
      this.colour.setHex(hexToInt(this.windowLit[index] ? PALETTE.windowLit : PALETTE.windowDark))
      this.windows.setColorAt(index, this.colour)
      changed = true
    }
    if (!changed) return
    const colours = this.windows.instanceColor
    if (colours !== null) colours.needsUpdate = true
  }

  /** Play board: dark hull panel plus neon rails around the field. */
  private buildBoard(): void {
    const frame = FIELD.wallThickness
    const fieldWidth = FIELD.halfWidth * 2
    const fieldHeight = FIELD.halfHeight * 2
    const panelGeometry = new BoxGeometry(
      fieldWidth + frame * 2,
      fieldHeight + frame * 2,
      FIELD_THICKNESS,
    )
    const panelMaterial = createPaperMaterial(this.textures.panelPaper)
    panelMaterial.color.setHex(hexToInt(PALETTE.paperShadow))
    this.geometries.push(panelGeometry)
    this.materials.push(panelMaterial)
    const panel = new Mesh(panelGeometry, panelMaterial)
    panel.position.z = RENDER.depth.panel
    this.board.add(panel)

    const inkMaterial = createInkMaterial()
    const wallMaterial = createHullMaterial(hexToInt(PALETTE.wall), this.textures.panelPaper)
    // Cyan rails top and bottom frame the board like a launch bay.
    const railMaterial = createNeonMaterial(hexToInt(PALETTE.wallAccent), 0.85)
    this.materials.push(inkMaterial, wallMaterial, railMaterial)
    const wallDepth = BRICK.depth * 1.25
    const walls: readonly (readonly [number, number, number, number])[] = [
      [-(FIELD.halfWidth + frame / 2), 0, frame, fieldHeight + frame * 2],
      [FIELD.halfWidth + frame / 2, 0, frame, fieldHeight + frame * 2],
      [0, FIELD.halfHeight + frame / 2, fieldWidth, frame],
      [0, -(FIELD.halfHeight + frame / 2), fieldWidth, frame],
    ]
    for (let index = 0; index < walls.length; index += 1) {
      const [x, y, width, height] = walls[index]
      const geometry = new BoxGeometry(width, height, wallDepth)
      this.geometries.push(geometry)
      const ink = new Mesh(geometry, inkMaterial)
      ink.position.set(x, y, -0.35)
      ink.scale.set(1.06, 1.06, 1)
      const paper = new Mesh(geometry, index < 2 ? wallMaterial : railMaterial)
      paper.position.set(x, y, 0.1)
      this.board.add(ink, paper)
    }
  }
}
