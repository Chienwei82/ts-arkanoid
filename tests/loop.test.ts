import { afterEach, describe, expect, it, vi } from 'vitest'
import { PHYSICS } from '../src/config/gameConfig'
import { GameLoop } from '../src/core/GameLoop'

type FrameCallback = (time: number) => void

interface Scheduler {
  readonly step: (timeMs: number) => void
  readonly pending: () => number
}

/** Deterministic stand-in for the browser frame scheduler. */
const installScheduler = (): Scheduler => {
  const callbacks = new Map<number, FrameCallback>()
  let nextId = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback): number => {
    const id = nextId
    nextId += 1
    callbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    callbacks.delete(id)
  })
  return {
    pending: () => callbacks.size,
    step: (timeMs: number) => {
      const due = [...callbacks.values()]
      callbacks.clear()
      for (const callback of due) callback(timeMs)
    },
  }
}

const frameMs = 1000 / 60

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GameLoop', () => {
  it('steps the simulation at the fixed timestep and reports alpha', () => {
    const scheduler = installScheduler()
    const updates: number[] = []
    const renders: { alpha: number; delta: number }[] = []
    const loop = new GameLoop({
      update: (dt) => updates.push(dt),
      render: (alpha, delta) => renders.push({ alpha, delta }),
    })

    loop.start()
    const base = performance.now()
    scheduler.step(base + frameMs)

    expect(updates).toHaveLength(2)
    expect(updates.every((dt) => Math.abs(dt - PHYSICS.fixedStep) < 1e-9)).toBe(true)
    expect(renders).toHaveLength(1)
    expect(renders[0].alpha).toBeGreaterThanOrEqual(0)
    expect(renders[0].alpha).toBeLessThan(1)
    expect(scheduler.pending()).toBe(1)

    loop.stop()
    expect(loop.isRunning).toBe(false)
    expect(scheduler.pending()).toBe(0)
  })

  it('caps catch-up work after a long hitch instead of spiralling', () => {
    const scheduler = installScheduler()
    let updates = 0
    const loop = new GameLoop({
      update: () => {
        updates += 1
      },
      render: () => undefined,
    })

    loop.start()
    scheduler.step(performance.now() + 5000)

    const budget = Math.ceil(PHYSICS.maxFrameDelta / PHYSICS.fixedStep)
    expect(updates).toBe(budget)
    loop.stop()
  })

  it('stops and reports when a handler throws', () => {
    const scheduler = installScheduler()
    const onError = vi.fn<(error: unknown, phase: string) => void>()
    const failure = new Error('boom')
    const loop = new GameLoop({
      update: () => {
        throw failure
      },
      render: () => undefined,
      onError,
    })

    loop.start()
    expect(() => {
      scheduler.step(performance.now() + frameMs)
    }).not.toThrow()

    expect(onError).toHaveBeenCalledWith(failure, 'update')
    expect(loop.isRunning).toBe(false)
  })

  it('reports render failures separately', () => {
    const scheduler = installScheduler()
    const onError = vi.fn<(error: unknown, phase: string) => void>()
    const loop = new GameLoop({
      update: () => undefined,
      render: () => {
        throw new Error('no gl')
      },
      onError,
    })

    loop.start()
    scheduler.step(performance.now() + frameMs)

    expect(onError.mock.calls[0][1]).toBe('render')
    expect(loop.isRunning).toBe(false)
  })

  it('ignores a second start while running', () => {
    const scheduler = installScheduler()
    const loop = new GameLoop({ update: () => undefined, render: () => undefined })
    loop.start()
    loop.start()

    expect(scheduler.pending()).toBe(1)
    loop.stop()
  })
})
