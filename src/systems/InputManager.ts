export interface InputFrame {
  axis: number
  pointerX: number | null
  launch: boolean
  fire: boolean
  togglePause: boolean
  start: boolean
  toggleHelp: boolean
}

/** Shared zero frame for headless mode (tests) when no input is attached. */
export const EMPTY_INPUT_FRAME: InputFrame = Object.freeze({
  axis: 0,
  pointerX: null,
  launch: false,
  fire: false,
  togglePause: false,
  start: false,
  toggleHelp: false,
})

export type PointerMapper = (clientX: number, clientY: number) => number

/**
 * Listens to keyboard/pointer/visibility on the window and canvas container,
 * then hands out one reusable InputFrame per fixed step (edge flags are
 * consumed on read so a single key press never fires twice).
 */
export class InputManager {
  private readonly frame: InputFrame = {
    axis: 0,
    pointerX: null,
    launch: false,
    fire: false,
    togglePause: false,
    start: false,
    toggleHelp: false,
  }
  private readonly target: HTMLElement | null
  private readonly mapPointer: PointerMapper | null
  private readonly onHidden: () => void
  private left = false
  private right = false
  private fireHeld = false
  private edgeLaunch = false
  private edgePause = false
  private edgeStart = false
  private edgeHelp = false
  private pointerWorldX: number | null = null
  private attached = false

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.left = true
        // Keyboard takes over definitively: a stale pointer target would
        // otherwise yank the paddle back as soon as the key is released.
        this.pointerWorldX = null
        event.preventDefault()
        break
      case 'ArrowRight':
      case 'KeyD':
        this.right = true
        this.pointerWorldX = null
        event.preventDefault()
        break
      case 'Space':
        event.preventDefault()
        this.fireHeld = true
        if (!event.repeat) {
          this.edgeLaunch = true
          this.edgeStart = true
        }
        break
      case 'Enter':
        if (!event.repeat) this.edgeStart = true
        break
      case 'Escape':
      case 'KeyP':
        if (!event.repeat) this.edgePause = true
        break
      case 'KeyH':
        if (!event.repeat) this.edgeHelp = true
        break
      default:
        break
    }
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.left = false
        break
      case 'ArrowRight':
      case 'KeyD':
        this.right = false
        break
      case 'Space':
        this.fireHeld = false
        break
      default:
        break
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerWorldX = this.mapPointer?.(event.clientX, event.clientY) ?? null
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerWorldX = this.mapPointer?.(event.clientX, event.clientY) ?? null
    this.edgeLaunch = true
    this.fireHeld = true
  }

  private readonly handlePointerUp = (): void => {
    this.fireHeld = false
  }

  private readonly handleBlur = (): void => {
    this.releaseModifiers()
    // Losing focus mid-flight would otherwise keep the ball moving off-screen.
    this.onHidden()
  }

  private readonly handleContextMenu = (event: Event): void => {
    // Long-press on mobile and right-click would interrupt play with a menu.
    event.preventDefault()
  }

  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== 'hidden') return
    this.releaseModifiers()
    this.onHidden()
  }

  constructor(target: HTMLElement | null, mapPointer: PointerMapper | null, onHidden: () => void) {
    this.target = target
    this.mapPointer = mapPointer
    this.onHidden = onHidden
  }

  attach(): void {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerUp)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.target?.addEventListener('pointermove', this.handlePointerMove)
    this.target?.addEventListener('pointerdown', this.handlePointerDown)
    this.target?.addEventListener('contextmenu', this.handleContextMenu)
  }

  dispose(): void {
    if (!this.attached) return
    this.attached = false
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.target?.removeEventListener('pointermove', this.handlePointerMove)
    this.target?.removeEventListener('pointerdown', this.handlePointerDown)
    this.target?.removeEventListener('contextmenu', this.handleContextMenu)
  }

  /** Reuses the same frame object; consume its values before the next call. */
  takeFrame(): InputFrame {
    this.frame.axis = (this.right ? 1 : 0) - (this.left ? 1 : 0)
    this.frame.pointerX = this.pointerWorldX
    this.frame.launch = this.edgeLaunch
    this.frame.fire = this.fireHeld
    this.frame.togglePause = this.edgePause
    this.frame.start = this.edgeStart
    this.frame.toggleHelp = this.edgeHelp
    this.edgeLaunch = false
    this.edgePause = false
    this.edgeStart = false
    this.edgeHelp = false
    return this.frame
  }

  private releaseModifiers(): void {
    this.left = false
    this.right = false
    this.fireHeld = false
  }
}
