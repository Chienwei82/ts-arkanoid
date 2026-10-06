import { PHYSICS } from '../config/gameConfig'

export interface LoopHandlers {
  /** Runs at a fixed timestep for deterministic simulation. */
  update(fixedDelta: number): void
  /** Runs once per animation frame with the interpolation factor alpha. */
  render(alpha: number, frameDelta: number): void
  /** Reports a handler failure; the loop stops so it cannot spam every frame. */
  onError?(error: unknown, phase: 'update' | 'render'): void
}

/**
 * requestAnimationFrame driver with a fixed-timestep accumulator: physics
 * always steps by PHYSICS.fixedStep, render receives leftover/step as alpha so
 * the renderer can interpolate between the last two simulation states.
 *
 * Two safety valves keep a stalled or broken frame from ruining the run: the
 * per-frame step budget caps catch-up work after a hitch, and handler failures
 * stop the loop through onError instead of leaving a dead rAF chain behind.
 * A third one suspends rendering entirely while the tab is hidden, so a game in
 * the background burns neither GPU nor battery.
 */
export class GameLoop {
  private readonly handlers: LoopHandlers
  private readonly step: number
  private readonly maxSteps: number
  private readonly tick = (now: number): void => {
    if (!this.running || this.suspended) return
    const frameDelta = Math.min((now - this.lastTime) / 1000, this.maxDelta)
    this.lastTime = now
    this.accumulator += frameDelta

    let phase: 'update' | 'render' = 'update'
    try {
      let steps = 0
      while (this.accumulator >= this.step && steps < this.maxSteps) {
        this.handlers.update(this.step)
        this.accumulator -= this.step
        steps += 1
      }
      if (steps === this.maxSteps) this.accumulator = 0
      phase = 'render'
      this.handlers.render(this.accumulator / this.step, frameDelta)
    } catch (error) {
      this.stop()
      this.handlers.onError?.(error, phase)
      return
    }
    this.rafId = requestAnimationFrame(this.tick)
  }

  private readonly maxDelta: number
  private rafId = 0
  private running = false
  private suspended = false
  private lastTime = 0
  private accumulator = 0

  private readonly handleVisibility = (): void => {
    if (globalThis.document?.visibilityState === 'hidden') this.suspend()
    else this.resume()
  }

  constructor(handlers: LoopHandlers) {
    this.handlers = handlers
    this.step = PHYSICS.fixedStep
    this.maxDelta = PHYSICS.maxFrameDelta
    this.maxSteps = Math.max(1, Math.ceil(this.maxDelta / this.step))
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    globalThis.document?.addEventListener('visibilitychange', this.handleVisibility)
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    this.suspended = false
    globalThis.document?.removeEventListener('visibilitychange', this.handleVisibility)
    // Only cancel a frame this loop actually scheduled, and stay safe on hosts
    // without a browser scheduler (headless tests).
    if (this.rafId !== 0) globalThis.cancelAnimationFrame?.(this.rafId)
    this.rafId = 0
  }

  /** Freezes the frame chain while the tab is hidden; resume re-arms it. */
  private suspend(): void {
    if (!this.running || this.suspended) return
    this.suspended = true
    if (this.rafId !== 0) globalThis.cancelAnimationFrame?.(this.rafId)
    this.rafId = 0
  }

  private resume(): void {
    if (!this.running || !this.suspended) return
    this.suspended = false
    // The wall clock kept moving while hidden: restart cleanly instead of
    // handing the accumulated gap to the simulation.
    this.lastTime = performance.now()
    this.accumulator = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  get isRunning(): boolean {
    return this.running
  }
}
