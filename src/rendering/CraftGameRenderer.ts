import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Plane,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { FIELD, RENDER, type QualityConfig } from '../config/gameConfig'
import { PALETTE } from '../config/palette'
import type { GameBus, Unsubscribe } from '../core/EventBus'
import { GAME_CANVAS_CLASS, type GameRenderer } from '../core/renderer'
import type { GameStatus } from '../core/types'
import { ViewportManager, type ViewportSize } from '../platform/ViewportManager'
import type { World } from '../systems/World'
import type { Brick } from '../entities/types'
import { DEG2RAD, clamp, hexToInt, lerp } from '../utils/math'
import { ActorRenderer } from './ActorRenderer'
import { BallTrail } from './BallTrail'
import { BrickRenderer } from './BrickRenderer'
import { ConfettiSystem } from './ConfettiSystem'
import { ExplosionWaves } from './ExplosionWaves'
import { PostFX } from './PostFX'
import { SceneBuilder } from './SceneBuilder'
import { ScreenShake } from './ScreenShake'
import { CraftTextures } from './textures'

const CONFETTI = { brick: 22, chain: 11, damaged: 5, pickup: 12, celebration: 40 }
const CELEBRATION_BURSTS = 3
const CELEBRATION_INTERVAL = 0.35
const TRAUMA = {
  brick: 0.4,
  chain: 0.24,
  damaged: 0.12,
  paddleBase: 0.14,
  paddleStrength: 0.3,
  wall: 0.1,
  collect: 0.18,
  laser: 0.05,
  life: 0.85,
  gameOver: 0.9,
}
const CELEBRATION_COLOURS: readonly number[] = [
  PALETTE.red,
  PALETTE.orange,
  PALETTE.yellow,
  PALETTE.green,
  PALETTE.blue,
  PALETTE.purple,
  PALETTE.pink,
  PALETTE.teal,
].map((hex) => hexToInt(hex))
const EXPOSURE = 1.05

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** Confetti kept when the visitor asks for reduced motion. */
const CALM_CONFETTI_RATIO = 0.35
const CONTEXT_LOST_MESSAGE =
  'Se perdió el contexto WebGL. El progreso de la partida no se puede recuperar en esta pantalla.'

/**
 * Owns the three.js side of the game and implements the engine's GameRenderer
 * contract: it translates world state into visuals, answers the ping-pong of
 * gameplay events with effects and releases every GPU resource on dispose.
 */
export class CraftGameRenderer implements GameRenderer {
  private readonly container: HTMLElement
  private readonly bus: GameBus
  private readonly textures = new CraftTextures()
  private readonly renderer: WebGLRenderer
  private readonly canvas: HTMLCanvasElement
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly sceneBuilder: SceneBuilder
  private readonly bricks: BrickRenderer
  private readonly actors: ActorRenderer
  private readonly confetti: ConfettiSystem
  private readonly waves: ExplosionWaves
  private readonly trail: BallTrail
  private readonly postFX: PostFX
  private readonly shake = new ScreenShake()
  private readonly raycaster = new Raycaster()
  private readonly plane = new Plane(new Vector3(0, 0, 1), 0)
  private readonly pointer = new Vector2()
  private readonly hitPoint = new Vector3()
  private readonly viewport: ViewportManager
  private readonly unsubscribers: Unsubscribe[]
  private readonly motionQuery: MediaQueryList | null

  private bricksRef: readonly Brick[] = []
  private world: World | null = null
  private baseDistance = 100
  private introTimer = 0
  private frameDelta = 0
  private celebrationLeft = 0
  private celebrationTimer = 0
  private trailActive = false
  private contextLost = false
  private shakeScale = 1
  private confettiScale = 1
  private disposed = false

  constructor(container: HTMLElement, bus: GameBus, quality: QualityConfig) {
    this.container = container
    this.bus = bus

    this.renderer = new WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: quality.antialias ? 'high-performance' : 'default',
    })
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = EXPOSURE
    this.renderer.outputColorSpace = SRGBColorSpace
    this.canvas = this.renderer.domElement
    this.canvas.className = GAME_CANVAS_CLASS
    container.appendChild(this.canvas)

    this.camera = new PerspectiveCamera(RENDER.camera.fov, 1, 1, 400)
    this.sceneBuilder = new SceneBuilder(this.scene, this.textures)

    this.bricks = new BrickRenderer(this.textures)
    this.actors = new ActorRenderer(this.textures)
    this.confetti = new ConfettiSystem(this.textures.brickPaper)
    this.waves = new ExplosionWaves()
    this.trail = new BallTrail(this.textures.glow)
    this.sceneBuilder.board.add(
      this.bricks.object,
      this.actors.object,
      this.confetti.object,
      this.waves.object,
      this.trail.object,
    )

    this.postFX = new PostFX(this.renderer, this.scene, this.camera, quality.bloom)
    this.unsubscribers = this.wireEvents()

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.motionQuery = matchMedia?.(REDUCED_MOTION_QUERY) ?? null
    this.applyMotionPreference()
    this.motionQuery?.addEventListener('change', this.applyMotionPreference)

    this.viewport = new ViewportManager(container, this.applyViewport, {
      maxPixelRatio: quality.maxPixelRatio,
    })
    this.viewport.attach()
  }

  syncWorld(world: World, alpha: number): void {
    if (this.contextLost) return
    this.world = world
    if (world.bricks !== this.bricksRef) {
      this.bricksRef = world.bricks
      this.bricks.setBricks(world.bricks)
      this.actors.clear()
      this.confetti.clear()
      this.waves.clear()
      this.trail.clear()
    }
    this.bricks.sync()
    this.actors.sync(world, alpha)
    this.trailActive = this.followTrail(world, alpha)
  }

  update(dt: number): void {
    if (this.contextLost) return
    this.frameDelta = dt
    this.shake.update(dt)
    this.sceneBuilder.update(dt)
    this.bricks.animate(dt)
    this.actors.animate(dt)
    this.confetti.update(dt)
    this.waves.update(dt)
    this.trail.update(dt, this.trailActive)
    this.updateIntro(dt)
    this.updateCelebration(dt)
  }

  render(): void {
    if (this.contextLost) return
    const intro = this.introTimer / RENDER.levelIntro.duration
    this.camera.position.set(
      this.shake.offsetX(),
      RENDER.camera.tilt + this.shake.offsetY(),
      this.baseDistance * (1 + RENDER.camera.dolly * intro),
    )
    this.camera.lookAt(0, 0, 0)
    this.camera.rotation.z += this.shake.roll()
    this.postFX.render(this.frameDelta)
  }

  /** Maps a pointer event to a world x on the play plane (mouse, touch, pen). */
  screenToWorldX(clientX: number, clientY: number): number {
    const rect = this.container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return 0
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.hitPoint)
    return hit === null ? 0 : clamp(hit.x, -FIELD.halfWidth, FIELD.halfWidth)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers.length = 0
    this.viewport.dispose()
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.motionQuery?.removeEventListener('change', this.applyMotionPreference)
    this.trail.dispose()
    this.waves.dispose()
    this.confetti.dispose()
    this.actors.dispose()
    this.bricks.dispose()
    this.sceneBuilder.dispose()
    this.postFX.dispose()
    this.textures.dispose()
    this.renderer.dispose()
    // React StrictMode remounts the canvas host; release the context eagerly.
    this.renderer.forceContextLoss()
    this.canvas.remove()
  }

  private wireEvents(): Unsubscribe[] {
    return [
      this.bus.on('brickDestroyed', ({ pos, color, type, chain }) => {
        this.confetti.burst(
          pos.x,
          pos.y,
          RENDER.depth.confetti,
          color,
          this.effectCount(chain ? CONFETTI.chain : CONFETTI.brick),
        )
        this.addTrauma(chain ? TRAUMA.chain : TRAUMA.brick)
        if (type === 'explosive') {
          this.waves.spawn(pos.x, pos.y, RENDER.depth.brick + 1, color)
          this.addTrauma(TRAUMA.chain)
        }
      }),
      this.bus.on('brickDamaged', ({ pos, color }) => {
        this.confetti.burst(
          pos.x,
          pos.y,
          RENDER.depth.confetti,
          color,
          this.effectCount(CONFETTI.damaged),
        )
        this.addTrauma(TRAUMA.damaged)
      }),
      this.bus.on('paddleHit', ({ strength }) => {
        this.actors.pulsePaddle()
        this.addTrauma(TRAUMA.paddleBase + TRAUMA.paddleStrength * strength)
      }),
      this.bus.on('wallHit', ({ strength }) => {
        this.addTrauma(TRAUMA.wall * strength)
      }),
      this.bus.on('laserFired', () => {
        this.addTrauma(TRAUMA.laser)
      }),
      this.bus.on('powerUpCollected', ({ type }) => {
        this.addTrauma(TRAUMA.collect)
        this.burstOnPaddle(hexToInt(PALETTE.powerUp[type]))
      }),
      this.bus.on('lifeLost', () => {
        this.addTrauma(TRAUMA.life)
      }),
      this.bus.on('levelChanged', () => {
        this.startIntro()
      }),
      this.bus.on('statusChanged', ({ to }) => {
        this.onStatusChanged(to)
      }),
    ]
  }

  private onStatusChanged(status: GameStatus): void {
    switch (status) {
      case 'playing':
        this.shake.reset()
        this.startIntro()
        break
      case 'levelComplete':
        this.celebrationLeft = CELEBRATION_BURSTS
        this.celebrationTimer = 0
        break
      case 'gameOver':
        this.addTrauma(TRAUMA.gameOver)
        break
      case 'menu':
      case 'paused':
        break
    }
  }

  /** Camera shake is skipped entirely when reduced motion is requested. */
  private addTrauma(amount: number): void {
    this.shake.addTrauma(amount * this.shakeScale)
  }

  private effectCount(count: number): number {
    return Math.max(1, Math.round(count * this.confettiScale))
  }

  /**
   * Reduced motion keeps the game readable: no camera shake and a calmer
   * confetti shower, but the brick feedback itself must stay visible.
   */
  private readonly applyMotionPreference = (): void => {
    const reduced = this.motionQuery?.matches === true
    this.shakeScale = reduced ? 0 : 1
    this.confettiScale = reduced ? CALM_CONFETTI_RATIO : 1
    if (reduced) this.shake.reset()
  }

  /**
   * Chrome drops the GL context when the GPU resets or the tab is starved;
   * the canvas keeps existing but every draw is a no-op, so the engine is
   * paused and the UI is told to offer a reload instead of a frozen board.
   */
  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.contextLost = true
    this.bus.emit('engineError', { kind: 'context', message: CONTEXT_LOST_MESSAGE })
  }

  private readonly handleContextRestored = (): void => {
    this.contextLost = false
    this.viewport.notify()
  }

  private burstOnPaddle(colour: number): void {
    const world = this.world
    if (world === null) return
    this.confetti.burst(
      world.paddle.pos.x,
      world.paddle.pos.y + world.paddle.halfHeight,
      RENDER.depth.confetti,
      colour,
      CONFETTI.pickup,
    )
  }

  /** Follows the first flying ball, so the trail reads as one clean ribbon. */
  private followTrail(world: World, alpha: number): boolean {
    for (const ball of world.balls) {
      if (!ball.active || ball.stuck) continue
      this.trail.follow(lerp(ball.prev.x, ball.pos.x, alpha), lerp(ball.prev.y, ball.pos.y, alpha))
      return true
    }
    return false
  }

  private startIntro(): void {
    this.introTimer = RENDER.levelIntro.duration
  }

  private updateIntro(dt: number): void {
    if (this.introTimer <= 0) return
    this.introTimer = Math.max(0, this.introTimer - dt)
    const progress = 1 - this.introTimer / RENDER.levelIntro.duration
    const eased = 1 - (1 - progress) ** 3
    if (this.introTimer === 0) {
      this.sceneBuilder.board.scale.setScalar(1)
      this.sceneBuilder.board.rotation.z = 0
      return
    }
    this.sceneBuilder.board.scale.setScalar(lerp(RENDER.levelIntro.scaleFrom, 1, eased))
    this.sceneBuilder.board.rotation.z = (1 - eased) * RENDER.levelIntro.tilt
  }

  private updateCelebration(dt: number): void {
    if (this.celebrationLeft <= 0) return
    this.celebrationTimer -= dt
    if (this.celebrationTimer > 0) return
    this.celebrationTimer = CELEBRATION_INTERVAL
    this.celebrationLeft -= 1
    const count = this.effectCount(CONFETTI.celebration)
    if (count === 0) return
    this.confetti.shower(FIELD.halfWidth, FIELD.halfHeight - 2, CELEBRATION_COLOURS, count)
  }

  /** Sizes the canvas and reframes the camera for the measured viewport. */
  private readonly applyViewport = (size: ViewportSize): void => {
    this.renderer.setPixelRatio(size.pixelRatio)
    this.renderer.setSize(size.width, size.height, true)

    const aspect = size.width / size.height
    this.camera.aspect = aspect
    this.baseDistance = this.fitDistance(aspect)
    this.camera.updateProjectionMatrix()
    this.postFX.setSize(size.width, size.height, size.pixelRatio)
  }

  /** Camera distance that frames the field with a diorama margin on both axes. */
  private fitDistance(aspect: number): number {
    const halfFov = Math.tan((RENDER.camera.fov * DEG2RAD) / 2)
    const vertical = (FIELD.halfHeight * RENDER.camera.margin) / halfFov
    const horizontal = (FIELD.halfWidth * RENDER.camera.margin) / (halfFov * aspect)
    return Math.max(vertical, horizontal)
  }
}
