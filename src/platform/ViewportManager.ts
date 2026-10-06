import { RENDER } from '../config/gameConfig'

export interface ViewportSize {
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
}

export type ViewportListener = (size: ViewportSize) => void

export interface ViewportOptions {
  /** Cap for `window.devicePixelRatio`; defaults to `RENDER.maxPixelRatio`. */
  readonly maxPixelRatio?: number
}

/**
 * Keeps a canvas host matched to the visual viewport. It listens to element
 * resizes, window `resize`/`orientationchange` and `visualViewport` changes
 * (the Android address bar and WebView quirks fire those without a real element
 * resize) and hands out width/height/pixel-ratio with the device ratio capped
 * so phone GPUs do not push four times the pixels. This module only measures:
 * scene and camera logic stay out of it, and listeners are released on dispose.
 */
export class ViewportManager {
  private readonly container: HTMLElement
  private readonly listener: ViewportListener
  private readonly maxPixelRatio: number
  private readonly observer: ResizeObserver | null
  private readonly visualViewport: VisualViewport | null
  private attached = false
  private width = 0
  private height = 0
  private pixelRatio = 0

  constructor(container: HTMLElement, listener: ViewportListener, options: ViewportOptions = {}) {
    this.container = container
    this.listener = listener
    this.maxPixelRatio = options.maxPixelRatio ?? RENDER.maxPixelRatio
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.notify)
    this.visualViewport = globalThis.window?.visualViewport ?? null
  }

  attach(): void {
    if (this.attached) return
    this.attached = true
    this.observer?.observe(this.container)
    globalThis.addEventListener('resize', this.notify)
    globalThis.addEventListener('orientationchange', this.notify)
    this.visualViewport?.addEventListener('resize', this.notify)
    this.visualViewport?.addEventListener('scroll', this.notify)
    this.notify()
  }

  dispose(): void {
    if (!this.attached) return
    this.attached = false
    this.observer?.disconnect()
    globalThis.removeEventListener('resize', this.notify)
    globalThis.removeEventListener('orientationchange', this.notify)
    this.visualViewport?.removeEventListener('resize', this.notify)
    this.visualViewport?.removeEventListener('scroll', this.notify)
  }

  /** Re-measures the host; the listener only hears about actual changes. */
  readonly notify = (): void => {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, this.maxPixelRatio)
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return
    this.width = width
    this.height = height
    this.pixelRatio = pixelRatio
    this.listener({ width, height, pixelRatio })
  }
}
