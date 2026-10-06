import {
  BoxGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  PointLight,
  type BufferGeometry,
  type Material,
} from 'three'
import { BALL, FIELD, PADDLE, POWER_UPS, RENDER } from '../config/gameConfig'
import { PALETTE } from '../config/palette'
import type { Ball, BallType, LaserBolt, PowerUp, PowerUpType } from '../entities/types'
import type { World } from '../systems/World'
import { hexToInt, lerp } from '../utils/math'
import {
  createGlowMaterial,
  createInkMaterial,
  createOutlineMaterial,
  createPaperMaterial,
} from './materials'
import type { CraftTextures } from './textures'

const BALL_GLOW = 0.3
const CARD_ICON_RATIO = 0.66
const CARD_INK_RATIO = 1.1
const LASER_SIZE = { width: 0.34, height: 1.7, depth: 0.3 }
const CANNON_SIZE = { width: 0.7, height: 0.9, depth: PADDLE.depth }
const LASER_COLOUR = hexToInt(PALETTE.powerUp.laser)
const BALL_COLOUR = hexToInt(PALETTE.ball)
/** Special ball flavours glow harder than the plain cream ball. */
const BALL_SPECIAL_GLOW = 0.7
const BALL_TYPE_COLOURS: Readonly<Record<BallType, number>> = {
  standard: hexToInt(PALETTE.ballTypes.standard),
  fire: hexToInt(PALETTE.ballTypes.fire),
  heavy: hexToInt(PALETTE.ballTypes.heavy),
  bomb: hexToInt(PALETTE.ballTypes.bomb),
}
/** Neutral sticker tint: the icon texture already carries its own colours. */
const CUE_PLATE_TINT = 0xffffff
/** Black emissive = "no glow" for the bare paddle. */
const NO_EMISSIVE = 0x000000
/** Slot marker for "no power-up assigned" in the card pool. */
const NO_SLOT = -1

/**
 * Every moving actor of the board: the paddle stack, the ball pool (plus its
 * travelling light), falling power-up cards and laser bolts. Actors are pooled
 * once and only toggled/positioned afterwards, so gameplay frames never build
 * geometry.
 */
export class ActorRenderer {
  private readonly root = new Group()

  private readonly textures: CraftTextures
  private readonly geometries: BufferGeometry[] = []
  private readonly materials: Material[] = []

  private readonly paddleRoot = new Group()
  private readonly paddleLayers: Mesh[] = []
  private readonly cannons: Mesh[] = []

  private readonly ballRoot = new Group()
  private readonly ballInk: Mesh[] = []
  private readonly ballBodies: Mesh[] = []
  private readonly ballMaterials: MeshLambertMaterial[] = []
  private readonly ballTypes: (BallType | null)[] = []
  private readonly ballLight: PointLight

  private readonly cardRoot = new Group()
  private readonly cardGroups: Group[] = []
  private readonly cardIconMaterials: MeshBasicMaterial[] = []
  private readonly cardTypes: (PowerUpType | null)[] = []
  private readonly slotIds: Int32Array

  private readonly laserRoot = new Group()
  private readonly lasers: Mesh[] = []

  private readonly guide: Mesh
  private readonly guideMaterial: MeshBasicMaterial

  private readonly paddleBodyMaterial = new MeshLambertMaterial({
    color: hexToInt(PALETTE.paddle),
    flatShading: true,
  })
  private readonly cuePlateMaterial: MeshBasicMaterial
  private readonly cueAuraMaterial: MeshBasicMaterial
  private readonly cuePlate: Mesh
  private readonly cueAura: Mesh
  private cueType: PowerUpType | null = null
  private motionScale = 1

  private readonly paddleLayerScales: { x: number; y: number }[] = []
  private pulseTimer = 0
  private paddlePulse = 0
  private elapsed = 0

  constructor(textures: CraftTextures) {
    this.textures = textures

    this.paddleRoot.position.z = RENDER.depth.paddle
    this.root.add(this.paddleRoot)
    this.buildPaddle()
    this.cuePlateMaterial = new MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
    })
    const plateGeometry = new PlaneGeometry(RENDER.paddleCue.plateSize, RENDER.paddleCue.plateSize)
    this.geometries.push(plateGeometry)
    this.materials.push(this.cuePlateMaterial)
    this.cuePlate = new Mesh(plateGeometry, this.cuePlateMaterial)
    this.cuePlate.position.z =
      RENDER.paddleLayers.body.z + PADDLE.depth / 2 + RENDER.paddleCue.plateInset
    this.cuePlate.visible = false
    this.paddleRoot.add(this.cuePlate)

    this.cueAuraMaterial = createGlowMaterial(this.textures.glow)
    this.cueAuraMaterial.opacity = RENDER.paddleCue.aura.alpha
    const auraGeometry = new PlaneGeometry(1, 1)
    this.geometries.push(auraGeometry)
    this.materials.push(this.cueAuraMaterial)
    this.cueAura = new Mesh(auraGeometry, this.cueAuraMaterial)
    this.cueAura.position.z = RENDER.paddleCue.aura.z
    this.cueAura.visible = false
    this.paddleRoot.add(this.cueAura)

    this.ballRoot.position.z = RENDER.depth.ball
    this.root.add(this.ballRoot)
    this.buildBalls()
    this.ballLight = new PointLight(
      hexToInt(RENDER.ballLight.color),
      RENDER.ballLight.intensity,
      RENDER.ballLight.distance,
    )
    this.ballLight.visible = false
    this.root.add(this.ballLight)

    this.cardRoot.position.z = RENDER.depth.drop
    this.root.add(this.cardRoot)
    this.slotIds = new Int32Array(POWER_UPS.poolSize).fill(NO_SLOT)
    this.buildCards()

    this.laserRoot.position.z = RENDER.depth.drop + 0.4
    this.root.add(this.laserRoot)
    this.buildLasers()

    this.guideMaterial = new MeshBasicMaterial({
      map: this.textures.dash,
      color: hexToInt(PALETTE.guide),
      transparent: true,
      opacity: RENDER.guide.alpha,
      depthWrite: false,
    })
    this.materials.push(this.guideMaterial)
    const guideGeometry = new PlaneGeometry(RENDER.guide.width, 1)
    this.geometries.push(guideGeometry)
    this.guide = new Mesh(guideGeometry, this.guideMaterial)
    this.guide.position.z = RENDER.depth.guide
    this.guide.visible = false
    this.root.add(this.guide)
  }

  get object(): Group {
    return this.root
  }

  /** Positions every actor from the simulated world, interpolating one step. */
  sync(world: World, alpha: number): void {
    this.syncPaddle(world, alpha)
    this.syncBalls(world, alpha)
    this.syncCards(world, alpha)
    this.syncLasers(world, alpha)
    this.syncGuide(world)
  }

  animate(dt: number): void {
    this.elapsed += dt
    if (this.pulseTimer <= 0) {
      this.paddlePulse = 0
      return
    }
    this.pulseTimer = Math.max(0, this.pulseTimer - dt)
    const progress = 1 - this.pulseTimer / RENDER.paddlePulse.duration
    this.paddlePulse = Math.sin(progress * Math.PI) * RENDER.paddlePulse.amount
  }

  /** Squash-and-swell reaction to a paddle bounce. */
  pulsePaddle(): void {
    this.pulseTimer = RENDER.paddlePulse.duration
  }

  /**
   * Dresses the paddle as the running power-up: aura, face sticker and emissive
   * tint, all in the power-up's colour. `null` restores the bare red bar.
   */
  setCueType(type: PowerUpType | null): void {
    if (type === this.cueType) return
    this.cueType = type
    if (type === null) {
      this.cuePlate.visible = false
      this.cueAura.visible = false
      this.paddleBodyMaterial.color.setHex(hexToInt(PALETTE.paddle))
      this.paddleBodyMaterial.emissive.setHex(NO_EMISSIVE)
      return
    }
    const colour = hexToInt(PALETTE.powerUp[type])
    this.cuePlate.visible = true
    this.cuePlateMaterial.map = this.textures.cardIcons[type]
    this.cuePlateMaterial.color.setHex(CUE_PLATE_TINT)
    this.cuePlateMaterial.needsUpdate = true
    this.cueAura.visible = true
    this.cueAuraMaterial.color.setHex(colour)
    this.paddleBodyMaterial.color.setHex(colour)
    this.paddleBodyMaterial.emissive.setHex(colour)
    this.paddleBodyMaterial.emissiveIntensity = RENDER.paddleCue.glow
  }

  /** Reduced-motion toggle: 0 freezes the cue pulse (the colour cue stays). */
  setMotionScale(scale: number): void {
    this.motionScale = scale
  }

  /** Drops transient actors without touching the pools (level change). */
  clear(): void {
    for (let slot = 0; slot < this.slotIds.length; slot += 1) this.releaseSlot(slot)
    for (const laser of this.lasers) laser.visible = false
    this.pulseTimer = 0
    this.paddlePulse = 0
    this.setCueType(null)
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.geometries.length = 0
    this.materials.length = 0
    this.root.clear()
  }

  private syncPaddle(world: World, alpha: number): void {
    const paddle = world.paddle
    this.paddleRoot.position.set(
      lerp(paddle.prev.x, paddle.pos.x, alpha),
      lerp(paddle.prev.y, paddle.pos.y, alpha),
      RENDER.depth.paddle,
    )
    const widthScale = paddle.halfWidth / paddle.baseHalfWidth
    const stretch = 1 + this.paddlePulse
    for (let layer = 0; layer < this.paddleLayers.length; layer += 1) {
      const base = this.paddleLayerScales[layer]
      this.paddleLayers[layer].scale.set(base.x * widthScale, base.y * stretch, 1)
    }
    const cannonOffset = paddle.halfWidth - CANNON_SIZE.width * 0.6
    this.cannons[0].position.x = -cannonOffset
    this.cannons[1].position.x = cannonOffset
    for (const cannon of this.cannons) {
      cannon.visible = world.laserEnabled
      cannon.position.y = paddle.halfHeight + CANNON_SIZE.height * 0.4
    }

    if (this.cuePlate.visible) {
      const pulse =
        1 +
        Math.sin(this.elapsed * RENDER.paddleCue.pulseSpeed) *
          RENDER.paddleCue.pulse *
          this.motionScale
      this.cuePlate.scale.setScalar(pulse)
      this.cueAura.scale.set(
        paddle.halfWidth * 2 * RENDER.paddleCue.aura.halfWidthScale * pulse,
        RENDER.paddleCue.aura.height * pulse,
        1,
      )
    }
  }

  private syncBalls(world: World, alpha: number): void {
    const balls = world.balls
    let lightTaken = false
    for (let index = 0; index < balls.length; index += 1) {
      const ball = balls[index]
      const ink = this.ballInk[index]
      const body = this.ballBodies[index]
      ink.visible = ball.active
      body.visible = ball.active
      if (!ball.active) continue
      this.applyBallType(index, ball.type)
      const x = lerp(ball.prev.x, ball.pos.x, alpha)
      const y = lerp(ball.prev.y, ball.pos.y, alpha)
      ink.position.set(x, y, 0)
      body.position.set(x, y, 0)
      if (!lightTaken) {
        lightTaken = true
        this.ballLight.position.set(x, y, RENDER.depth.ball + 1.6)
      }
    }
    // The travelling light is the "dynamic lighting" cue for the ball.
    this.ballLight.visible = lightTaken
  }

  private syncCards(world: World, alpha: number): void {
    for (let slot = 0; slot < this.slotIds.length; slot += 1) {
      const id = this.slotIds[slot]
      if (id === NO_SLOT) continue
      let live: PowerUp | null = null
      for (const candidate of world.powerUps) {
        if (candidate.active && candidate.id === id) {
          live = candidate
          break
        }
      }
      if (live === null) {
        this.releaseSlot(slot)
        continue
      }
      this.placeCard(slot, live, alpha)
    }

    for (const powerUp of world.powerUps) {
      if (!powerUp.active || this.hasSlot(powerUp.id)) continue
      const slot = this.freeSlot()
      if (slot === NO_SLOT) continue
      this.assignType(slot, powerUp.type)
      this.slotIds[slot] = powerUp.id
      this.placeCard(slot, powerUp, alpha)
    }
  }

  private syncLasers(world: World, alpha: number): void {
    const bolts = world.lasers
    for (let index = 0; index < this.lasers.length; index += 1) {
      const bolt: LaserBolt | undefined = bolts[index]
      const mesh = this.lasers[index]
      mesh.visible = bolt?.active ?? false
      if (bolt === undefined || !bolt.active) continue
      mesh.position.set(
        lerp(bolt.prev.x, bolt.pos.x, alpha),
        lerp(bolt.prev.y, bolt.pos.y, alpha),
        0,
      )
    }
  }

  private syncGuide(world: World): void {
    let stuck: Ball | null = null
    for (const ball of world.balls) {
      if (ball.active && ball.stuck) {
        stuck = ball
        break
      }
    }
    if (stuck === null) {
      this.guide.visible = false
      return
    }
    const top = FIELD.halfHeight - 1.5
    const bottom = stuck.pos.y
    this.guide.visible = true
    this.guide.position.set(stuck.pos.x, (top + bottom) / 2, RENDER.depth.guide)
    this.guide.scale.set(1, Math.max(1, top - bottom), 1)
    this.guideMaterial.opacity = RENDER.guide.alpha * (0.7 + 0.3 * Math.sin(this.elapsed * 4))
  }

  private buildPaddle(): void {
    const geometry = new BoxGeometry(PADDLE.baseHalfWidth * 2, PADDLE.halfHeight * 2, PADDLE.depth)
    this.geometries.push(geometry)
    const materials: Material[] = [
      createInkMaterial(),
      createPaperMaterial(null),
      this.paddleBodyMaterial,
    ]
    this.materials.push(...materials)
    const layers = [RENDER.paddleLayers.ink, RENDER.paddleLayers.paper, RENDER.paddleLayers.body]
    for (let layer = 0; layer < layers.length; layer += 1) {
      const config = layers[layer]
      const mesh = new Mesh(geometry, materials[layer])
      mesh.position.z = config.z
      mesh.scale.set(config.x, config.y, 1)
      this.paddleLayerScales.push({ x: config.x, y: config.y })
      this.paddleLayers.push(mesh)
      this.paddleRoot.add(mesh)
    }

    const cannonGeometry = new BoxGeometry(CANNON_SIZE.width, CANNON_SIZE.height, CANNON_SIZE.depth)
    const cannonMaterial = new MeshLambertMaterial({
      color: LASER_COLOUR,
      emissive: LASER_COLOUR,
      emissiveIntensity: 0.4,
      flatShading: true,
    })
    this.geometries.push(cannonGeometry)
    this.materials.push(cannonMaterial)
    for (let index = 0; index < 2; index += 1) {
      const cannon = new Mesh(cannonGeometry, cannonMaterial)
      cannon.visible = false
      this.cannons.push(cannon)
      this.paddleRoot.add(cannon)
    }
  }

  private buildBalls(): void {
    const geometry = new IcosahedronGeometry(BALL.radius, 1)
    this.geometries.push(geometry)
    const inkMaterial = createOutlineMaterial()
    this.materials.push(inkMaterial)
    for (let index = 0; index < BALL.maxCount; index += 1) {
      // Each slot owns its material so the flavour colour can change per ball.
      const bodyMaterial = new MeshLambertMaterial({
        color: BALL_COLOUR,
        emissive: BALL_COLOUR,
        emissiveIntensity: BALL_GLOW,
        flatShading: true,
      })
      this.materials.push(bodyMaterial)
      this.ballMaterials.push(bodyMaterial)
      this.ballTypes.push(null)
      const ink = new Mesh(geometry, inkMaterial)
      ink.scale.setScalar(RENDER.outlineScale.actor)
      ink.visible = false
      const body = new Mesh(geometry, bodyMaterial)
      body.visible = false
      this.ballInk.push(ink)
      this.ballBodies.push(body)
      this.ballRoot.add(ink)
      this.ballRoot.add(body)
    }
  }

  /** Paints a ball slot for its flavour, only when the flavour actually changes. */
  private applyBallType(index: number, type: BallType): void {
    if (this.ballTypes[index] === type) return
    this.ballTypes[index] = type
    const colour = BALL_TYPE_COLOURS[type]
    const material = this.ballMaterials[index]
    material.color.setHex(colour)
    material.emissive.setHex(colour)
    material.emissiveIntensity = type === 'standard' ? BALL_GLOW : BALL_SPECIAL_GLOW
  }

  private buildCards(): void {
    const size = RENDER.card.size
    const backGeometry = new PlaneGeometry(size, size)
    const inkGeometry = new PlaneGeometry(size * CARD_INK_RATIO, size * CARD_INK_RATIO)
    const iconGeometry = new PlaneGeometry(size * CARD_ICON_RATIO, size * CARD_ICON_RATIO)
    this.geometries.push(backGeometry, inkGeometry, iconGeometry)
    const inkMaterial = createInkMaterial()
    const backMaterial = new MeshLambertMaterial({
      color: hexToInt(PALETTE.paper),
      map: this.textures.cardPaper,
      flatShading: true,
    })
    this.materials.push(inkMaterial, backMaterial)

    for (let slot = 0; slot < POWER_UPS.poolSize; slot += 1) {
      const group = new Group()
      group.visible = false
      const ink = new Mesh(inkGeometry, inkMaterial)
      ink.position.z = -0.12
      const back = new Mesh(backGeometry, backMaterial)
      const iconMaterial = new MeshBasicMaterial({ transparent: true, alphaTest: 0.15 })
      const icon = new Mesh(iconGeometry, iconMaterial)
      icon.position.z = 0.12
      this.materials.push(iconMaterial)
      this.cardIconMaterials.push(iconMaterial)
      this.cardTypes.push(null)
      group.add(ink, back, icon)
      this.cardGroups.push(group)
      this.cardRoot.add(group)
    }
  }

  private buildLasers(): void {
    const geometry = new BoxGeometry(LASER_SIZE.width, LASER_SIZE.height, LASER_SIZE.depth)
    const material = new MeshLambertMaterial({
      color: LASER_COLOUR,
      emissive: LASER_COLOUR,
      emissiveIntensity: 1.4,
      flatShading: true,
    })
    this.geometries.push(geometry)
    this.materials.push(material)
    for (let index = 0; index < POWER_UPS.laserPoolSize; index += 1) {
      const bolt = new Mesh(geometry, material)
      bolt.visible = false
      this.lasers.push(bolt)
      this.laserRoot.add(bolt)
    }
  }

  private placeCard(slot: number, powerUp: PowerUp, alpha: number): void {
    const group = this.cardGroups[slot]
    const bob = Math.sin(this.elapsed * 2.2 + slot) * RENDER.card.bob
    group.visible = true
    group.position.set(
      lerp(powerUp.prev.x, powerUp.pos.x, alpha),
      lerp(powerUp.prev.y, powerUp.pos.y, alpha) + bob,
      0,
    )
    group.rotation.set(
      Math.sin(this.elapsed * 1.4 + slot) * 0.12,
      Math.sin(this.elapsed * RENDER.card.spin + slot) * 0.45,
      0,
    )
  }

  /** Swaps the icon texture only when the slot changes power-up type. */
  private assignType(slot: number, type: PowerUpType): void {
    if (this.cardTypes[slot] === type) return
    const material = this.cardIconMaterials[slot]
    material.map = this.textures.cardIcons[type]
    material.needsUpdate = true
    this.cardTypes[slot] = type
  }

  private releaseSlot(slot: number): void {
    this.slotIds[slot] = NO_SLOT
    this.cardGroups[slot].visible = false
  }

  private hasSlot(id: number): boolean {
    for (const assigned of this.slotIds) {
      if (assigned === id) return true
    }
    return false
  }

  private freeSlot(): number {
    for (let slot = 0; slot < this.slotIds.length; slot += 1) {
      if (this.slotIds[slot] === NO_SLOT) return slot
    }
    return NO_SLOT
  }
}
