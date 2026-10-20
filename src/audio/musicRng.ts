/**
 * Deterministic pseudo-random generation shared with the procedural backdrop.
 *
 * The implementation now lives in `utils/rng` so the galaxy backdrop and the
 * procedural soundtrack draw from the exact same generator. This module keeps
 * the historical `audio/musicRng` entry point (and its public API) intact.
 */
export { mulberry32, hashSeed, rngForBar } from '../utils/rng'
