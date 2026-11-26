/**
 * Hyperspace jump clockwork. The renderer feeds real frame deltas and the
 * director produces a bounded "sample" (radial smear, streak lines, chromatic
 * split and white flash) that the post-processing stack paints; `null` means
 * idle and therefore "disable the pass".
 *
 * Phases: `depart` ramps up when a level completes, `cruise` holds a calmer
 * speed while the continue screen is up, and `arrive` decelerates to rest
 * while the next level settles in. Pure math, no three.js: testable in Node.
 */
import { RENDER } from '../config/gameConfig'
import { lerp } from '../utils/math'

/** One frame of the jump; every channel is 0..1. */
export interface WarpSample {
  readonly warp: number
  readonly streaks: number
  readonly aberration: number
  readonly flash: number
}

export type WarpPhase = 'idle' | 'depart' | 'cruise' | 'arrive'

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

export class WarpDirector {
  private phase: WarpPhase = 'idle'
  private clock = 0
  private reducedMotion = false

  get active(): boolean {
    return this.phase !== 'idle'
  }

  /** Starts jumping out of the current sector (a level was completed). */
  depart(): void {
    this.phase = 'depart'
    this.clock = 0
  }

  /** Decelerates into the next sector; a no-op when no jump is running. */
  arrive(): void {
    if (this.phase === 'idle') return
    this.phase = 'arrive'
    this.clock = 0
  }

  /** Hard stop: the run ended and the sky must not smear behind the panels. */
  reset(): void {
    this.phase = 'idle'
    this.clock = 0
  }

  /** Reduced motion drops the smear/streaks and keeps a quiet fade only. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
  }

  update(dt: number): WarpSample | null {
    if (this.phase === 'idle') return null
    this.clock += dt
    const config = RENDER.warp
    let sample: WarpSample
    if (this.phase === 'depart') {
      const progress = Math.min(1, this.clock / config.departDuration)
      const blend = easeOutCubic(progress)
      // The take-off eases straight into the cruise plateau, so the sky never
      // snaps; the arrival re-peaks above it masked by the jump thump.
      sample = {
        warp: lerp(0, config.cruise.warp, blend),
        streaks: lerp(0, config.cruise.streaks, blend),
        aberration: lerp(0, config.cruise.aberration, blend),
        flash: flashOf(this.clock, config),
      }
      if (progress >= 1) this.phase = 'cruise'
    } else if (this.phase === 'cruise') {
      sample = {
        warp: config.cruise.warp,
        streaks: config.cruise.streaks,
        aberration: config.cruise.aberration,
        flash: 0,
      }
    } else {
      const progress = Math.min(1, this.clock / config.arriveDuration)
      const blend = easeOutCubic(1 - progress)
      sample = {
        warp: config.peak.warp * blend,
        streaks: config.peak.streaks * blend,
        aberration: config.peak.aberration * blend,
        flash: flashOf(this.clock, config),
      }
      if (progress >= 1) this.phase = 'idle'
    }
    return this.reducedMotion ? calmSample(sample, config) : sample
  }
}

/** White spike that opens every jump phase, gone in a blink. */
const flashOf = (clock: number, config: typeof RENDER.warp): number =>
  clock >= config.flashDuration
    ? 0
    : config.peak.flash * Math.sin((1 - clock / config.flashDuration) * (Math.PI / 2))

/** Reduced-motion version of a sample: no movement channels, quiet flashes. */
const calmSample = (sample: WarpSample, config: typeof RENDER.warp): WarpSample => ({
  warp: 0,
  streaks: 0,
  aberration: sample.aberration * config.reduced.aberration,
  flash: sample.flash * config.reduced.flash,
})
