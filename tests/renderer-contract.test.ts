// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../src/core/Game'
import type { GameRenderer } from '../src/core/renderer'

import type { World } from '../src/systems/World'
import { createMemoryRecord } from '../src/utils/storage'
import { collect, testLevel } from './helpers'

type FrameCallback = (time: number) => void

interface Recorder extends GameRenderer {
  readonly calls: string[]
  readonly alphas: number[]
  readonly flags: { failRender: unknown }
}

const createRecorder = (): Recorder => {
  const calls: string[] = []
  const alphas: number[] = []
  const flags: { failRender: unknown } = { failRender: null }
  return {
    calls,
    alphas,
    flags,
    syncWorld: (_world: World, alpha: number) => {
      calls.push('syncWorld')
      alphas.push(alpha)
    },
    update: () => calls.push('update'),
    render: () => {
      calls.push('render')
      if (flags.failRender !== null) {
        // Deliberate: a third-party runtime may throw non-Error values and the
        // engine must survive that, so the rule is disabled at this exact line.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw flags.failRender
      }
    },
    screenToWorldX: (clientX) => clientX / 10,
    dispose: () => calls.push('dispose'),
  }
}

interface Harness {
  readonly game: Game
  readonly renderer: Recorder
  readonly host: HTMLDivElement
  readonly scheduler: { step: (timeMs: number) => void; pending: () => number }
}

const createHarness = (): Harness => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = createRecorder()
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

  const game = new Game({
    container: host,
    createRenderer: () => renderer,
    storage: createMemoryRecord(),
    levels: [testLevel(['#'], { name: 'CONTRATO' })],
  })
  // Contract scenarios drive the run with the intro help guide dismissed.
  game.requestToggleHelp()

  return {
    game,
    renderer,
    host,
    scheduler: {
      pending: () => callbacks.size,
      step: (timeMs: number) => {
        const due = [...callbacks.values()]
        callbacks.clear()
        for (const callback of due) callback(timeMs)
      },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('engine ↔ renderer contract', () => {
  it('builds the renderer with the host element and drives it per frame', () => {
    const { game, renderer } = createHarness()

    game.renderFrame(0.25, 0.016)

    expect(renderer.calls).toEqual(['syncWorld', 'update', 'render'])
    expect(renderer.alphas).toEqual([0.25])
    game.dispose()
    expect(renderer.calls.at(-1)).toBe('dispose')
  })

  it('keeps drawing but freezes animation while paused', () => {
    const { game, renderer } = createHarness()
    game.startRun()
    game.requestTogglePause()
    renderer.calls.length = 0

    game.renderFrame(0.5, 0.016)

    expect(renderer.calls).toEqual(['syncWorld', 'render'])
    game.dispose()
  })

  it('runs the loop from the animation frame scheduler', () => {
    const { game, renderer, scheduler } = createHarness()

    game.startEngine()
    expect(scheduler.pending()).toBe(1)

    scheduler.step(performance.now() + 1000 / 60)

    expect(renderer.calls).toContain('syncWorld')
    expect(renderer.calls).toContain('render')
    expect(scheduler.pending()).toBe(1)

    game.stopEngine()
    expect(scheduler.pending()).toBe(0)
    game.dispose()
  })

  it('routes pointer input through the renderer projection into the paddle', () => {
    const { game, host } = createHarness()
    game.startRun()
    const move = new Event('pointermove', { bubbles: true })
    Object.assign(move, { clientX: 120, clientY: 0 })

    host.dispatchEvent(move)
    game.updateFixed(1 / 120)

    // screenToWorldX(clientX / 10) → 12 world units, clamped by the field.
    expect(game.world.paddle.targetX).toBe(12)
    game.dispose()
  })

  it('stops the loop and reports when the renderer throws', () => {
    const { game, renderer, scheduler } = createHarness()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failures = collect(game.bus, 'engineError')
    renderer.flags.failRender = new Error('GPU exploded')

    game.startEngine()
    scheduler.step(performance.now() + 1000 / 60)

    expect(failures).toHaveLength(1)
    expect(failures[0].kind).toBe('engine')
    expect(failures[0].message).toContain('GPU exploded')
    expect(scheduler.pending()).toBe(0)
    expect(consoleError).toHaveBeenCalled()
    game.dispose()
  })

  it('still reports a failure thrown as a non-Error value', () => {
    const { game, renderer, scheduler } = createHarness()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failures = collect(game.bus, 'engineError')
    renderer.flags.failRender = 'plain string failure'

    game.startEngine()
    scheduler.step(performance.now() + 1000 / 60)

    expect(failures[0].message).toBe('Unknown failure in render')
    game.dispose()
  })

  it('disposes the renderer only once', () => {
    const { game, renderer } = createHarness()

    game.dispose()
    game.dispose()

    expect(renderer.calls.filter((call) => call === 'dispose')).toHaveLength(1)
  })
})
