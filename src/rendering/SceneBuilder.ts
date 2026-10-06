import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
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
  createInkMaterial,
  createPaperMaterial,
  createTintablePaperMaterial,
} from './materials'
import type { CraftTextures } from './textures'
import { createCloudGeometry, createHillGeometry } from './props'

const SUN_DISTANCE = -34
const SUN_SIZE = 22
const CLOUD_DEPTH = { near: -22, far: -34 }
const HILL_ROWS = 7
const PLATFORM_DEPTH = -18
const BOX_DEPTH = { near: -9, far: -24 }
const FIELD_THICKNESS = 0.9
const PLATFORM_THICKNESS = 0.7
const SUN_COLOUR = 0xfff3cf

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

interface Floater {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly depth: number
  readonly phase: number
}

const PLATFORM_SPOTS: readonly (readonly [number, number, number])[] = [
  [-FIELD.halfWidth * 1.12, FIELD.halfHeight * 1.2, 10],
  [FIELD.halfWidth * 0.3, FIELD.halfHeight * 1.3, 13],
  [FIELD.halfWidth * 1.18, FIELD.halfHeight * 1.16, 9],
  [-FIELD.halfWidth * 1.18, -FIELD.halfHeight * 1.24, 11],
  [FIELD.halfWidth * 1.12, -FIELD.halfHeight * 1.2, 12],
]

/**
 * Scene composition: illustrated sky, paper clouds and hills, floating
 * checkerboard platforms and tumbling voxel blocks behind the play board. All
 * props are instanced and animated in place, so the diorama costs a handful of
 * draw calls on top of the board itself.
 */
export class SceneBuilder {
  readonly stage = new Group()
  readonly board = new Group()

  private readonly scene: Scene
  private readonly textures: CraftTextures
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []
  private readonly cloudDrift: Drifter[] = []
  private readonly floaters: Floater[] = []
  private readonly tumblers: Tumbler[] = []
  private readonly clouds: InstancedMesh
  private readonly platforms: InstancedMesh
  private readonly lids: InstancedMesh
  private readonly blocks: InstancedMesh

  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly rotation = new Euler()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly colour = new Color()
  private elapsed = 0

  constructor(scene: Scene, textures: CraftTextures) {
    this.scene = scene
    this.textures = textures
    scene.background = textures.sky
    this.buildLights()
    this.buildSun()
    this.clouds = this.buildClouds()
    this.platforms = this.buildPlatforms()
    this.lids = this.buildLids()
    this.blocks = this.buildBlocks()
    this.buildHills()
    this.buildBoard()
    this.scene.add(this.stage, this.board)

    // Only now is every instanced mesh on its field, so posing them is safe.
    this.driftClouds()
    this.bobPlatforms()
    this.spinBlocks()
  }

  update(dt: number): void {
    this.elapsed += dt
    this.driftClouds()
    this.bobPlatforms()
    this.spinBlocks()
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
    const hemisphere = new HemisphereLight(0xe2f1ff, 0xf6e0b8, 0.95)
    const ambient = new AmbientLight(0xffffff, 0.38)
    const key = new DirectionalLight(0xfff5e2, 1.2)
    key.position.set(16, 26, 28)
    // Cool fill from the opposite side keeps flat paper faces from going muddy.
    const fill = new DirectionalLight(0xcfe6ff, 0.35)
    fill.position.set(-20, -12, 24)
    this.scene.add(hemisphere, ambient, key, fill)
  }

  private buildSun(): void {
    const geometry = new CircleGeometry(SUN_SIZE / 2, 32)
    const material = createGlowMaterial(this.textures.glow)
    material.color.setHex(SUN_COLOUR)
    this.geometries.push(geometry)
    this.materials.push(material)
    const sun = new Mesh(geometry, material)
    sun.position.set(FIELD.halfWidth * 1.22, FIELD.halfHeight * 1.12, SUN_DISTANCE)
    this.stage.add(sun)
  }

  private buildClouds(): InstancedMesh {
    const geometry = createCloudGeometry()
    const material = createPaperMaterial(null)
    material.color.setHex(hexToInt(PALETTE.cloud))
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, RENDER.background.cloudCount)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    for (let index = 0; index < RENDER.background.cloudCount; index += 1) {
      this.cloudDrift.push({
        x0: randomBetween(-1.05, 1.05) * FIELD.halfWidth,
        // Above the board: props behind it would be hidden by the play panel.
        y0: randomBetween(1.1, 1.28) * FIELD.halfHeight,
        z: randomBetween(CLOUD_DEPTH.far, CLOUD_DEPTH.near),
        phase: Math.random() * Math.PI * 2,
        drift: randomBetween(2, 6),
        bob: randomBetween(0.4, 1) * RENDER.background.bobAmplitude,
        size: randomBetween(2.4, 4.6),
      })
    }
    this.stage.add(mesh)
    return mesh
  }

  private buildHills(): void {
    const geometry = createHillGeometry()
    const material = createTintablePaperMaterial(null)
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, HILL_ROWS)
    mesh.frustumCulled = false
    const backHill = hexToInt(PALETTE.hillBack)
    const frontHill = hexToInt(PALETTE.hillFront)
    for (let index = 0; index < HILL_ROWS; index += 1) {
      const near = index % 2 === 0
      this.position.set(
        (index / (HILL_ROWS - 1)) * 2 * FIELD.halfWidth * 1.35 - FIELD.halfWidth * 1.35,
        -FIELD.halfHeight * (near ? 1.24 : 1.32),
        near ? -16 : -24,
      )
      this.scale.setScalar(near ? randomBetween(5.5, 8) : randomBetween(7, 10))
      this.quaternion.identity()
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
      this.colour.setHex(near ? frontHill : backHill)
      mesh.setColorAt(index, this.colour)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.stage.add(mesh)
  }

  private buildPlatforms(): InstancedMesh {
    const geometry = new BoxGeometry(1, PLATFORM_THICKNESS, 1)
    const material = createPaperMaterial(this.textures.panelPaper)
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, RENDER.background.floaterCount)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    for (let index = 0; index < PLATFORM_SPOTS.length; index += 1) {
      const [x, y, width] = PLATFORM_SPOTS[index]
      this.floaters.push({
        x,
        y,
        width,
        depth: width * randomBetween(0.42, 0.6),
        phase: Math.random() * Math.PI * 2,
      })
    }
    this.stage.add(mesh)
    return mesh
  }

  private buildLids(): InstancedMesh {
    const geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI / 2)
    this.textures.checker.repeat.set(5, 3)
    const material = new MeshLambertMaterial({ map: this.textures.checker, flatShading: true })
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, RENDER.background.floaterCount)
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    this.stage.add(mesh)
    return mesh
  }

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
        // Side bands: clearly beside the board instead of behind it.
        x: side * randomBetween(0.98, 1.3) * FIELD.halfWidth,
        y: randomBetween(-1, 1) * FIELD.halfHeight * 0.8,
        z: randomBetween(BOX_DEPTH.far, BOX_DEPTH.near),
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
      this.scale.set(cloud.size, cloud.size * 0.78, cloud.size * 0.9)
      this.quaternion.identity()
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.clouds.setMatrixAt(index, this.matrix)
    }
    this.clouds.instanceMatrix.needsUpdate = true
  }

  private bobPlatforms(): void {
    for (let index = 0; index < this.floaters.length; index += 1) {
      const floater = this.floaters[index]
      const y =
        floater.y + Math.sin(this.elapsed * 0.6 + floater.phase) * RENDER.background.bobAmplitude
      this.quaternion.identity()

      this.position.set(floater.x, y, PLATFORM_DEPTH)
      this.scale.set(floater.width, 1, floater.depth)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.platforms.setMatrixAt(index, this.matrix)

      this.position.y = y + PLATFORM_THICKNESS / 2
      this.scale.set(floater.width * 0.96, 1, floater.depth * 0.94)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.lids.setMatrixAt(index, this.matrix)
    }
    this.platforms.instanceMatrix.needsUpdate = true
    this.lids.instanceMatrix.needsUpdate = true
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

  /** Play board: cream paper panel plus a cut-paper frame around the field. */
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
    const wallMaterial = createPaperMaterial(this.textures.panelPaper)
    wallMaterial.color.setHex(hexToInt(PALETTE.wall))
    // Red rails top and bottom frame the board like a printed game tray.
    const railMaterial = createPaperMaterial(this.textures.panelPaper)
    railMaterial.color.setHex(hexToInt(PALETTE.wallAccent))
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
