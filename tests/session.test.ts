import { describe, expect, it, vi } from 'vitest'
import { GameSession } from '../src/bridge/GameSession'
import { PHYSICS, SCORING } from '../src/config/gameConfig'
import type { HudState } from '../src/core/types'
import type { LevelDefinition } from '../src/levels'
import { createMemoryRecord } from '../src/utils/storage'
import { testLevel } from './helpers'

const LEVELS: readonly LevelDefinition[] = [
  testLevel(['#'], { name: 'UNO' }),
  testLevel(['#'], { name: 'DOS' }),
]

const createSession = () => new GameSession({ levels: LEVELS, storage: createMemoryRecord(250) })

const statuses = (snapshots: readonly HudState[]): string[] =>
  snapshots.map((snapshot) => snapshot.status)

/** Minimal host double: the bridge only ever queries it for a leftover canvas. */
const fakeHost = (): HTMLElement => ({ querySelector: () => null }) as unknown as HTMLElement

describe('GameSession bridge', () => {
  it('publishes an idle menu snapshot before the canvas mounts', () => {
    const session = createSession()
    const hud = session.getSnapshot()

    expect(hud.status).toBe('menu')
    expect(hud.record).toBe(250)
    expect(hud.levelName).toBe('UNO')
    expect(hud.levelTotal).toBe(2)
    expect(hud.lives).toBe(3)
  })

  it('keeps the snapshot identity stable between events', () => {
    const session = createSession()
    session.attach(null)

    expect(session.getSnapshot()).toBe(session.getSnapshot())
  })

  it('notifies subscribers when the engine state changes', () => {
    const session = createSession()
    const listener = vi.fn<() => void>()
    const seen: HudState[] = []
    session.subscribe(() => {
      listener()
      seen.push(session.getSnapshot())
    })

    const detach = session.attach(null)
    session.start()

    expect(listener).toHaveBeenCalled()
    expect(seen.at(-1)?.status).toBe('playing')
    expect(statuses(seen)).toContain('menu')
    detach()
  })

  it('returns to the idle snapshot when the canvas unmounts', () => {
    const session = createSession()
    const detach = session.attach(null)
    session.start()
    expect(session.getSnapshot().status).toBe('playing')

    detach()

    expect(session.engine).toBeNull()
    expect(session.getSnapshot().status).toBe('menu')
    expect(session.getSnapshot().score).toBe(0)
  })

  it('ignores commands while detached', () => {
    const session = createSession()
    expect(() => {
      session.start()
      session.togglePause()
      session.toggleHelp()
      session.nextLevel()
      session.quitToMenu()
    }).not.toThrow()
    expect(session.getSnapshot().status).toBe('menu')
  })

  it('mirrors the help screen toggle into the snapshot', () => {
    const session = createSession()
    session.attach(null)
    expect(session.getSnapshot().helpVisible).toBe(true)

    session.toggleHelp()
    expect(session.getSnapshot().helpVisible).toBe(false)

    session.toggleHelp()
    expect(session.getSnapshot().helpVisible).toBe(true)
  })

  it('supports the React StrictMode mount/detach/mount cycle', () => {
    const session = createSession()
    const first = session.attach(null)
    first()
    const second = session.attach(null)

    session.start()
    expect(session.getSnapshot().status).toBe('playing')
    expect(session.getSnapshot().levelTotal).toBe(2)

    second()
    expect(session.engine).toBeNull()
  })

  it('unsubscribes listeners on demand', () => {
    const session = createSession()
    const listener = vi.fn<() => void>()
    const off = session.subscribe(listener)
    off()

    session.attach(null)
    session.start()

    expect(listener).not.toHaveBeenCalled()
  })

  it('publishes a friendly error when the renderer cannot start', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const session = new GameSession({
      levels: LEVELS,
      storage: createMemoryRecord(),
      createRenderer: () => {
        throw new Error('WebGL is not available')
      },
    })
    const host = fakeHost()

    const detach = session.attach(host)

    const hud = session.getSnapshot()
    expect(hud.error?.kind).toBe('unsupported')
    expect(hud.error?.message).toContain('WebGL')
    expect(session.engine).toBeNull()

    // Starting is a no-op while the engine could not be created.
    session.start()
    expect(session.getSnapshot().status).toBe('menu')
    expect(() => {
      detach()
    }).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
  })

  it('surfaces an engine failure raised while running', () => {
    const session = createSession()
    session.attach(null)
    const game = session.engine
    if (game === null) throw new Error('expected an engine')

    game.bus.emit('engineError', { kind: 'context', message: 'Contexto perdido' })

    const hud = session.getSnapshot()
    expect(hud.error).toEqual({ kind: 'context', message: 'Contexto perdido' })
    expect(session.subscribe).toBeTypeOf('function')
  })

  it('is inert while the engine failed to start', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const session = new GameSession({
      levels: LEVELS,
      storage: createMemoryRecord(),
      createRenderer: () => {
        throw new Error('nope')
      },
    })
    session.attach(fakeHost())
    session.start()
    session.togglePause()
    session.nextLevel()
    expect(session.getSnapshot().status).toBe('menu')
  })

  it('republishes the HUD as soon as a power-up is collected', () => {
    const session = createSession()
    const detach = session.attach(null)
    session.start()
    const game = session.engine
    if (game === null) throw new Error('expected an engine')
    // Drops are caught by the paddle, so spawn one right on top of it.
    game.world.spawnPowerUp('life', game.world.paddle.pos)

    game.updateFixed(PHYSICS.fixedStep)

    expect(session.getSnapshot().lives).toBe(SCORING.startLives + 1)
    detach()
  })

  it('reports a start-up failure that is not the renderer as an engine error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const session = new GameSession({
      levels: [testLevel(['#'], { ballSpeed: 0 })],
      storage: createMemoryRecord(),
      createRenderer: () => {
        throw new Error('WebGL is not available')
      },
    })

    session.attach(fakeHost())

    const hud = session.getSnapshot()
    expect(hud.error?.kind).toBe('engine')
    expect(hud.error?.message).not.toContain('WebGL')
    expect(session.engine).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })
})
