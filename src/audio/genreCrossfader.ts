/**
 * GenreCrossfader: coordinates crossfading between music genres.
 *
 * The crossfade is quantized to the next bar boundary and uses a short
 * master-gain dip so the transition never cuts audio abruptly. The
 * MusicEngine applies the new profile at the start of the next bar;
 * voices already playing from the old genre fade out through their
 * natural envelopes while new voices use the new timbres.
 */
import type { GenreProfile } from './genre'

/** How long the master gain dips during a genre change (seconds). */
export const CROSSFADE_DIP_S = 0.12
/** How long the master gain takes to recover after the dip (seconds). */
export const CROSSFADE_RECOVER_S = 0.25

export interface GenreCrossfaderOptions {
  /** Callback invoked when the engine should switch profiles on the next bar. */
  readonly onSwitchProfile: (profile: GenreProfile) => void
  /** Callback to dip/recover master gain. */
  readonly onFadeMaster: (target: number, seconds: number) => void
}

export class GenreCrossfader {
  private readonly onSwitchProfile: (profile: GenreProfile) => void
  private readonly onFadeMaster: (target: number, seconds: number) => void
  private state: 'idle' | 'dipping' | 'switched' | 'recovering' = 'idle'
  private timer = 0
  private pendingProfile: GenreProfile | null = null

  constructor(options: GenreCrossfaderOptions) {
    this.onSwitchProfile = options.onSwitchProfile
    this.onFadeMaster = options.onFadeMaster
  }

  /** Request a genre change. Returns true if a transition was started. */
  request(profile: GenreProfile): boolean {
    if (this.state !== 'idle') return false
    this.pendingProfile = profile
    this.state = 'dipping'
    this.timer = 0
    this.onFadeMaster(0.15, CROSSFADE_DIP_S)
    return true
  }

  /** Returns the profile to use now (null if no switch pending). */
  pending(): GenreProfile | null {
    return this.pendingProfile
  }

  /** Consumes the pending profile: engine applies it at the next bar. */
  consumePending(): GenreProfile | null {
    const p = this.pendingProfile
    this.pendingProfile = null
    return p
  }

  /** Per-frame update (dt in seconds). Drives the crossfade state machine. */
  update(dt: number): void {
    if (this.state === 'idle') return
    this.timer += dt

    if (this.state === 'dipping' && this.timer >= CROSSFADE_DIP_S) {
      // Switch profile on the next bar boundary (engine applies it then).
      const profile = this.consumePending()
      if (profile) this.onSwitchProfile(profile)
      this.state = 'switched'
      this.timer = 0
      this.onFadeMaster(1, CROSSFADE_RECOVER_S)
    } else if (this.state === 'recovering' && this.timer >= CROSSFADE_RECOVER_S) {
      this.state = 'idle'
      this.timer = 0
    } else if (this.state === 'switched') {
      // After switching, move to recovery.
      this.state = 'recovering'
      this.timer = 0
    }
  }

  /** Whether a crossfade is currently in progress. */
  isCrossfading(): boolean {
    return this.state !== 'idle'
  }

  /** Aborts any in-progress crossfade and returns to idle. */
  abort(): void {
    this.state = 'idle'
    this.timer = 0
    this.pendingProfile = null
    this.onFadeMaster(1, CROSSFADE_RECOVER_S)
  }

  dispose(): void {
    this.abort()
  }
}