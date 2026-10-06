/**
 * Public surface of the audio layer.
 *
 * The pure modules (RNG, patterns, intensity tracker, preferences) are safe to
 * import in Node; the WebAudio adapters (engine, director, sound, AudioDirector)
 * only touch the DOM when they actually play, and are wired by the composition
 * root through the `GameAudio` contract in `src/core/audio`.
 */
export { mulberry32, hashSeed, rngForBar } from './musicRng'
export {
  BPM_MAX,
  BPM_MIN,
  CURATED_MIN_SCORE,
  LEVEL_SONG_SEEDS,
  MENU_SONG_SEED,
  ROOT_FREQ,
  SCALE_INTERVALS,
} from './musicConstants'
export {
  barPattern,
  beatDurationSec,
  chordForBar,
  clamp01,
  cutoffFor,
  freqForDegree,
  layersForIntensity,
  maskDensityFor,
  songProfile,
  songScore,
  tempoFor,
  STEPS_PER_BEAT,
} from './musicPatterns'
export type { ArpStep, BarPattern, LayerGates, MaskedStep, SongProfile } from './musicPatterns'
export { IntensityTracker, PULSE_BY_EVENT } from './intensityTracker'
export type { IntensityEventKind, IntensitySignals, TrackerOptions } from './intensityTracker'
export { SoundFX } from './sound'
export type { SoundName } from './sound'
export { MusicDirector } from './musicDirector'
export { MusicEngine } from './musicEngine'
export { AudioDirector } from './audioDirector'
export type { AudioDirectorOptions } from './audioDirector'
export { createLocalStorageAudio, createMemoryAudio } from './preferences'
export type { AudioPreferenceStore } from './preferences'
