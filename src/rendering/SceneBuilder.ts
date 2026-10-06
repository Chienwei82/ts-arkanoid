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
import {
  createAcUnitGeometry,
  createAntennaGeometry,
  createCloudGeometry,
  createServicePipeGeometry,
  createWaterTankGeometry,
} from './props'

const SUN_DISTANCE = -34
const SUN_SIZE = 22
const CLOUD_DEPTH = { near: -22, far: -34 }
const BOX_DEPTH = { near: -9, far: -24 }
const FIELD_THICKNESS = 0.9
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

/** Shared geometry/materials of the facade, so windows and roof line up. */
interface FacadeMetrics {
  readonly width: number
  readonly height: number
  readonly top: number
  readonly centerY: number
  readonly step: number
  readonly cols: number
  readonly rows: number
}

/**
 * Scene composition: an illustrated sky above a "building under construction" -
 * a tall wall with a grid of randomly lit windows, rooftop clutter (water tank,
 * aerial), scaffolding poles and planks along the sides, service pipes, a ground
 * slab and tumbling crates. Every prop is instanced and animated in place, so the
 * diorama costs a handful of draw calls on top of the board.
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
  private readonly facade: FacadeMetrics
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

    const top = FIELD.halfHeight + RENDER.building.facade.topMargin
    const bottom = -FIELD.halfHeight - RENDER.building.facade.bottomMargin
    const height = top - bottom
    const width = FIELD.halfWidth * RENDER.building.facade.widthFactor
    const step = RENDER.building.window.size + RENDER.building.window.gap
    const cols = Math.max(1, Math.floor((width - RENDER.building.window.gap) / step))
    const rows = Math.max(1, Math.floor((height - RENDER.building.window.gap) / step))
    this.facade = { width, height, top, centerY: (top + bottom) / 2, step, cols, rows }

    this.buildFacade()
    this.windows = this.buildWindows()
    this.buildGround()
    this.buildLights()
    this.buildSun()
    this.clouds = this.buildClouds()
    this.buildAcUnits()
    this.buildScaffolding()
    this.buildPipes()
    this.buildRoof()
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
    sun.position.set(FIELD.halfWidth * 1.22, FIELD.halfHeight * 1.32, SUN_DISTANCE)
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
        x0: randomBetween(-1.15, 1.15) * FIELD.halfWidth,
        // High in the sky, above the building roofline.
        y0: randomBetween(1.3, 1.6) * FIELD.halfHeight,
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

  /** Concrete facade panel plus the roof ledge the rooftop props rest on. */
  private buildFacade(): void {
    const { depth, thickness } = RENDER.building.facade
    const geometry = new BoxGeometry(this.facade.width, this.facade.height, thickness)
    const panelMaterial = createPaperMaterial(this.textures.panelPaper)
    panelMaterial.color.setHex(hexToInt(PALETTE.facade))
    const inkMaterial = createInkMaterial()
    this.geometries.push(geometry)
    this.materials.push(panelMaterial, inkMaterial)
    const shell = new Mesh(geometry, inkMaterial)
    shell.scale.set(1.015, 1.015, 1)
    shell.position.set(0, this.facade.centerY, depth - 0.4)
    const panel = new Mesh(geometry, panelMaterial)
    panel.position.set(0, this.facade.centerY, depth)
    this.stage.add(shell, panel)

    const ledgeGeometry = new BoxGeometry(this.facade.width, 1.6, thickness + 3)
    const ledgeMaterial = createPaperMaterial(this.textures.panelPaper)
    ledgeMaterial.color.setHex(hexToInt(PALETTE.metalTrim))
    this.geometries.push(ledgeGeometry)
    this.materials.push(ledgeMaterial)
    const ledge = new Mesh(ledgeGeometry, ledgeMaterial)
    ledge.position.set(0, this.facade.top, depth + 0.8)
    this.stage.add(ledge)
  }

  /** Grid of window panes in front of the facade, each lit or dark at random. */
  private buildWindows(): InstancedMesh {
    const { depth, thickness } = RENDER.building.facade
    const { size, litChance } = RENDER.building.window
    const geometry = new PlaneGeometry(size, size)
    const material = new MeshLambertMaterial({ map: this.textures.windowGlass, flatShading: true })
    this.geometries.push(geometry)
    this.materials.push(material)
    const count = this.facade.cols * this.facade.rows
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false

    const spanX = this.facade.cols * this.facade.step
    const spanY = this.facade.rows * this.facade.step
    const startX = -spanX / 2 + this.facade.step / 2
    const startY = this.facade.centerY - spanY / 2 + this.facade.step / 2
    const z = depth + thickness / 2 + 0.15
    let index = 0
    for (let row = 0; row < this.facade.rows; row += 1) {
      for (let col = 0; col < this.facade.cols; col += 1) {
        this.quaternion.identity()
        this.position.set(startX + col * this.facade.step, startY + row * this.facade.step, z)
        const jitter = randomBetween(0.92, 1)
        this.scale.set(jitter, jitter, 1)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        mesh.setMatrixAt(index, this.matrix)
        const lit = Math.random() < litChance
        this.windowLit.push(lit)
        this.windowPhase.push(Math.random() * Math.PI * 2)
        this.colour.setHex(hexToInt(lit ? PALETTE.windowLit : PALETTE.windowDark))
        mesh.setColorAt(index, this.colour)
        index += 1
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.stage.add(mesh)
    return mesh
  }

  /** Checkered ground slab under the building (the visible "street" strip). */
  private buildGround(): void {
    const ground = RENDER.building.ground
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

  /** Rooftop clutter: a water tank and an aerial on the facade ledge. */
  private buildRoof(): { tank: Mesh; antenna: Mesh } {
    const { depth } = RENDER.building.facade
    const tankGeometry = createWaterTankGeometry()
    const tankMaterial = createTintablePaperMaterial(null)
    tankMaterial.color.setHex(hexToInt(PALETTE.metalTrim))
    const antennaGeometry = createAntennaGeometry()
    const antennaMaterial = createTintablePaperMaterial(null)
    antennaMaterial.color.setHex(hexToInt(PALETTE.metalTrim))
    this.geometries.push(tankGeometry, antennaGeometry)
    this.materials.push(tankMaterial, antennaMaterial)

    const baseY = this.facade.top + 0.8
    const tank = new Mesh(tankGeometry, tankMaterial)
    tank.scale.setScalar(RENDER.building.roof.tankScale)
    tank.position.set(FIELD.halfWidth * 0.7, baseY, depth + 1.6)
    const antenna = new Mesh(antennaGeometry, antennaMaterial)
    antenna.scale.setScalar(RENDER.building.roof.antennaScale)
    antenna.position.set(-FIELD.halfWidth * 0.95, baseY, depth + 1.2)
    this.stage.add(tank, antenna)
    return { tank, antenna }
  }

  /** Air-conditioning boxes clinging to the facade in the side margins. */
  private buildAcUnits(): InstancedMesh {
    const { count, depth } = RENDER.building.ac
    const geometry = createAcUnitGeometry()
    const material = createTintablePaperMaterial(null)
    material.color.setHex(hexToInt(PALETTE.metalTrim))
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1
      this.position.set(
        side * randomBetween(0.55, 1.3) * FIELD.halfWidth,
        randomBetween(-0.85, 0.9) * FIELD.halfHeight,
        depth + randomBetween(-1, 1),
      )
      this.rotation.set(0, side * randomBetween(0.2, 0.5), 0)
      this.quaternion.setFromEuler(this.rotation)
      this.scale.setScalar(randomBetween(0.85, 1.5))
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.stage.add(mesh)
    return mesh
  }

  /** Scaffolding: upright poles at both sides plus stacked wooden planks. */
  private buildScaffolding(): { poles: InstancedMesh; planks: InstancedMesh } {
    const { poles: poleCount, planks: plankCount, x, z } = RENDER.building.scaffold
    const poleGeometry = new CylinderGeometry(0.28, 0.28, FIELD.halfHeight * 3, 8)
    const poleMaterial = new MeshLambertMaterial({
      color: hexToInt(PALETTE.metalTrim),
      flatShading: true,
    })
    const plankGeometry = new BoxGeometry(2.6, 0.4, 6)
    const plankMaterial = createTintablePaperMaterial(this.textures.brickPaper)
    plankMaterial.color.setHex(hexToInt(PALETTE.cardboard))
    this.geometries.push(poleGeometry, plankGeometry)
    this.materials.push(poleMaterial, plankMaterial)

    const poles = new InstancedMesh(poleGeometry, poleMaterial, poleCount)
    poles.frustumCulled = false
    const planks = new InstancedMesh(plankGeometry, plankMaterial, plankCount)
    planks.frustumCulled = false

    const perSide = Math.max(1, Math.floor(poleCount / 2))
    let pi = 0
    let li = 0
    for (const side of [-1, 1]) {
      for (let k = 0; k < perSide && pi < poleCount; k += 1) {
        this.quaternion.identity()
        this.position.set(side * x, 0, z - k * 5)
        this.scale.set(1, 1, 1)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        poles.setMatrixAt(pi, this.matrix)
        pi += 1
      }
      for (let level = 0; level < 3 && li < plankCount; level += 1) {
        this.quaternion.identity()
        this.position.set(side * (x - 1.4), -7 + level * 6, z - 5)
        this.scale.set(1, 1, 1)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        planks.setMatrixAt(li, this.matrix)
        li += 1
      }
    }
    poles.instanceMatrix.needsUpdate = true
    planks.instanceMatrix.needsUpdate = true
    this.stage.add(poles, planks)
    return { poles, planks }
  }

  /** Service pipes running up the facade behind the board margins. */
  private buildPipes(): void {
    const { count, depth } = RENDER.building.pipes
    const geometry = createServicePipeGeometry()
    const material = new MeshLambertMaterial({
      color: hexToInt(PALETTE.metalTrim),
      flatShading: true,
    })
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

  /** Tumbling construction crates drifting beside the building. */
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

  /** Random "somebody is home" window toggling, gated by a per-window phase. */
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
