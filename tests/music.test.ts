import { describe, expect, it } from 'vitest'
import {
  BARS_PER_CHORD,
  BPM_MAX,
  BPM_MIN,
  CHORD_PROGRESSIONS,
  CHORD_ROOT_DEGREES,
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  MASK_DENSITY_MIN,
  MELODY_DEGREES,
  ROOT_FREQ,
  SCALE_INTERVALS,
  THRESHOLD_ARPEGIO,
  THRESHOLD_BASS,
  THRESHOLD_DRUMS,
} from '../src/audio/musicConstants'
import { IntensityTracker, PULSE_BY_EVENT } from '../src/audio/intensityTracker'
import type { IntensityEventKind, IntensitySignals } from '../src/audio/intensityTracker'
import {
  barPattern,
  chordForBar,
  cutoffFor,
  freqForDegree,
  layersForIntensity,
  maskDensityFor,
  songProfile,
  songScore,
  tempoFor,
} from '../src/audio/musicPatterns'
import {
  GENRE_PROFILES,
  GENRE_SEED_COUNT,
  type GenreProfile,
  GenreRegistry,
  genreSeedRng,
} from '../src/audio/genre'
import { hashSeed, mulberry32, rngForBar } from '../src/audio/musicRng'

/**
 * Test profile matching the legacy global constants, so the original mapping
 * tests keep their intended meaning (the engine's default audio profile). New
 * genre tests assert against each profile's own ranges below.
 */
const genericProfile: GenreProfile = {
  id: 'electronic',
  label: 'Test',
  rootFreq: ROOT_FREQ,
  scaleIntervals: [0, 2, 4, 5, 7, 9, 10],
  melodyDegrees: [0, 1, 2, 4, 5],
  chordRootDegrees: [0, 3, 5],
  chordProgressions: [[0, 3, 5]],
  bpmMin: 84,
  bpmMax: 120,
  cutoffMinHz: 700,
  cutoffMaxHz: 4200,
  thresholdBass: THRESHOLD_BASS,
  thresholdArpeggio: THRESHOLD_ARPEGIO,
  thresholdDrums: THRESHOLD_DRUMS,
  mix: { padGain: 0.14, bassGain: 0.24, arpGain: 0.14, drumGain: 0.2 },
  padAttackS: 1.2,
  padReleaseS: 2.0,
  padDetuneCents: 6,
  oscillators: { pad: 'sine', bass: 'triangle', arpeggio: 'triangle', kick: 'sine' },
  groove: {
    kickSteps: [[0, 8]],
    hatSteps: [[2, 6, 10, 14]],
    bassSteps: [[0]],
    swing: [false],
    swingS: 0,
  },
  seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

const SCALE_SEMITONES = new Set<number>(SCALE_INTERVALS)
const PENTA_INDICES = new Set<number>(MELODY_DEGREES)

/** Semitones of a frequency above the tonic. */
function semitonesFromRoot(freq: number): number {
  return 12 * Math.log2(freq / ROOT_FREQ)
}
function inScale(freq: number): boolean {
  const semi = Math.round(semitonesFromRoot(freq))
  return SCALE_SEMITONES.has(((semi % 12) + 12) % 12)
}

/** Checks a frequency against a genre profile's own interval set (octave-agnostic). */
function inGenreScale(freq: number, profile: GenreProfile): boolean {
  const semi = ((Math.round(semitonesFromRoot(freq)) % 12) + 12) % 12
  return profile.scaleIntervals.some((i) => ((i % 12) + 12) % 12 === semi)
}
const ALL_OFF: IntensitySignals = { danger: 0, level: 0, clearance: 0, combo: 0 }
const ALL_ON: IntensitySignals = { danger: 1, level: 1, clearance: 1, combo: 12 }

describe('deterministic RNG (mulberry32)', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
  it('different seeds produce different sequences', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()])
  })
  it('values stay in the [0, 1) range', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('hashSeed is stable and distinct per text', () => {
    expect(hashSeed('paper')).toBe(hashSeed('paper'))
    expect(hashSeed('paper')).not.toBe(hashSeed('breaker'))
    expect(hashSeed(123)).toBe(123)
  })
  it('rngForBar depends only on (seed, bar)', () => {
    const a = rngForBar(42, 3)
    const b = rngForBar(42, 3)
    const c = rngForBar(42, 4)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
    expect(rngForBar(42, 3)()).not.toBe(c())
  })
})

describe('musical patterns', () => {
  it('the material of a bar is deterministic for a seed', () => {
    expect(barPattern(11, 2)).toEqual(barPattern(11, 2))
    expect(barPattern(11, 2)).not.toEqual(barPattern(16, 2))
    expect(barPattern(11, 2)).not.toEqual(barPattern(11, 3))
  })
  it('every note of the pattern belongs to the scale', () => {
    for (const seed of [11, 16, 18, 37]) {
      for (let bar = 0; bar < 8; bar++) {
        const p = barPattern(seed, bar)
        for (const d of p.chord) expect(inScale(freqForDegree(d))).toBe(true)
        for (const s of p.arpeggio) expect(inScale(freqForDegree(s.degree))).toBe(true)
      }
    }
  })
  it('the arpeggio stays inside the pentatonic set (no dissonance)', () => {
    for (let bar = 0; bar < 8; bar++) {
      for (const s of barPattern(18, bar).arpeggio) {
        expect(PENTA_INDICES.has(((s.degree % 7) + 7) % 7)).toBe(true)
      }
    }
  })
  it('each chord lasts two bars and follows the seed progression', () => {
    const seed = 18
    const profile = songProfile(seed)
    const progression = CHORD_PROGRESSIONS[profile.progression] ?? CHORD_ROOT_DEGREES
    for (let bar = 0; bar < 8; bar += BARS_PER_CHORD) {
      const idx = (bar / BARS_PER_CHORD + profile.rotation) % progression.length
      expect(chordForBar(seed, bar)[0]).toBe(progression[idx])
    }
    expect(chordForBar(seed, 0)).toEqual(chordForBar(seed, 1))
  })
  it('the song profile is stable and inside its ranges', () => {
    const p = songProfile(37)
    expect(p).toEqual(songProfile(37))
    expect(p.progression).toBeGreaterThanOrEqual(0)
    expect(p.progression).toBeLessThan(3)
    expect(p.groove).toBeGreaterThanOrEqual(0)
    expect(p.groove).toBeLessThan(6)
    expect(p.rotation).toBeGreaterThanOrEqual(0)
    expect(p.rotation).toBeLessThan(4)
  })
  it('the quality score is stable and bounded 0..100', () => {
    expect(songScore(37)).toBe(songScore(37))
    for (const s of [0, 1, 11, 16, 18, 37, 58]) {
      const score = songScore(s)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })
  it('freqForDegree: the octave doubles the frequency', () => {
    expect(freqForDegree(0)).toBeCloseTo(ROOT_FREQ)
    expect(freqForDegree(7)).toBeCloseTo(ROOT_FREQ * 2)
  })
})

describe('intensity → layers / tempo / brightness mapping', () => {
  it('the pad always plays: at intensity 0 there are no more layers', () => {
    expect(layersForIntensity(0, genericProfile)).toEqual({
      bass: false,
      arpeggio: false,
      drums: false,
    })
  })
  it('the bass enters from 0.2', () => {
    expect(layersForIntensity(THRESHOLD_BASS - 0.01, genericProfile).bass).toBe(false)
    expect(layersForIntensity(THRESHOLD_BASS, genericProfile).bass).toBe(true)
  })
  it('the arpeggio enters from 0.4 and the drums from 0.6', () => {
    expect(layersForIntensity(THRESHOLD_ARPEGIO - 0.01, genericProfile).arpeggio).toBe(false)
    expect(layersForIntensity(THRESHOLD_ARPEGIO, genericProfile).arpeggio).toBe(true)
    expect(layersForIntensity(THRESHOLD_DRUMS - 0.01, genericProfile).drums).toBe(false)
    expect(layersForIntensity(THRESHOLD_DRUMS, genericProfile).drums).toBe(true)
  })
  it('the tempo goes from 84 to 120 BPM and is monotonic', () => {
    expect(tempoFor(0, genericProfile)).toBe(BPM_MIN)
    expect(tempoFor(1, genericProfile)).toBe(BPM_MAX)
    expect(tempoFor(0.5, genericProfile)).toBeCloseTo((BPM_MIN + BPM_MAX) / 2)
    expect(tempoFor(2, genericProfile)).toBe(BPM_MAX) // clamped
    expect(tempoFor(0.3, genericProfile)).toBeLessThan(tempoFor(0.7, genericProfile))
  })
  it('brightness (cutoff) rises with intensity', () => {
    expect(cutoffFor(0, genericProfile)).toBe(CUTOFF_MIN_HZ)
    expect(cutoffFor(1, genericProfile)).toBe(CUTOFF_MAX_HZ)
    expect(cutoffFor(0.3, genericProfile)).toBeLessThan(cutoffFor(0.8, genericProfile))
  })
  it('note density grows from the minimum with intensity', () => {
    expect(maskDensityFor(THRESHOLD_ARPEGIO, genericProfile)).toBeCloseTo(MASK_DENSITY_MIN)
    expect(maskDensityFor(1, genericProfile)).toBe(1)
    expect(maskDensityFor(0.5, genericProfile)).toBeLessThan(maskDensityFor(0.9, genericProfile))
  })
})

describe('genres and profiles', () => {
  it('each profile exposes its own BPM and filter ranges', () => {
    for (const profile of GENRE_PROFILES.values()) {
      expect(profile.bpmMin).toBeLessThan(profile.bpmMax)
      expect(profile.cutoffMinHz).toBeLessThan(profile.cutoffMaxHz)
      expect(profile.thresholdBass).toBeGreaterThanOrEqual(0)
      expect(profile.thresholdArpeggio).toBeGreaterThanOrEqual(0)
      expect(profile.thresholdDrums).toBeGreaterThanOrEqual(0)
      expect(profile.thresholdDrums).toBeLessThanOrEqual(1)
    }
  })

  it('each genre has exactly 10 fixed seeds', () => {
    for (const profile of GENRE_PROFILES.values()) {
      expect(profile.seeds).toHaveLength(GENRE_SEED_COUNT)
      // Names are stable constants.
      expect(profile.seeds[0]).toBeGreaterThan(0)
    }
  })

  it('every arpeggio note of a genre falls inside that genre scale', () => {
    for (const profile of GENRE_PROFILES.values()) {
      for (const seed of profile.seeds) {
        const pattern = barPattern(seed, 0, profile)
        for (const s of pattern.arpeggio) {
          expect(inGenreScale(freqForDegree(s.degree, profile), profile)).toBe(true)
        }
      }
    }
  })

  it('seed selection never returns the previous seed twice in a row', () => {
    const rng = mulberry32(7)
    const registry = new GenreRegistry(GENRE_PROFILES)
    for (const genreId of GENRE_PROFILES.keys()) {
      let previous: number | null = null
      for (let i = 0; i < 500; i += 1) {
        const picked = registry.pickSeed(genreId, rng, previous)
        if (previous !== null) {
          expect(picked.seed).not.toBe(previous)
        }
        previous = picked.seed
      }
    }
  })

  it('the same (genre, seed) always yields the same material', () => {
    for (const genreId of GENRE_PROFILES.keys()) {
      const profile = GENRE_PROFILES.get(genreId)!
      for (const seed of profile.seeds) {
        const rngA = genreSeedRng(genreId, seed)
        const rngB = genreSeedRng(genreId, seed)
        for (let i = 0; i < 30; i += 1) {
          expect(rngA()).toBe(rngB())
        }
      }
    }
  })
})

describe('smoothing (IntensityTracker)', () => {
  it('every event has a positive pulse', () => {
    for (const pulse of Object.values(PULSE_BY_EVENT)) expect(pulse).toBeGreaterThan(0)
  })
  it('starts calm and reset returns to zero', () => {
    const tr = new IntensityTracker()
    expect(tr.current).toBe(0)
    for (let t = 0; t < 2; t += 1 / 60) tr.update(1 / 60, ALL_ON)
    expect(tr.current).toBeGreaterThan(0.3)
    tr.reset()
    expect(tr.current).toBe(0)
  })
  it('a level clear raises tension without a jump', () => {
    const tr = new IntensityTracker()
    tr.event('levelclear')
    expect(tr.update(1 / 60, ALL_OFF)).toBeLessThan(0.35)
  })
  it('the event pulse decays back to calm', () => {
    const tr = new IntensityTracker()
    tr.event('chain')
    // The fall is slow by design (~4 s): after 15 s the pulse has dissipated.
    for (let t = 0; t < 15; t += 1 / 60) tr.update(1 / 60, ALL_OFF)
    expect(tr.current).toBeLessThan(0.05)
  })
  it('rises fast toward danger and falls more slowly', () => {
    const up = new IntensityTracker()
    for (let t = 0; t < 2; t += 1 / 60) up.update(1 / 60, ALL_ON)
    const down = new IntensityTracker()
    for (let t = 0; t < 20; t += 1 / 60) down.update(1 / 60, ALL_ON)
    const top = down.current
    for (let t = 0; t < 2; t += 1 / 60) down.update(1 / 60, ALL_OFF)
    expect(up.current).toBeGreaterThan(0.5) // 2 s is enough to rise
    expect(top - down.current).toBeLessThan(up.current) // but the fall is slower
  })
  it('the last life pushes intensity harder than a fresh one', () => {
    const fresh = new IntensityTracker()
    const lastLife = new IntensityTracker()
    for (let t = 0; t < 6; t += 1 / 60) {
      fresh.update(1 / 60, { ...ALL_OFF, danger: 0 })
      lastLife.update(1 / 60, { ...ALL_OFF, danger: 1 })
    }
    expect(lastLife.current).toBeGreaterThan(fresh.current)
  })
  it('accepts every event kind', () => {
    const kinds: IntensityEventKind[] = [
      'break',
      'chain',
      'explode',
      'powerup',
      'life',
      'levelclear',
    ]
    const tr = new IntensityTracker()
    for (const kind of kinds) tr.event(kind)
    expect(tr.update(1 / 60, ALL_OFF)).toBeGreaterThan(0)
  })
})
