/**
 * Procedural music constants: key, tempo, layer thresholds and mix. No magic
 * numbers — the character of the music is tuned here.
 *
 * Paper Breaker is warm, handmade and bouncy, so the tonal system is brighter
 * than a dark arcade bassline: A mixolydian (major with a flat 7th) over a
 * pentatonic-major melody, a folkish tempo range and consonant diatonic triads.
 * Any seed sounds pleasant; `songScore` (see `musicPatterns`) picks the best
 * ones, and the curated list below is produced with `npm run curate`.
 */

/** Root of the tonal system: A2 (110 Hz), the bass/pad anchor. */
export const ROOT_FREQ = 110

/**
 * A mixolydian scale (A B C# D E F# G) in semitones above the root.
 * All material — chords, bass, arpeggio — derives from these degrees.
 */
export const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 10] as const

/**
 * Major pentatonic subset of A mixolydian (indices: A B C# E F#).
 * The arpeggio/melody is limited to these degrees: no semitones, no dissonance.
 */
export const MELODY_DEGREES = [0, 1, 2, 4, 5] as const

/** Base modal progression as roots in scale indices: A – E – F#m – D. */
export const CHORD_ROOT_DEGREES = [0, 4, 5, 3] as const

/**
 * Three modal progressions (roots in scale degrees), all consonant and
 * diatonic. Index 0 is the base progression (A–E–F#m–D).
 */
export const CHORD_PROGRESSIONS = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [3, 0, 4, 5],
] as const

/**
 * Six rhythmic patterns per layer (16th-note steps). Swing slightly delays the
 * weak steps for a groove that feels hand-drawn rather than robotic.
 */
export const GROOVE_KICK_STEPS = [[0, 8], [0, 4, 8, 12], [0, 7, 11], [0], [0, 8], [0]] as const
export const GROOVE_HAT_STEPS = [
  [2, 6, 10, 14],
  [2, 6, 10, 14, 4, 12],
  [2, 6, 10, 14],
  [6, 14],
  [2, 4, 6, 10, 12, 14],
  [4, 12],
] as const
export const GROOVE_BASS_STEPS = [[0], [0, 8], [0, 10], [0], [0, 8], [0, 8]] as const
export const GROOVE_SWING = [false, true, true, false, true, false] as const

/** Rhythmic offset (seconds) applied to weak steps when swing is on. */
export const SWING_S = 0.045

/**
 * Song curation: what counts as a "good" seed.
 * - SONG_BARS: bars analyzed when scoring (one full cycle of 8).
 * - HIGH_DENSITY: notes below this threshold almost always sound.
 * - MIN_DEGREES: distinct scale degrees expected in a good melody.
 * - MAX_REPEAT: tolerated repeats in a row before penalizing.
 * - Variety, motion and anti-repetition weights (they add up to 1).
 */
export const SONG_BARS = 8
export const HIGH_DENSITY = 0.6
export const MIN_DEGREES = 5
export const MAX_REPEAT = 6
export const VARIETY_WEIGHT = 0.45
export const MOTION_WEIGHT = 0.3
export const REPEAT_WEIGHT = 0.25
export const MOTION_TARGET = 1.2

/** Minimum quality score for a seed to enter the curated list. */
export const CURATED_MIN_SCORE = 78

/**
 * Hand-picked seeds produced with `npm run curate`: the four campaign levels and
 * the menu. Each one scores 100/100 and they cover different
 * progressions/grooves (P1G4, P1G0, P0G3, P2G1), so the run sounds like four
 * different but related songs, with a separate welcome tune in the menu.
 */
export const LEVEL_SONG_SEEDS = [11, 16, 18, 37] as const
export const MENU_SONG_SEED = 58

/** Bars each chord lasts (slow 8-bar progression). */
export const BARS_PER_CHORD = 2

/** Rhythmic resolution: 16th notes over a 4-beat bar. */
export const BEATS_PER_BAR = 4
export const STEPS_PER_BAR = BEATS_PER_BAR * 4

/** Tempo: a relaxed 84 BPM up to a lively 120 BPM when the wall crumbles. */
export const BPM_MIN = 84
export const BPM_MAX = 120

/** Intensity thresholds (0..1) at which each layer enters. */
export const THRESHOLD_BASS = 0.2
export const THRESHOLD_ARPEGIO = 0.4
export const THRESHOLD_DRUMS = 0.6

/** Note-mask density at the intensity extremes. */
export const MASK_DENSITY_MIN = 0.25
export const MASK_DENSITY_MAX = 1

/** Brightness (global filter cutoff) as a function of intensity. */
export const CUTOFF_MIN_HZ = 700
export const CUTOFF_MAX_HZ = 4200

/** Mix: moderate volumes plus a limiter (compressor) on the output. */
export const MASTER_PEAK = 0.5
export const PAD_GAIN = 0.16
export const BASS_GAIN = 0.22
export const ARP_GAIN = 0.12
export const DRUM_GAIN = 0.18

/** Pad envelope (seconds): long attacks feel spacious. */
export const PAD_ATTACK_S = 1.6
export const PAD_RELEASE_S = 2.5
/** Pad voice detune (cents) to widen the sound. */
export const PAD_DETUNE_CENTS = 7

/** Scheduler lookahead (seconds ahead of currentTime). */
export const LOOKAHEAD_S = 0.12
/** Control clock cadence (ms). It is never the audio clock. */
export const TICK_MS = 25

/** Intensity smoothing: rises fast (~1.5 s) and falls slowly (~4 s). */
export const SMOOTHING_UP_S = 1.5
export const SMOOTHING_DOWN_S = 4

/** enable/disable and pause fades (seconds). */
export const FADE_IN_S = 0.8
export const FADE_OUT_S = 0.4

/** Decay of the game-event pulse (seconds). */
export const EVENT_DECAY_TAU_S = 4

/** Delay with feedback: a simple "reverb", no files and no convolution. */
export const DELAY_TIME_S = 0.32
export const DELAY_FEEDBACK = 0.32
export const DELAY_FILTER_HZ = 2400
