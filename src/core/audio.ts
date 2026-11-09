import type { GameBus } from './EventBus'

/**
 * Per-frame intensity inputs the engine feeds to the audio subsystem. They are
 * plain, already-normalized numbers: what they mean musically is decided by
 * `src/audio`, so the engine never grows audio concepts.
 */
export interface AudioSignals {
  /** Pressure from spent lives: 0 with full lives, 1 on the last one. */
  readonly danger: number
  /** Campaign progress (0 = first level, 1 = last). */
  readonly level: number
  /** Fraction of destructible bricks destroyed in the current level (0..1). */
  readonly clearance: number
  /** Raw combo counter (the multiplier source); clipped by the audio layer. */
  readonly combo: number
}

/** Music genre id: part of the GameAudio contract, kept in core to avoid
 *  a circular dependency with src/audio. */
export type GenreId = 'electronic' | 'pop' | 'techno' | 'dance' | 'classic'

export const GENRE_IDS: readonly GenreId[] = [
  'electronic',
  'pop',
  'techno',
  'dance',
  'classic',
] as const

/**
 * Audio boundary: the engine drives `update` every frame, while the bridge/UI
 * own the rest of the lifecycle (unlock, mute, dispose). The engine depends on
 * this interface only, which keeps `src/audio` out of the core exactly like
 * `GameRenderer` keeps three.js out.
 */
export interface GameAudio {
  /** Mute state; surfaced in the HUD so React can render its toggle. */
  readonly enabled: boolean
  /** Current music genre; surfaced in the HUD so React can render its selector. */
  readonly genre: GenreId
  /** Subscribes to the engine event bus (SFX, intensity pulses, lifecycle). */
  bind(bus: GameBus): void
  unbind(): void
  /** First user gesture: creates/resumes the AudioContext (autoplay policy). */
  unlock(): void
  /** Flips mute; returns the new state so callers can persist it. */
  toggle(): boolean
  /** Selects a music genre and persists the choice. */
  setGenre(genreId: GenreId): void
  /** Per-frame intensity feed from the engine. */
  update(dt: number, signals: AudioSignals): void
  dispose(): void
}
