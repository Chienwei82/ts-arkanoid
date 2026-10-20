/**
 * Turns the deterministic galaxy description into drawable geometry.
 *
 * The backdrop lives far behind the diorama: a luminous core, glowing spiral
 * arms, dark dust lanes, soft nebulae and two layers of stars. Arms, lanes and
 * clouds are merged into single geometries and the stars are instanced, so the
 * whole sky costs about a dozen draw calls.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
} from 'three'
import { RENDER } from '../config/gameConfig'
import { PALETTE } from '../config/palette'
import { hexToInt } from '../utils/math'
import { buildGalaxyLayout, type GalaxyLayout } from './galaxy'
import type { CraftTextures } from './textures'

/** Cosmic tints the stars and clouds cycle through. */
const COSMIC_TINTS: readonly number[] = [
  PALETTE.purple,
  PALETTE.blue,
  PALETTE.teal,
  PALETTE.pink,
  PALETTE.yellow,
  PALETTE.cloud,
].map((hex) => hexToInt(hex))

/** Dust lanes are dark ribbons: they only subtract light from the arms. */
const DUST_COLOUR = hexToInt(PALETTE.ink)

/** Rotation axis used to aim the stretched meteor sprites. */
const AXIS_Z = new Vector3(0, 0, 1)

/** Picks a cosmic tint from a 0..1 tone value. */
const tintFor = (tone: number): number =>
  COSMIC_TINTS[Math.min(COSMIC_TINTS.length - 1, Math.floor(tone * COSMIC_TINTS.length))] ??
  COSMIC_TINTS[0]

/** A point of a ribbon: a spine sample plus the radius that shapes it. */
interface RibbonPoint {
  readonly x: number
  readonly y: number
  /** Distance from the core, normalised 0..1. */
  readonly radius: number
}

/** One background star placement kept for the per-frame twinkle. */
interface StarInstance {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly size: number
  readonly phase: number
}

/** Runtime state for a looping meteor streak. */
interface MeteorInstance {
  readonly x: number
  readonly y: number
  readonly angle: number
  readonly speed: number
  readonly length: number
  readonly tone: number
  readonly loop: number
  readonly offset: number
}

/**
 * Builds a triangle strip that follows a spine, used for the arm glow and the
 * dark dust lanes. The strip fades out at both ends and keeps a soft edge by
 * varying the width along the radius.
 */
const buildRibbon = (
  points: readonly RibbonPoint[],
  width: number,
  colour: number,
  alpha: number,
): BufferGeometry => {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const tint = new Color(colour)
  const count = points.length

  for (let index = 0; index < count; index += 1) {
    const point = points[index]
    const previous = points[Math.max(0, index - 1)]
    const next = points[Math.min(count - 1, index + 1)]
    const tx = next.x - previous.x
    const ty = next.y - previous.y
    const length = Math.hypot(tx, ty) || 1
    // Normal of the tangent: the strip grows sideways from the spine.
    const nx = -ty / length
    const ny = tx / length
    // Wide at the rim, tight near the core.
    const half = width * (0.4 + 0.6 * point.radius)
    // Fade the ends so the ribbon melts into the background.
    const t = count <= 1 ? 0 : index / (count - 1)
    const fade = Math.sin(Math.PI * t) ** 0.6
    // Three vertices per section: transparent rim, solid centre, transparent rim.
    const offsets = [half, 0, -half]
    const alphas = [0, alpha * fade, 0]
    for (let slot = 0; slot < 3; slot += 1) {
      positions.push(point.x + nx * offsets[slot], point.y + ny * offsets[slot], 0)
      colors.push(tint.r, tint.g, tint.b, alphas[slot])
    }
  }

  for (let index = 0; index < count - 1; index += 1) {
    const a = index * 3
    const b = (index + 1) * 3
    // Two quads per section pair: left rim to centre, centre to right rim.
    indices.push(a, a + 1, b, a + 1, b + 1, b)
    indices.push(a + 1, a + 2, b + 1, a + 1, b + 2, b + 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4))
  geometry.setIndex(indices)
  return geometry
}

/**
 * The galaxy backdrop: a seeded sky built once and animated in place.
 */
export class GalaxyBackdrop {
  /** Root group; add it to the scene far behind everything else. */
  readonly object = new Group()

  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []
  private readonly textures: CraftTextures
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly scale = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly colour = new Color()
  private readonly field: StarInstance[] = []
  private fieldStars: InstancedMesh | null = null
  private meteors: InstancedMesh | null = null
  private readonly meteorState: MeteorInstance[] = []
  private core: Group | null = null
  private coreHalo: MeshBasicMaterial | null = null
  private coreHaloBaseOpacity = 0.5
  private coreScale = 1
  private flashLevel = 0
  private elapsed = 0
  private disposed = false

  constructor(textures: CraftTextures) {
    const options = RENDER.space.galaxy
    this.textures = textures
    const layout = buildGalaxyLayout(options.seed, {
      armCount: options.armCount,
      armPoints: options.armPoints,
      armInnerRadius: options.armInnerRadius,
      armOuterRadius: options.armOuterRadius,
      armTurns: options.armTurns,
      armWidth: options.armWidth,
      starsPerArmPoint: options.starsPerArmPoint,
      fieldStarCount: options.fieldStarCount,
      nebulaCount: options.nebulaCount,
      dustLaneCount: options.dustLaneCount,
      fieldRadius: options.fieldRadius,
      fieldDepth: options.fieldDepth,
      meteorCount: options.meteors.count,
    })

    this.object.position.z = options.depth
    this.object.position.x = options.offsetX
    this.object.position.y = options.offsetY
    this.buildCore(layout, options.coreScale)
    this.buildArms(layout, options.armWidth)
    this.buildDustLanes(layout)
    this.buildNebulae(layout)
    this.buildArmStars(layout)
    this.buildFieldStars(layout)
    this.buildMeteors(layout)
  }

  /** Slow galactic drift plus a breathing core; called once per frame. */
  update(dt: number): void {
    if (this.disposed) return
    this.elapsed += dt
    this.object.rotation.z = this.elapsed * RENDER.space.galaxy.spin
    const flashDecay = RENDER.space.galaxy.flash.decay
    this.flashLevel = Math.max(0, this.flashLevel - dt * flashDecay)
    if (this.core !== null) {
      const pulse = 1 + Math.sin(this.elapsed * 0.7) * 0.05
      this.core.scale.setScalar(this.coreScale * (pulse + this.flashLevel * 0.22))
    }
    if (this.coreHalo !== null) {
      this.coreHalo.opacity = Math.min(
        1,
        this.coreHaloBaseOpacity + this.flashLevel * RENDER.space.galaxy.flash.strength,
      )
    }
    this.twinkleFieldStars()
    this.flyMeteors()
  }

  /**
   * Fires the galaxy flash: brick breaks ripple through the sky by blooming
   * the core halo. `strength` keeps chained breaks brighter for longer.
   */
  flash(strength = 1): void {
    if (this.disposed) return
    this.flashLevel = Math.min(1.5, this.flashLevel + strength)
  }

  /** Current flash energy, exposed so tests can assert the ripple. */
  get flashEnergy(): number {
    return this.flashLevel
  }

  /** Releases every geometry, material and texture the backdrop owns. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.geometries.length = 0
    this.materials.length = 0
    this.object.clear()
    this.fieldStars = null
    this.meteors = null
    this.meteorState.length = 0
    this.core = null
    this.coreHalo = null
    this.flashLevel = 0
  }

  /** The bright bulge: a white-hot centre wrapped in a wide violet halo. */
  private buildCore(layout: GalaxyLayout, coreScale: number): void {
    const group = new Group()
    const { radius, glowRadius, opacity } = layout.core

    const haloGeometry = new PlaneGeometry(glowRadius * 2, glowRadius * 2)
    const haloOpacity = opacity * 0.55
    const haloMaterial = new MeshBasicMaterial({
      map: this.textures.glow,
      color: hexToInt(PALETTE.purple),
      transparent: true,
      opacity: haloOpacity,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.geometries.push(haloGeometry)
    this.materials.push(haloMaterial)
    const halo = new Mesh(haloGeometry, haloMaterial)
    group.add(halo)
    this.coreHalo = haloMaterial
    this.coreHaloBaseOpacity = haloOpacity

    const coreGeometry = new PlaneGeometry(radius * 2.6, radius * 2.6)
    const coreMaterial = new MeshBasicMaterial({
      map: this.textures.glow,
      color: hexToInt(PALETTE.cloud),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.geometries.push(coreGeometry)
    this.materials.push(coreMaterial)
    const core = new Mesh(coreGeometry, coreMaterial)
    core.position.z = 0.4
    group.add(core)

    group.scale.setScalar(coreScale)
    this.core = group
    this.coreScale = coreScale
    this.object.add(group)
  }

  /**
   * The spiral arms: a wide violet glow ribbon that follows each spine, with a
   * narrower cyan core ribbon on top so the arms read as layered gas.
   */
  private buildArms(layout: GalaxyLayout, armWidth: number): void {
    const glowMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    this.materials.push(glowMaterial)

    for (const spine of layout.spines) {
      const points: RibbonPoint[] = spine.map((point) => ({
        x: point.x,
        y: point.y,
        radius: point.radius,
      }))
      const geometry = buildRibbon(points, armWidth * 1.9, hexToInt(PALETTE.purple), 0.5)
      this.geometries.push(geometry)
      const mesh = new Mesh(geometry, glowMaterial)
      mesh.position.z = -1.2
      this.object.add(mesh)
    }

    // A tighter, brighter ribbon rides the same spines: gas plus starlight.
    const coreMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    this.materials.push(coreMaterial)
    for (const spine of layout.spines) {
      const points: RibbonPoint[] = spine.map((point) => ({
        x: point.x,
        y: point.y,
        radius: point.radius,
      }))
      const geometry = buildRibbon(points, armWidth * 0.6, hexToInt(PALETTE.blue), 0.75)
      this.geometries.push(geometry)
      const mesh = new Mesh(geometry, coreMaterial)
      mesh.position.z = -0.8
      this.object.add(mesh)
    }
  }

  /**
   * Dust lanes: dark ribbons hugging the trailing edge of each arm. They use
   * normal blending so they subtract light instead of adding it.
   */
  private buildDustLanes(layout: GalaxyLayout): void {
    const material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide,
    })
    this.materials.push(material)

    for (const lane of layout.dustLanes) {
      const points: RibbonPoint[] = lane.points.map(([x, y]) => ({
        x,
        y,
        radius: Math.hypot(x, y) / Math.max(1, RENDER.space.galaxy.armOuterRadius),
      }))
      const geometry = buildRibbon(points, lane.width, DUST_COLOUR, lane.opacity)
      this.geometries.push(geometry)
      const mesh = new Mesh(geometry, material)
      mesh.position.z = -0.4
      this.object.add(mesh)
    }
  }

  /** Wide, faint colour clouds that give the sky depth behind the arms. */
  private buildNebulae(layout: GalaxyLayout): void {
    const template = new MeshBasicMaterial({
      map: this.textures.glow,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.materials.push(template)

    const geometry = new PlaneGeometry(1, 1)
    this.geometries.push(geometry)

    for (const nebula of layout.nebulae) {
      const material = template.clone()
      this.materials.push(material)
      material.color.setHex(tintFor(nebula.tone))
      material.opacity = nebula.opacity
      const mesh = new Mesh(geometry, material)
      mesh.scale.setScalar(nebula.radius * 2)
      mesh.position.set(nebula.x, nebula.y, -2.2)
      this.object.add(mesh)
    }
  }

  /**
   * The stars that trace the arms: one instanced mesh for the whole galaxy, so
   * thousands of points cost a single draw call.
   */
  private buildArmStars(layout: GalaxyLayout): void {
    const stars = layout.arms.flat()
    if (stars.length === 0) return
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({
      map: this.textures.glow,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, stars.length)
    mesh.frustumCulled = false
    for (let index = 0; index < stars.length; index += 1) {
      const star = stars[index]
      this.position.set(star.x, star.y, 0)
      this.quaternion.identity()
      this.scale.setScalar(star.size * 2.4)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
      this.colour.setHex(tintFor(star.tone))
      this.colour.multiplyScalar(0.35 + star.brightness * 0.65)
      mesh.setColorAt(index, this.colour)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.object.add(mesh)
  }

  /**
   * The far field: sparse stars scattered across the whole sky. They keep
   * their twinkle in a separate instanced mesh so the per-frame work is one
   * matrix update.
   */
  private buildFieldStars(layout: GalaxyLayout): void {
    const stars = layout.fieldStars
    if (stars.length === 0) return
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({
      map: this.textures.glow,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, stars.length)
    mesh.frustumCulled = false
    for (let index = 0; index < stars.length; index += 1) {
      const star = stars[index]
      // The phase is derived from the placement, so the field stays seeded.
      const phase = Math.atan2(star.y, star.x) + star.z * 0.37
      this.field.push({
        x: star.x,
        y: star.y,
        z: star.z,
        size: star.size,
        phase,
      })
      this.position.set(star.x, star.y, star.z)
      this.quaternion.identity()
      this.scale.setScalar(star.size * 2)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
      this.colour.setHex(tintFor(star.tone))
      this.colour.multiplyScalar(0.25 + star.brightness * 0.55)
      mesh.setColorAt(index, this.colour)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.fieldStars = mesh
    this.object.add(mesh)
  }

  /**
   * Sporadic meteors: one stretched additive sprite per meteor, looping across
   * the far sky with staggered delays so the sky feels alive.
   */
  private buildMeteors(layout: GalaxyLayout): void {
    const meteors = layout.meteors
    if (meteors.length === 0) return
    const tuning = RENDER.space.galaxy.meteors
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({
      map: this.textures.glow,
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.geometries.push(geometry)
    this.materials.push(material)
    const mesh = new InstancedMesh(geometry, material, meteors.length)
    mesh.frustumCulled = false
    const span = tuning.intervalMax * meteors.length
    for (let index = 0; index < meteors.length; index += 1) {
      const meteor = meteors[index]
      this.meteorState.push({
        x: meteor.x,
        y: meteor.y,
        angle: meteor.angle,
        speed: meteor.speed,
        length: meteor.length,
        tone: meteor.tone,
        loop: span,
        offset: meteor.delay,
      })
      this.colour.setHex(tintFor(meteor.tone))
      mesh.setColorAt(index, this.colour)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    this.meteors = mesh
    this.object.add(mesh)
  }

  /** Loops every meteor across the sky; staggered so they never sync up. */
  private flyMeteors(): void {
    const mesh = this.meteors
    if (mesh === null) return
    for (let index = 0; index < this.meteorState.length; index += 1) {
      const meteor = this.meteorState[index]
      const time = (this.elapsed + meteor.offset) % meteor.loop
      const travel = time * meteor.speed
      const x = meteor.x + Math.cos(meteor.angle) * travel
      const y = meteor.y + Math.sin(meteor.angle) * travel
      this.position.set(x, y, 1.2)
      this.quaternion.setFromAxisAngle(AXIS_Z, meteor.angle)
      this.scale.set(meteor.length, 1.1, 1)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  /** Breathing twinkle for the far field; cheap enough to run every frame. */
  private twinkleFieldStars(): void {
    const mesh = this.fieldStars
    if (mesh === null) return
    for (let index = 0; index < this.field.length; index += 1) {
      const star = this.field[index]
      const twinkle = 0.72 + 0.28 * Math.sin(this.elapsed * 1.6 + star.phase)
      this.position.set(star.x, star.y, star.z)
      this.quaternion.identity()
      this.scale.setScalar(star.size * 2 * twinkle)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      mesh.setMatrixAt(index, this.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
}
