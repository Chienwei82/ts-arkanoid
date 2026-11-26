import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/config/gameConfig'
import { WarpDirector, type WarpSample } from '../src/rendering/warp'

const STEP = 1 / 60

/** Advances the director for `seconds` and collects every sample produced. */
const runFor = (director: WarpDirector, seconds: number): WarpSample[] => {
  const samples: WarpSample[] = []
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
    const sample = director.update(STEP)
    if (sample !== null) samples.push(sample)
  }
  return samples
}

describe('warp director', () => {
  it('is idle from the start and reports no sample', () => {
    const director = new WarpDirector()

    expect(director.active).toBe(false)
    expect(director.update(STEP)).toBeNull()
  })

  it('arriving while idle stays a no-op so fresh runs launch calm', () => {
    const director = new WarpDirector()

    director.arrive()

    expect(director.active).toBe(false)
    expect(director.update(STEP)).toBeNull()
  })

  it('ramps the departure monotonically and settles into the cruise', () => {
    const director = new WarpDirector()
    director.depart()

    const ramp: WarpSample[] = []
    for (let elapsed = 0; elapsed <= RENDER.warp.departDuration - STEP; elapsed += STEP) {
      const sample = director.update(STEP)
      if (sample !== null) ramp.push(sample)
    }
    expect(ramp.length).toBeGreaterThan(1)

    const first = ramp[0]
    expect(first.warp).toBeGreaterThan(0)
    expect(first.warp).toBeLessThan(RENDER.warp.peak.warp)
    expect(first.flash).toBeGreaterThan(0)
    for (let index = 1; index < ramp.length; index += 1) {
      expect(ramp[index].warp).toBeGreaterThanOrEqual(ramp[index - 1].warp)
    }

    // One more step crosses the ramp into cruise: calmer smear, no flash.
    const cruise = director.update(STEP)
    expect(cruise).not.toBeNull()
    const settled = cruise as WarpSample
    expect(settled.warp).toBe(RENDER.warp.cruise.warp)
    expect(settled.streaks).toBe(RENDER.warp.cruise.streaks)
    expect(settled.aberration).toBe(RENDER.warp.cruise.aberration)
    expect(settled.flash).toBe(0)
    expect(director.active).toBe(true)
  })

  it('dissolves the flash within the configured blink', () => {
    const director = new WarpDirector()
    director.depart()

    const samples = runFor(director, RENDER.warp.flashDuration + STEP)

    expect(samples[samples.length - 1].flash).toBe(0)
  })

  it('decelerates on arrival and ends the jump idle', () => {
    const director = new WarpDirector()
    director.depart()
    runFor(director, RENDER.warp.departDuration + STEP)

    director.arrive()

    expect(director.active).toBe(true)
    const arrival = director.update(STEP) as WarpSample
    // Arrival re-accelerates to the peak before braking, like a real jump.
    expect(arrival.warp).toBeGreaterThan(RENDER.warp.cruise.warp)
    expect(arrival.flash).toBeGreaterThan(0)

    runFor(director, RENDER.warp.arriveDuration)

    expect(director.active).toBe(false)
    expect(director.update(STEP)).toBeNull()
  })

  it('stops even mid-cruise when the run ends', () => {
    const director = new WarpDirector()
    director.depart()
    runFor(director, RENDER.warp.departDuration + 0.5)
    director.reset()

    expect(director.active).toBe(false)
    expect(director.update(STEP)).toBeNull()
  })

  it('reduces every sample to a calm one under reduced motion', () => {
    const director = new WarpDirector()
    director.setReducedMotion(true)
    director.depart()

    const samples = runFor(director, 0.4)
    expect(samples.length).toBeGreaterThan(0)
    for (const sample of samples) {
      expect(sample.warp).toBe(0)
      expect(sample.streaks).toBe(0)
      expect(sample.aberration).toBeLessThanOrEqual(
        RENDER.warp.peak.aberration * RENDER.warp.reduced.aberration,
      )
      if (sample.flash > 0) {
        expect(sample.flash).toBeLessThanOrEqual(RENDER.warp.peak.flash * RENDER.warp.reduced.flash)
      }
    }
  })
})
