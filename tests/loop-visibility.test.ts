// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const setVisibility = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GameLoop visibility', () => {
  it('suspends the frame chain while the tab is hidden', () => {
    const scheduler = installScheduler()
    let updates = 0
    const loop = new GameLoop({ update: () => (updates += 1), render: () => undefined })

    loop.start()
    expect(scheduler.pending()).toBe(1)

    setVisibility('hidden')
    expect(scheduler.pending()).toBe(0)
    expect(loop.isRunning).toBe(true)

    scheduler.step(performance.now() + 1000)
    expect(updates).toBe(0)
    loop.stop()
  })

  it('resumes rendering when the tab becomes visible again', () => {
    const scheduler = installScheduler()
    let updates = 0
    const loop = new GameLoop({ update: () => (updates += 1), render: () => undefined })

    loop.start()
    setVisibility('hidden')
    setVisibility('visible')
    expect(scheduler.pending()).toBe(1)

    scheduler.step(performance.now() + 1000 / 60)
    expect(updates).toBeGreaterThan(0)
    loop.stop()
  })

  it('stops reacting to visibility once the loop is stopped', () => {
    const scheduler = installScheduler()
    const loop = new GameLoop({ update: () => undefined, render: () => undefined })

    loop.start()
    loop.stop()
    setVisibility('hidden')
    setVisibility('visible')
    expect(scheduler.pending()).toBe(0)
  })
})
