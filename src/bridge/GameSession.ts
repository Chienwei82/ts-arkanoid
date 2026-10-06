import { SCORING } from '../config/gameConfig'
import type { Unsubscribe } from '../core/EventBus'
import { Game } from '../core/Game'
import { GAME_CANVAS_CLASS, RendererInitError } from '../core/renderer'
import type { RendererFactory } from '../core/renderer'
import type { HudError, HudState } from '../core/types'
import { LEVELS, type LevelDefinition } from '../levels'
import { TouchInput } from '../systems/TouchInput'
import { IS_DEV } from '../utils/env'
import { createLocalStorageRecord, type RecordStorage } from '../utils/storage'
import type { GameFacade } from './GameFacade'

export interface GameSessionOptions {
  /** Injected by the composition root so this module stays three.js-free. */
  readonly createRenderer?: RendererFactory
  readonly storage?: RecordStorage
  readonly levels?: readonly LevelDefinition[]
  /** Shared with the on-screen touch controls; defaults to a private one. */
  readonly touchInput?: TouchInput
}

const UNSUPPORTED_WEBGL_MESSAGE =
  'Tu navegador no puede crear un contexto WebGL. Activa la aceleración por hardware o prueba otro navegador.'
const ENGINE_START_MESSAGE =
  'No se pudo iniciar el motor del juego. Recarga la página o vuelve a empezar.'

/**
 * Bridge between the engine and React (external store).
 *
 * It owns the Game instance for one mounted canvas: `attach` builds the engine,
 * mirrors its HUD events into a cached snapshot and `getSnapshot`/`subscribe`
 * feed `useSyncExternalStore`. Detaching disposes the engine completely, which
 * is what makes React StrictMode's double mount safe.
 */
export class GameSession implements GameFacade {
  private readonly options: GameSessionOptions
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribers: Unsubscribe[] = []
  private game: Game | null = null
  private snapshot: HudState
  private error: HudError | null = null

  constructor(options: GameSessionOptions = {}) {
    this.options = options
    this.touch = options.touchInput ?? new TouchInput()
    this.snapshot = this.idleSnapshot()
  }

  /** Engine handle, exposed read-only for diagnostics. */
  get engine(): Game | null {
    return this.game
  }

  /** Survives attach/detach cycles so the touch widgets keep their state. */
  readonly touch: TouchInput

  readonly getSnapshot = (): HudState => this.snapshot

  readonly subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  attach(container: HTMLElement | null): () => void {
    this.detach()
    let game: Game
    try {
      game = new Game({
        container,
        createRenderer: this.options.createRenderer,
        storage: this.options.storage,
        levels: this.options.levels,
        touchInput: this.touch,
      })
    } catch (cause) {
      // Renderer failures ("no WebGL at all": old browser, blocked context) get
      // a friendly explanation; anything else is an engine start-up failure and
      // must not masquerade as an unsupported device.
      this.error =
        cause instanceof RendererInitError
          ? { kind: 'unsupported', message: UNSUPPORTED_WEBGL_MESSAGE }
          : { kind: 'engine', message: ENGINE_START_MESSAGE }
      // A partially built renderer may have appended its canvas already.
      container?.querySelector(`canvas.${GAME_CANVAS_CLASS}`)?.remove()
      // Keep the original failure visible for debugging without breaking the UI.
      if (IS_DEV) console.error('[start]', cause)
      this.snapshot = { ...this.idleSnapshot(), error: this.error }
      this.emit()
      return () => undefined
    }
    this.game = game
    this.unsubscribers.push(
      game.bus.on('statusChanged', this.publish),
      game.bus.on('helpChanged', this.publish),
      game.bus.on('scoreChanged', this.publish),
      game.bus.on('recordChanged', this.publish),
      game.bus.on('livesChanged', this.publish),
      game.bus.on('levelChanged', this.publish),
      game.bus.on('powerUpsChanged', this.publish),
      game.bus.on('gameOver', this.publish),
      game.bus.on('engineError', ({ kind, message }) => {
        this.error = { kind, message }
        this.game?.stopEngine()
        this.publish()
      }),
    )
    this.publish()
    // Only a mounted container owns a render loop; headless sessions are driven
    // step by step (tests), so they must not touch requestAnimationFrame.
    if (container !== null) game.startEngine()
    return () => {
      if (this.game === game) this.detach()
    }
  }

  start(): void {
    if (this.error !== null) return
    this.game?.startRun()
  }

  togglePause(): void {
    this.game?.requestTogglePause()
  }

  toggleHelp(): void {
    this.game?.requestToggleHelp()
  }

  quitToMenu(): void {
    this.game?.requestQuitToMenu()
  }

  nextLevel(): void {
    this.game?.requestNextLevel()
  }

  reload(): void {
    globalThis.location?.reload()
  }

  private detach(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe()
    this.game?.dispose()
    this.game = null
    this.error = null
    this.snapshot = this.idleSnapshot()
    this.emit()
  }

  private readonly publish = (): void => {
    const game = this.game
    if (game === null) return
    this.snapshot = { ...game.getHudState(), error: this.error }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private idleSnapshot(): HudState {
    const levels = this.options.levels ?? LEVELS
    const storage = this.options.storage ?? createLocalStorageRecord()
    return {
      status: 'menu',
      score: 0,
      lives: SCORING.startLives,
      combo: 0,
      multiplier: 1,
      record: storage.load(),
      levelIndex: 0,
      levelName: levels[0]?.name ?? '',
      levelTotal: levels.length,
      powerUps: [],
      isRecord: false,
      isFinalLevel: false,
      helpVisible: true,
      error: null,
    }
  }
}
