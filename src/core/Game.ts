import { createBricks } from '../entities/brickFactory'
import { POWER_UPS } from '../config/gameConfig'
import { LEVELS, parseLevels, type LevelDefinition } from '../levels'
import { CollisionSystem } from '../systems/CollisionSystem'
import { InputDispatcher } from '../systems/InputDispatcher'
import { InputManager, type PointerMapper } from '../systems/InputManager'
import { LaserSystem } from '../systems/LaserSystem'
import { PhysicsSystem } from '../systems/PhysicsSystem'
import { PowerUpSystem } from '../systems/PowerUpSystem'
import { ScoringSystem } from '../systems/ScoringSystem'
import { type TouchInput } from '../systems/TouchInput'
import { World } from '../systems/World'
import type { GameEventMap } from './events'
import { EventBus, type GameBus } from './EventBus'
import { GameLoop } from './GameLoop'
import { RendererInitError, type GameRenderer, type RendererFactory } from './renderer'
import type { GameContext } from './state/context'
import { GameStateMachine } from './state/GameStateMachine'
import type { GameStatus, HudState } from './types'
import { clamp } from '../utils/math'
import { IS_DEV } from '../utils/env'
import { createLocalStorageRecord, type RecordStorage } from '../utils/storage'

export interface GameOptions {
  /** DOM host for the canvas; omit for headless (test) usage. */
  readonly container?: HTMLElement | null
  /** Required together with `container`; injected so core never imports three. */
  readonly createRenderer?: RendererFactory
  readonly storage?: RecordStorage
  readonly bus?: GameBus
  readonly levels?: readonly LevelDefinition[]
  /** Shared with the on-screen touch controls; defaults to a private one. */
  readonly touchInput?: TouchInput
}

/**
 * Orchestrator: owns the loop, systems, state machine and renderer, and
 * implements the CommandTarget used by input and the React bridge.
 */
export class Game implements GameContext {
  readonly bus: GameBus
  readonly world: World
  readonly scoring: ScoringSystem
  readonly powerUpSystem: PowerUpSystem
  readonly physics: PhysicsSystem
  readonly collision: CollisionSystem
  readonly laserSystem: LaserSystem
  readonly dispatcher: InputDispatcher
  readonly input: InputManager | null
  readonly levels: readonly LevelDefinition[]
  readonly machine: GameStateMachine

  private readonly renderer: GameRenderer | null
  private readonly loop: GameLoop
  private disposed = false
  /** Help guide overlay: open from the very first frame and toggled with H. */
  private helpVisible = true
  /** Set when opening the guide paused a run that must resume on close. */
  private pausedByHelp = false

  constructor(options: GameOptions = {}) {
    this.bus = options.bus ?? new EventBus<GameEventMap>()
    this.world = new World()
    this.scoring = new ScoringSystem(this.bus, options.storage ?? createLocalStorageRecord())
    this.powerUpSystem = new PowerUpSystem(this.bus)
    this.physics = new PhysicsSystem()
    this.collision = new CollisionSystem(this.bus, this.scoring, this.powerUpSystem)
    this.laserSystem = new LaserSystem(this.bus)
    this.dispatcher = new InputDispatcher(this)
    this.levels = options.levels ?? LEVELS
    // Custom levels go through the same runtime validation as the bundled ones.
    parseLevels(this.levels)

    const container = options.container ?? null
    if (container !== null && options.createRenderer === undefined) {
      throw new Error('Game with a container requires a createRenderer factory')
    }
    try {
      this.renderer =
        container !== null ? (options.createRenderer?.(container, this.bus) ?? null) : null
    } catch (cause) {
      // Renderer failures get their own error class so the UI can explain them.
      throw new RendererInitError(cause)
    }

    const pointerMapper: PointerMapper | null = this.renderer
      ? (clientX, clientY) => this.renderer?.screenToWorldX(clientX, clientY) ?? 0
      : null
    this.input =
      container !== null
        ? new InputManager(container, pointerMapper, () => this.requestPause(), options.touchInput)
        : null

    this.loadLevel(0)
    this.machine = new GameStateMachine(this, 'menu')
    this.loop = new GameLoop({
      update: (dt) => this.updateFixed(dt),
      render: (alpha, frameDelta) => this.renderFrame(alpha, frameDelta),
      onError: (error, phase) => this.reportRuntimeError(error, phase),
    })
    this.input?.attach()
  }

  get status(): GameStatus {
    return this.machine.status
  }

  /** Surfaces an unexpected failure to the UI instead of freezing silently. */
  private reportRuntimeError(error: unknown, phase: 'update' | 'render'): void {
    const message = error instanceof Error ? error.message : `Unknown failure in ${phase}`
    if (IS_DEV) console.error('[engine]', phase, error)
    this.bus.emit('engineError', { kind: 'engine', message })
  }

  // ---- Engine loop -----------------------------------------------------

  startEngine(): void {
    this.loop.start()
  }

  stopEngine(): void {
    this.loop.stop()
  }

  /** One fixed simulation step; called by the loop and directly by tests. */
  updateFixed(dt: number): void {
    this.machine.current.update(this, dt)
  }

  renderFrame(alpha: number, frameDelta: number): void {
    if (this.renderer === null) return
    this.renderer.syncWorld(this.world, alpha)
    if (this.machine.status !== 'paused') this.renderer.update(frameDelta)
    this.renderer.render()
  }

  // ---- CommandTarget ---------------------------------------------------
  // While the help guide is open every command is inert: the overlay is modal
  // and nothing may happen behind it (only requestToggleHelp closes it).

  movePaddleAxis(axis: number): void {
    if (this.helpVisible) return
    this.world.paddle.axisInput = clamp(axis, -1, 1)
  }

  setPaddlePointerTarget(x: number | null): void {
    if (this.helpVisible) return
    this.world.paddle.targetX = x
  }

  requestLaunch(): void {
    if (this.helpVisible) return
    if (this.machine.status !== 'playing') return
    const count = this.world.launchStuckBalls()
    if (count > 0) this.bus.emit('ballLaunched', { count })
  }

  requestTogglePause(): void {
    if (this.helpVisible) return
    if (this.machine.status === 'playing') this.machine.request('paused')
    else if (this.machine.status === 'paused') this.machine.request('playing')
  }

  requestPause(): void {
    if (this.helpVisible) return
    if (this.machine.status === 'playing') this.machine.request('paused')
  }

  /** Contextual confirm: start, resume or advance depending on the screen. */
  requestStart(): void {
    if (this.helpVisible) return
    switch (this.machine.status) {
      case 'menu':
      case 'gameOver':
        this.startRun()
        break
      case 'paused':
        this.machine.request('playing')
        break
      case 'levelComplete':
        this.requestNextLevel()
        break
      case 'playing':
        break
    }
  }

  requestNextLevel(): void {
    if (this.helpVisible) return
    if (this.machine.status !== 'levelComplete') return
    const next = this.world.levelIndex + 1
    if (next >= this.levels.length) {
      this.machine.request('menu')
      return
    }
    this.loadLevel(next)
    this.machine.request('playing')
  }

  requestQuitToMenu(): void {
    if (this.helpVisible) return
    if (this.machine.status === 'menu') return
    // Leaving mid-run must not leave flying balls or drops frozen on screen.
    this.powerUpSystem.reset(this.world)
    this.world.clearTransient()
    this.pausedByHelp = false
    this.machine.request('menu')
  }

  /**
   * Help guide overlay (H key or UI). Opening it mid-run pauses the game so
   * reading never costs a life; closing resumes exactly that run.
   */
  requestToggleHelp(): void {
    this.helpVisible = !this.helpVisible
    if (this.helpVisible && this.machine.status === 'playing') {
      this.pausedByHelp = this.machine.request('paused')
    } else if (!this.helpVisible && this.pausedByHelp) {
      this.pausedByHelp = false
      this.machine.request('playing')
    }
    this.bus.emit('helpChanged', { visible: this.helpVisible })
  }

  startRun(): void {
    if (this.machine.status === 'playing') return
    this.pausedByHelp = false
    this.scoring.resetRun()
    this.world.resetRun()
    this.loadLevel(0)
    this.machine.request('playing')
  }

  // ---- Level lifecycle -------------------------------------------------

  loadLevel(index: number): void {
    const total = this.levels.length
    const safeIndex = ((index % total) + total) % total
    const def = this.levels[safeIndex]
    this.powerUpSystem.reset(this.world)
    this.world.clearTransient()
    this.world.setBricks(createBricks(def), safeIndex, def.name, total)
    this.world.ballSpeed = def.ballSpeed
    this.world.powerUpDropRate = def.powerUpDropRate ?? POWER_UPS.dropChance
    this.bus.emit('levelChanged', { index: safeIndex, name: def.name, total })
  }

  getHudState(): HudState {
    return {
      status: this.machine.status,
      score: this.scoring.score,
      lives: this.world.lives,
      combo: this.scoring.combo,
      multiplier: this.scoring.multiplier,
      record: this.scoring.record,
      levelIndex: this.world.levelIndex,
      levelName: this.world.levelName,
      levelTotal: this.world.levelTotal,
      powerUps: this.powerUpSystem.snapshot(),
      isRecord: this.scoring.isRunRecord,
      isFinalLevel: this.world.levelIndex === this.levels.length - 1,
      helpVisible: this.helpVisible,
      error: null,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.loop.stop()
    this.input?.dispose()
    this.renderer?.dispose()
    this.bus.clear()
  }
}
