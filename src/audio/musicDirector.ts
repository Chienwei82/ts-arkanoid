/**
 * MusicDirector: the only music piece the game knows about. It exposes the
 * lifecycle (start/stop/setIntensity), the on/off toggle (enable/disable/
 * toggle/isEnabled) and the coordination with pause and a hidden tab. The audio
 * engine is created only after the first user gesture (autoplay policy).
 */
import { FADE_OUT_S } from './musicConstants'
import { clamp01 } from './musicPatterns'
import { MusicEngine } from './musicEngine'

export class MusicDirector {
  private engine: MusicEngine | null = null
  private enabled = true
  private unlocked = false
  private playing = false
  private paused = false
  private hidden = false
  private started = false
  private intensity = 0
  private seed = 1
  private disableTimer = 0

  /** Call from a user gesture (click, key or touch). */
  unlock(): void {
    this.unlocked = true
    this.playIfDesired()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** Turns the music on (it does not create the AudioContext without a gesture). */
  enable(): void {
    if (this.enabled) return
    this.enabled = true
    window.clearTimeout(this.disableTimer)
    this.playIfDesired()
  }

  /**
   * Turns the music off: short fade-out and, when done, the scheduler stops and
   * the AudioContext is suspended (zero CPU while off).
   */
  disable(): void {
    if (!this.enabled) return
    this.enabled = false
    window.clearTimeout(this.disableTimer)
    const eng = this.engine
    if (eng === null) return
    eng.stop(FADE_OUT_S)
    this.disableTimer = window.setTimeout(
      () => {
        if (!this.enabled) this.engine?.setHidden(true)
      },
      FADE_OUT_S * 1000 + 100,
    )
  }

  toggle(): void {
    if (this.enabled) this.disable()
    else this.enable()
  }

  /** Starts the song of a run: the same seed always yields the same song. */
  start(seed: number): void {
    this.seed = seed >>> 0
    this.playing = true
    this.paused = false
    this.started = false
    this.intensity = 0
    this.playIfDesired()
  }

  /** Stops the music (fade-out and scheduler stopped). */
  stop(): void {
    this.playing = false
    this.started = false
    this.engine?.stop(FADE_OUT_S)
  }

  /** Soft close when the run ends (cadence + long fade). */
  resolveEnding(): void {
    this.playing = false
    this.started = false
    this.engine?.resolveEnding()
  }

  /** The game only calls this every frame; it knows nothing about the audio. */
  setIntensity(value: number): void {
    this.intensity = clamp01(value)
    this.engine?.setIntensity(this.intensity)
  }

  /** Game or help pause: silence with a fade and a soft resume. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) this.engine?.stop(FADE_OUT_S)
    else this.playIfDesired()
  }

  /** Hidden tab: on top of muting, suspends the AudioContext. */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return
    this.hidden = hidden
    if (hidden) {
      this.engine?.setHidden(true)
      return
    }
    this.engine?.setHidden(false)
    this.playIfDesired()
  }

  dispose(): void {
    window.clearTimeout(this.disableTimer)
    this.engine?.dispose()
    this.engine = null
    this.playing = false
    this.started = false
  }

  private playIfDesired(): void {
    if (!this.enabled || !this.unlocked || !this.playing || this.paused || this.hidden) return
    const eng = this.ensureEngine()
    if (eng === null) return
    if (this.started) {
      if (!eng.running) eng.resumePlayback()
    } else {
      eng.start(this.seed, this.intensity)
      this.started = true
    }
  }

  /** Creates the engine inside a gesture; returns null if the browser blocks it. */
  private ensureEngine(): MusicEngine | null {
    try {
      if (this.engine === null) {
        this.engine = new MusicEngine()
        this.engine.setIntensity(this.intensity)
      }
      return this.engine
    } catch {
      return null
    }
  }
}
