/**
 * IntensityTracker: turns game signals into a single smoothed `intensity`
 * parameter (0..1). Pure module (no DOM, no WebAudio) and therefore testable in
 * Node.
 *
 * The signals Paper Breaker has to work with: how many lives are left (the real
 * source of tension in a breakout), how deep into the campaign the player is,
 * how much of the current wall has already been broken (closing in on the level
 * clear) and the running combo. Point events — brick breaks, chains, explosions,
 * power-ups, level clears — are added as short-lived pulses on top of that.
 */
import { EVENT_DECAY_TAU_S, SMOOTHING_DOWN_S, SMOOTHING_UP_S } from './musicConstants'

/** Game signals already normalized by whoever calls `update`. */
export interface IntensitySignals {
  /** Pressure from spent lives: 0 with full lives, 1 on the last one. */
  danger: number
  /** Campaign progress (0 = first level, 1 = last). */
  level: number
  /** Fraction of destructible bricks destroyed in the current level (0..1). */
  clearance: number
  /** Raw combo counter (the multiplier source); clipped internally. */
  combo: number
}

export type IntensityEventKind = 'break' | 'chain' | 'explode' | 'powerup' | 'life' | 'levelclear'

/** A brick break is meant to be the lightest, most frequent spark. */
export const PULSE_BY_EVENT: Record<IntensityEventKind, number> = {
  break: 0.1,
  chain: 0.22,
  explode: 0.18,
  powerup: 0.12,
  life: 0.3,
  levelclear: 0.2,
}

const WEIGHT_DANGER = 0.4
const WEIGHT_LEVEL = 0.15
const WEIGHT_CLEARANCE = 0.25
const WEIGHT_COMBO = 0.2
const COMBO_CLIP = 12
const PULSE_CLIP = 0.35
const MAX_DT_S = 0.25

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export interface TrackerOptions {
  smoothingUp?: number
  smoothingDown?: number
  decayTau?: number
}

export class IntensityTracker {
  private value = 0
  private pulse = 0
  private readonly upTau: number
  private readonly downTau: number
  private readonly decayTau: number

  constructor(opts: TrackerOptions = {}) {
    this.upTau = opts.smoothingUp ?? SMOOTHING_UP_S
    this.downTau = opts.smoothingDown ?? SMOOTHING_DOWN_S
    this.decayTau = opts.decayTau ?? EVENT_DECAY_TAU_S
  }

  /** Returns to calm (new level / new run). */
  reset(): void {
    this.value = 0
    this.pulse = 0
  }

  /** Registers a moment that briefly raises the tension. */
  event(kind: IntensityEventKind): void {
    this.pulse = Math.min(PULSE_CLIP, this.pulse + (PULSE_BY_EVENT[kind] ?? 0))
  }

  get current(): number {
    return this.value
  }

  /** Smoothing step; returns the already filtered intensity. */
  update(dt: number, s: IntensitySignals): number {
    const step = Math.max(0, Math.min(dt, MAX_DT_S))
    this.pulse *= Math.exp(-step / this.decayTau)
    const base =
      WEIGHT_DANGER * clamp01(s.danger) +
      WEIGHT_LEVEL * clamp01(s.level) +
      WEIGHT_CLEARANCE * clamp01(s.clearance) +
      WEIGHT_COMBO * Math.min(1, Math.max(0, s.combo) / COMBO_CLIP)
    const target = clamp01(base + this.pulse)
    // Asymmetric exponential filter: it rises quickly and comes down calmly.
    const tau = target > this.value ? this.upTau : this.downTau
    const k = 1 - Math.exp(-step / tau)
    this.value += (target - this.value) * k
    return this.value
  }
}
