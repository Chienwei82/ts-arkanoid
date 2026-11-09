/**
 * Musical pattern generation: ALL material derives from (seed, bar) and from
 * the scale — there are never notes outside it. Intensity only acts as a
 * gate/mask (which layers sound and how dense): the same seed always yields the
 * same song, whatever happens during the match.
 */
import {
  BARS_PER_CHORD,
  BEATS_PER_BAR,
  BPM_MAX,
  BPM_MIN,
  CHORD_PROGRESSIONS,
  CHORD_ROOT_DEGREES,
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  GROOVE_BASS_STEPS,
  GROOVE_HAT_STEPS,
  GROOVE_KICK_STEPS,
  GROOVE_SWING,
  HIGH_DENSITY,
  MASK_DENSITY_MAX,
  MASK_DENSITY_MIN,
  MAX_REPEAT,
  MELODY_DEGREES,
  MIN_DEGREES,
  MOTION_TARGET,
  MOTION_WEIGHT,
  REPEAT_WEIGHT,
  ROOT_FREQ,
  SCALE_INTERVALS,
  SONG_BARS,
  STEPS_PER_BAR,
  SWING_S,
  THRESHOLD_ARPEGIO,
  THRESHOLD_BASS,
  THRESHOLD_DRUMS,
  VARIETY_WEIGHT,
} from './musicConstants'
import { DEFAULT_GENRE, type GenreProfile, GENRE_PROFILES } from './genre'
import { mulberry32, rngForBar } from './musicRng'

/** Clamps a value to the 0..1 range. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Frequency (Hz) of a scale degree; >= 7 climbs octaves. */
export function freqForDegree(degree: number, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const intervals = p.scaleIntervals
  const count = intervals.length
  const idx = ((degree % count) + count) % count
  const octaves = Math.floor(degree / count)
  const interval = intervals[idx] ?? 0
  return p.rootFreq * Math.pow(2, (interval + 12 * octaves) / 12)
}

/** Candidate step: it only sounds if `threshold` < the layer's current density. */
export interface MaskedStep {
  step: number // 0..STEPS_PER_BAR-1
  threshold: number // 0..1, fixed per (seed, bar)
}

export interface ArpStep extends MaskedStep {
  degree: number // scale index (>= 7 means the upper octave)
  velocity: number // 0..1
}

export interface BarPattern {
  bar: number
  /** Scale degrees of the chord (root plus diatonic 3rd and 5th). */
  chord: number[]
  /** Swing of this bar: it delays the weak steps (seconds). */
  swing: number
  bass: MaskedStep[]
  arpeggio: ArpStep[]
  kick: MaskedStep[]
  hat: MaskedStep[]
}

/** Song chosen by a seed: the same seed always chooses the same song. */
export interface SongProfile {
  /** Chord progression index (3 options). */
  progression: number
  /** Rhythmic groove index (6 options). */
  groove: number
  /** Rotation of the chord cycle (0..3): which chord opens the song. */
  rotation: number
  /** Arpeggio leap bias (0..1): direction and size of the walk. */
  arpWalk: number
  /** Arpeggio octave bounce (0..1): probability and register. */
  octaveLift: number
}

/** Derives the song profile from a seed deterministically. */
export function songProfile(seed: number, profile?: GenreProfile): SongProfile {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const rng = mulberry32(seed >>> 0)
  const sum = rng() + rng() + rng()
  const progressionCount = p.chordProgressions.length
  // N progressions × 6 grooves × 4 rotations.
  const combo = Math.floor(rng() * (progressionCount * 24))
  const progression = Math.floor(combo / 24) % progressionCount
  const groove = Math.floor((combo % 24) / 4)
  const rotation = combo % 4
  // Triangular distribution on [0,1]: avoids cold or excessive extremes.
  const arpWalk = sum > 1.2 ? 1 - sum / 3 : sum / 3
  const octaveLift = 0.12 + (1 - (sum > 1.2 ? 1 - sum / 3 : sum / 3)) * 0.28
  return { progression, groove, rotation, arpWalk, octaveLift }
}

/**
 * Chord of a bar according to the song: progression chosen by the seed, rotated
 * so the song can open at a different point of the cycle. Triads are always
 * diatonic, so any seed sounds consonant.
 */
export function chordForBar(seed: number, bar: number, profile?: GenreProfile): number[] {
  const song = songProfile(seed, profile)
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const progression = p.chordProgressions[song.progression] ?? p.chordRootDegrees
  const chordIndex = (Math.floor(bar / BARS_PER_CHORD) + song.rotation) % progression.length
  const root = progression[chordIndex] ?? 0
  return [root, root + 2, root + 4]
}

/** Snaps a scale degree to the nearest melody degree of the same octave. */
function snapToPentatonic(degree: number, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const count = p.scaleIntervals.length
  const base = Math.floor(degree / count) * count
  const idx = ((degree % count) + count) % count
  let best: number = p.melodyDegrees[0] ?? 0
  let bestDist = Number.POSITIVE_INFINITY
  for (const m of p.melodyDegrees) {
    const d = Math.abs(m - idx)
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return base + best
}

/**
 * Complete material of one bar: always identical for the same (seed, bar).
 * Density/intensity only decides which steps actually sound.
 */
export function barPattern(seed: number, bar: number, profile?: GenreProfile): BarPattern {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const song = songProfile(seed, p)
  const rng = rngForBar(seed, bar)
  const chord = chordForBar(seed, bar, p)
  const kickSteps = p.groove.kickSteps[song.groove] ?? [0, 8]
  const hatSteps = p.groove.hatSteps[song.groove] ?? [2, 6, 10, 14]
  const bassSteps = p.groove.bassSteps[song.groove] ?? [0]
  const swingEnabled = p.groove.swing[song.groove] ?? false
  const swing = swingEnabled ? p.groove.swingS : 0
  const maskThresholds = [0.5, 0.7, 0.9]
  const masked = (steps: readonly number[]): MaskedStep[] =>
    steps.map((s, i) => ({
      step: s,
      threshold: i === 0 ? 0 : (maskThresholds[(i - 1) % maskThresholds.length] ?? 0.9),
    }))
  const bass = masked(bassSteps)
  const kick = masked(kickSteps)
  const hat = masked(hatSteps)
  const arpeggio: ArpStep[] = []
  let toneIndex = Math.floor(rng() * chord.length)
  let octave = 0
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    // Diatonic walk around the chord: the seed decides direction and leaps.
    const walk = song.arpWalk - 0.5
    const jump = walk === 0 ? 1 : (walk > 0 ? 1 : 2) + (rng() < Math.abs(walk) ? 1 : 0)
    toneIndex =
      (((toneIndex + (walk >= 0 ? jump : -jump)) % chord.length) + chord.length) % chord.length
    if (rng() < song.octaveLift * 0.4) octave = octave === 0 ? 7 : 0
    const tone = chord[toneIndex] ?? 0
    // On-beat steps are cheap candidates; off-beat ones are occasional.
    const onBeat = step % 2 === 0
    const threshold = onBeat ? rng() * 0.55 : 0.55 + rng() * 0.45
    arpeggio.push({
      step,
      threshold,
      degree: snapToPentatonic(tone + octave, p),
      velocity: 0.55 + rng() * 0.45,
    })
  }
  return { bar, chord, swing, bass, arpeggio, kick, hat }
}

/**
 * Quality score of a song (0..100, higher is better) used to pick the curated
 * seeds. It rewards melodic variety, dynamic range and bass movement, and
 * penalizes repetitive or frozen melodies.
 */
export function songScore(seed: number, bars = SONG_BARS, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const degrees = new Set<number>()
  let stepCount = 0
  let repeatStreak = 0
  let maxRepeatStreak = 0
  let prev = -1
  let bassMotion = 0
  for (let bar = 0; bar < bars; bar++) {
    const pattern = barPattern(seed, bar, p)
    for (const step of pattern.arpeggio) {
      if (step.threshold >= HIGH_DENSITY) continue
      degrees.add(step.degree % p.scaleIntervals.length)
      stepCount += 1
      if (step.degree === prev) {
        repeatStreak += 1
        maxRepeatStreak = Math.max(maxRepeatStreak, repeatStreak)
      } else {
        repeatStreak = 0
      }
      prev = step.degree
    }
    for (let i = 1; i < pattern.arpeggio.length; i++) {
      const a = pattern.arpeggio[i - 1]
      const b = pattern.arpeggio[i]
      if (a && b && b.threshold < HIGH_DENSITY) {
        bassMotion += Math.min(4, Math.abs((b.degree ?? 0) - (a.degree ?? 0)) / 2)
      }
    }
  }
  const variety = Math.min(1, degrees.size / MIN_DEGREES)
  const motion = Math.min(1, bassMotion / (stepCount * MOTION_TARGET))
  const repeat = maxRepeatStreak >= MAX_REPEAT ? 0 : 1 - maxRepeatStreak / (MAX_REPEAT + 1)
  return Math.round(
    (variety * VARIETY_WEIGHT + motion * MOTION_WEIGHT + repeat * REPEAT_WEIGHT) * 100,
  )
}

/** Active layers by intensity (the pad is always present). */
export interface LayerGates {
  bass: boolean
  arpeggio: boolean
  drums: boolean
}

export function layersForIntensity(intensity: number, profile?: GenreProfile): LayerGates {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const v = clamp01(intensity)
  return {
    bass: v >= p.thresholdBass,
    arpeggio: v >= p.thresholdArpeggio,
    drums: v >= p.thresholdDrums,
  }
}

/** Linear tempo bpmMin→bpmMax BPM with intensity. */
export function tempoFor(intensity: number, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  return p.bpmMin + (p.bpmMax - p.bpmMin) * clamp01(intensity)
}

/** Global filter cutoff (brightness) by intensity. */
export function cutoffFor(intensity: number, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  return p.cutoffMinHz + (p.cutoffMaxHz - p.cutoffMinHz) * clamp01(intensity)
}

/** Note-mask density (0.25 → 1) from the arpeggio threshold. */
export function maskDensityFor(intensity: number, profile?: GenreProfile): number {
  const p = profile ?? GENRE_PROFILES.get(DEFAULT_GENRE)
  const span = 1 - p.thresholdArpeggio
  const t = span > 0 ? clamp01((clamp01(intensity) - p.thresholdArpeggio) / span) : 1
  return MASK_DENSITY_MIN + (MASK_DENSITY_MAX - MASK_DENSITY_MIN) * t
}

/** Duration of one beat (seconds) for a given tempo. */
export function beatDurationSec(bpm: number): number {
  return 60 / (bpm > 0 ? bpm : BPM_MIN)
}

/** Sixteenths per beat: the scheduler grid is the 16th note. */
export const STEPS_PER_BEAT = STEPS_PER_BAR / BEATS_PER_BAR
