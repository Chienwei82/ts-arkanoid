/**
 * GenreProfile: immutable, typed musical configuration per genre.
 *
 * Adding a new genre is only adding a profile + its 10 seeds here —
 * the engine (MusicEngine / musicPatterns) has no genre branches; it
 * reads everything from the active profile.
 *
 * Seeds are named constants defined alongside the profile. Each genre's
 * 10 seeds must sound distinct (different tonic, progression, pattern).
 */
import { mulberry32 } from '../utils/rng'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type GenreId = 'electronic' | 'pop' | 'techno' | 'dance' | 'classic'

export const GENRE_IDS: readonly GenreId[] = [
  'electronic',
  'pop',
  'techno',
  'dance',
  'classic',
] as const

export const DEFAULT_GENRE: GenreId = 'electronic'

export interface GenreOscillatorTypes {
  readonly pad: OscillatorType
  readonly bass: OscillatorType
  readonly arpeggio: OscillatorType
  readonly kick: OscillatorType
}

export interface GenreMix {
  readonly padGain: number
  readonly bassGain: number
  readonly arpGain: number
  readonly drumGain: number
}

export interface GenreGroove {
  /** 16th-note step indices per groove option (6 options). */
  readonly kickSteps: readonly number[][]
  readonly hatSteps: readonly number[][]
  readonly bassSteps: readonly number[][]
  /** Whether swing is on per groove option. */
  readonly swing: readonly boolean[]
  /** Seconds offset applied to weak steps when swing is on. */
  readonly swingS: number
}

export interface GenreProfile {
  readonly id: GenreId
  readonly label: string
  /** Tonal centre (Hz). */
  readonly rootFreq: number
  readonly scaleIntervals: readonly number[]
  readonly melodyDegrees: readonly number[]
  readonly chordRootDegrees: readonly number[]
  readonly chordProgressions: readonly number[][]
  /** BPM at intensity 0 → 1. */
  readonly bpmMin: number
  readonly bpmMax: number
  /** Filter cutoff (Hz) at intensity 0 → 1. */
  readonly cutoffMinHz: number
  readonly cutoffMaxHz: number
  /** Layer entry thresholds (0..1). */
  readonly thresholdBass: number
  readonly thresholdArpeggio: number
  readonly thresholdDrums: number
  readonly mix: GenreMix
  /** Pad envelope (seconds) and detune (cents). */
  readonly padAttackS: number
  readonly padReleaseS: number
  readonly padDetuneCents: number
  readonly oscillators: GenreOscillatorTypes
  readonly groove: GenreGroove
  /** 10 named, fixed seeds — one is picked at random per level/selection. */
  readonly seeds: readonly number[]
}

export const GENRE_SEED_COUNT = 10

const BASE_ROOT_FREQ = 110 // A2

const ELECTRONIC: GenreProfile = {
  id: 'electronic',
  label: 'Electronic',
  rootFreq: BASE_ROOT_FREQ,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 10] as const,
  melodyDegrees: [0, 1, 2, 4, 5] as const,
  chordRootDegrees: [0, 4, 5, 3] as const,
  chordProgressions: [
    [0, 4, 5, 3],
    [0, 5, 3, 4],
    [3, 0, 4, 5],
  ] as const,
  bpmMin: 90,
  bpmMax: 126,
  cutoffMinHz: 600,
  cutoffMaxHz: 5000,
  thresholdBass: 0.25,
  thresholdArpeggio: 0.45,
  thresholdDrums: 0.6,
  mix: { padGain: 0.16, bassGain: 0.22, arpGain: 0.12, drumGain: 0.18 },
  padAttackS: 1.4,
  padReleaseS: 2.2,
  padDetuneCents: 7,
  oscillators: {
    pad: 'sine',
    bass: 'triangle',
    arpeggio: 'triangle',
    kick: 'sine',
  },
  groove: {
    kickSteps: [[0, 8], [0, 4, 8, 12], [0, 7, 11], [0], [0, 8], [0]],
    hatSteps: [
      [2, 6, 10, 14],
      [2, 6, 10, 14, 4, 12],
      [2, 6, 10, 14],
      [6, 14],
      [2, 4, 6, 10, 12, 14],
      [4, 12],
    ],
    bassSteps: [[0], [0, 8], [0, 10], [0], [0, 8], [0, 8]],
    swing: [false, true, true, false, true, false],
    swingS: 0.045,
  },
  seeds: [11, 23, 47, 61, 79, 103, 127, 151, 181, 211] as const,
}

const POP: GenreProfile = {
  id: 'pop',
  label: 'Pop',
  rootFreq: BASE_ROOT_FREQ,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 11] as const,
  melodyDegrees: [0, 2, 4, 7, 9] as const,
  chordRootDegrees: [0, 5, 3, 4] as const,
  chordProgressions: [
    [0, 5, 3, 4],
    [0, 3, 4, 5],
    [4, 5, 0, 3],
    [3, 4, 0, 5],
  ] as const,
  bpmMin: 88,
  bpmMax: 116,
  cutoffMinHz: 800,
  cutoffMaxHz: 4500,
  thresholdBass: 0.2,
  thresholdArpeggio: 0.4,
  thresholdDrums: 0.55,
  mix: { padGain: 0.12, bassGain: 0.26, arpGain: 0.14, drumGain: 0.16 },
  padAttackS: 1.0,
  padReleaseS: 1.8,
  padDetuneCents: 5,
  oscillators: {
    pad: 'sine',
    bass: 'sawtooth',
    arpeggio: 'sine',
    kick: 'sine',
  },
  groove: {
    kickSteps: [
      [0, 8],
      [0, 4, 8, 12],
      [0, 6, 8, 12],
      [0, 8],
      [0, 4, 8],
      [0, 8],
    ],
    hatSteps: [
      [2, 6, 10, 14],
      [2, 6, 10, 14],
      [2, 4, 6, 10, 12, 14],
      [2, 10],
      [2, 6, 10, 14, 4, 12],
      [4, 12],
    ],
    bassSteps: [[0, 8], [0, 8], [0, 4, 8], [0], [0, 8], [0, 10]],
    swing: [false, false, true, false, true, false],
    swingS: 0.03,
  },
  seeds: [58, 73, 89, 107, 131, 157, 173, 191, 223, 251] as const,
}

const TECHNO: GenreProfile = {
  id: 'techno',
  label: 'Techno',
  rootFreq: BASE_ROOT_FREQ,
  scaleIntervals: [0, 2, 3, 5, 7, 8, 10] as const,
  melodyDegrees: [0, 2, 3, 5, 7] as const,
  chordRootDegrees: [0, 0, 5, 3] as const,
  chordProgressions: [
    [0, 0, 5, 3],
    [0, 5, 3, 0],
    [5, 3, 0, 0],
    [0, 0, 0, 0],
  ] as const,
  bpmMin: 124,
  bpmMax: 140,
  cutoffMinHz: 400,
  cutoffMaxHz: 6500,
  thresholdBass: 0.15,
  thresholdArpeggio: 0.5,
  thresholdDrums: 0.25,
  mix: { padGain: 0.1, bassGain: 0.28, arpGain: 0.08, drumGain: 0.22 },
  padAttackS: 2.0,
  padReleaseS: 3.0,
  padDetuneCents: 10,
  oscillators: {
    pad: 'sawtooth',
    bass: 'sawtooth',
    arpeggio: 'square',
    kick: 'sine',
  },
  groove: {
    kickSteps: [
      [0, 4, 8, 12],
      [0, 4, 8, 12],
      [0, 4, 8, 12],
      [0, 4, 8, 12],
      [0, 4, 8, 12],
      [0, 4, 8, 12],
    ],
    hatSteps: [
      [2, 6, 10, 14],
      [1, 3, 5, 7, 9, 11, 13, 15],
      [2, 6, 10, 14],
      [1, 3, 5, 7, 9, 11, 13, 15],
      [2, 4, 6, 8, 10, 12, 14],
      [1, 3, 5, 7, 9, 11, 13, 15],
    ],
    bassSteps: [[0], [0, 8], [0], [0, 8], [0], [0, 8]],
    swing: [false, false, false, false, false, false],
    swingS: 0.0,
  },
  seeds: [13, 31, 67, 97, 137, 163, 193, 229, 263, 293] as const,
}

const DANCE: GenreProfile = {
  id: 'dance',
  label: 'Dance',
  rootFreq: BASE_ROOT_FREQ,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 10] as const,
  melodyDegrees: [0, 1, 2, 4, 5] as const,
  chordRootDegrees: [0, 3, 5, 4] as const,
  chordProgressions: [
    [0, 3, 5, 4],
    [0, 5, 4, 3],
    [3, 5, 0, 4],
    [5, 4, 3, 0],
  ] as const,
  bpmMin: 118,
  bpmMax: 132,
  cutoffMinHz: 700,
  cutoffMaxHz: 4800,
  thresholdBass: 0.15,
  thresholdArpeggio: 0.3,
  thresholdDrums: 0.2,
  mix: { padGain: 0.14, bassGain: 0.24, arpGain: 0.13, drumGain: 0.19 },
  padAttackS: 0.9,
  padReleaseS: 1.5,
  padDetuneCents: 6,
  oscillators: {
    pad: 'sine',
    bass: 'square',
    arpeggio: 'sine',
    kick: 'sine',
  },
  groove: {
    kickSteps: [
      [0, 6, 8, 12],
      [0, 4, 8, 12],
      [0, 6, 10, 12],
      [0, 4, 8, 12],
      [0, 5, 8, 12],
      [0, 4, 8, 12],
    ],
    hatSteps: [
      [2, 6, 10, 14, 4, 12],
      [2, 6, 10, 14],
      [1, 3, 5, 7, 9, 11, 13, 15],
      [2, 6, 10, 14],
      [2, 4, 6, 10, 12, 14],
      [2, 6, 10, 14],
    ],
    bassSteps: [
      [0, 6],
      [0, 8],
      [0, 5, 8],
      [0, 4],
      [0, 6, 10],
      [0, 8],
    ],
    swing: [true, false, true, false, true, false],
    swingS: 0.05,
  },
  seeds: [17, 41, 71, 101, 139, 167, 197, 227, 269, 307] as const,
}

const CLASSIC: GenreProfile = {
  id: 'classic',
  label: 'Classic',
  rootFreq: BASE_ROOT_FREQ,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 11] as const,
  melodyDegrees: [0, 2, 4, 7, 9] as const,
  chordRootDegrees: [0, 3, 5, 4] as const,
  chordProgressions: [
    [0, 3, 5, 4],
    [0, 4, 5, 3],
    [3, 5, 0, 4],
    [5, 0, 3, 4],
  ] as const,
  bpmMin: 76,
  bpmMax: 100,
  cutoffMinHz: 500,
  cutoffMaxHz: 3500,
  thresholdBass: 0.35,
  thresholdArpeggio: 0.25,
  thresholdDrums: 0.9,
  mix: { padGain: 0.2, bassGain: 0.18, arpGain: 0.16, drumGain: 0.06 },
  padAttackS: 1.8,
  padReleaseS: 3.0,
  padDetuneCents: 4,
  oscillators: {
    pad: 'sine',
    bass: 'sine',
    arpeggio: 'sine',
    kick: 'sine',
  },
  groove: {
    kickSteps: [[0], [0], [0], [0], [0], [0]],
    hatSteps: [[10], [10], [14], [10], [14], [10]],
    bassSteps: [[0], [0, 8], [0], [0, 8], [0], [0, 8]],
    swing: [false, false, false, false, false, false],
    swingS: 0.0,
  },
  seeds: [19, 43, 73, 103, 139, 167, 199, 223, 271, 307] as const,
}

export const GENRE_PROFILES: ReadonlyMap<GenreId, GenreProfile> = new Map([
  ['electronic', ELECTRONIC],
  ['pop', POP],
  ['techno', TECHNO],
  ['dance', DANCE],
  ['classic', CLASSIC],
])

export interface SeedPickResult {
  readonly seed: number
  readonly changed: boolean
}

/**
 * Catalogue of genre profiles. Seed selection is deterministic:
 * the same (genre, rng) always yields the same seed, and the same
 * seed always yields the same piece (via mulberry32 in musicPatterns).
 */
export class GenreRegistry {
  private readonly profiles: ReadonlyMap<GenreId, GenreProfile>

  constructor(profiles: ReadonlyMap<GenreId, GenreProfile> = GENRE_PROFILES) {
    this.profiles = profiles
  }

  /** All available genre ids, in catalogue order. */
  all(): readonly GenreId[] {
    return [...this.profiles.keys()]
  }

  /** Lookup by id; undefined if unknown. */
  get(id: GenreId): GenreProfile | undefined {
    return this.profiles.get(id)
  }

  /** Default genre (Electronic). */
  default(): GenreId {
    return DEFAULT_GENRE
  }

  /**
   * Picks one of the genre's 10 seeds deterministically from `rng`.
   * Avoids returning `previousSeed` twice in a row within the same genre:
   * if the roll hits the previous seed, the next candidate is used instead.
   */
  pickSeed(
    genreId: GenreId,
    rng: () => number,
    previousSeed: number | null = null,
  ): SeedPickResult {
    const profile = this.profiles.get(genreId)
    if (!profile) {
      throw new Error(`GenreRegistry: unknown genre '${genreId}'`)
    }
    const seeds = profile.seeds
    const count = seeds.length
    let idx = Math.floor(rng() * count)
    let changed = true
    if (previousSeed !== null && count > 1) {
      // If we rolled the previous seed, shift to the next one deterministically.
      if (seeds[idx] === previousSeed) {
        idx = (idx + 1) % count
        changed = false
      }
    }
    return { seed: seeds[idx] ?? seeds[0], changed }
  }
}

/**
 * Creates a seeded RNG for a genre + seed combination, identical to the
 * one used by musicPatterns so a seed always reproduces the same piece.
 */
export function genreSeedRng(genreId: GenreId, seed: number): () => number {
  const mixed = mulberry32(hashSeedGenre(genreId) ^ (seed >>> 0))
  return mulberry32(mixed() >>> 0)
}

/** FNV-1a mix of the genre id into a 32-bit integer. */
function hashSeedGenre(genreId: GenreId): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < genreId.length; i += 1) {
    h ^= genreId.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
