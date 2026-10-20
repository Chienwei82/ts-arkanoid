/**
 * Deterministic pseudo-random generation (mulberry32).
 *
 * Everything procedural in the game derives from here: the same seed always
 * produces the same result, no matter what happens during the match. Nothing
 * in this module touches the DOM, so it runs (and is tested) in plain Node.
 *
 * Lives in `utils` (not in `audio`) because both the procedural soundtrack and
 * the procedural galaxy backdrop share it.
 */

/** mulberry32: fast, decent quality and a 32-bit state. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mixes a seed (number or text) into a 32-bit integer (FNV-1a). */
export function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return seed >>> 0
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/**
 * Independent RNG per bar: the material of each bar depends only on
 * (seed, bar), regardless of what sounds before or after it. That is what makes
 * a bar safe to (re)generate on the fly while the song keeps playing.
 */
export function rngForBar(seed: number, bar: number): () => number {
  return mulberry32((hashSeed(seed) ^ Math.imul(bar + 1, 0x9e3779b1)) >>> 0)
}

/** Uniform float in [min, max). */
export const randomRange = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min)

/** Uniform integer in [min, max]. */
export const randomInt = (rng: () => number, min: number, max: number): number =>
  Math.floor(randomRange(rng, min, max + 1))

/** Uniform pick from a non-empty list. */
export const randomPick = <T>(rng: () => number, items: readonly T[]): T => {
  if (items.length === 0) throw new Error('randomPick: empty list')
  return items[randomInt(rng, 0, items.length - 1)]
}
