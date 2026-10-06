import { describe, expect, it } from 'vitest'
import { Game } from '../src/core/Game'
import type { LevelDefinition } from '../src/levels'
import { createMemoryRecord } from '../src/utils/storage'
import { createAudioSpy, testLevel } from './helpers'

const LEVELS: readonly LevelDefinition[] = [
  testLevel(['#'], { name: 'UNO' }),
  testLevel(['#'], { name: 'DOS' }),
]

const makeGame = (audio?: ReturnType<typeof createAudioSpy>) =>
  new Game({ levels: LEVELS, storage: createMemoryRecord(), audio: audio?.audio })

describe('engine ↔ audio seam', () => {
  it('binds the audio to the engine bus and unbinds on dispose', () => {
    const spy = createAudioSpy()
    const game = makeGame(spy)

    expect(spy.buses).toEqual([game.bus])
    game.dispose()
    expect(spy.buses).toEqual([game.bus, null])
  })

  it('feeds per-frame intensity signals derived from the world', () => {
    const spy = createAudioSpy()
    const game = makeGame(spy)

    game.renderFrame(0, 0.016)
    expect(spy.signals.at(-1)).toEqual({ danger: 0, level: 0, clearance: 0, combo: 0 })

    // Last life, whole wall broken and a fat combo: everything at once.
    game.world.lives = 1
    for (const brick of game.world.bricks) brick.alive = false
    game.scoring.combo = 20
    game.renderFrame(0, 0.016)
    expect(spy.signals.at(-1)).toEqual({ danger: 1, level: 0, clearance: 1, combo: 20 })

    // Deeper into the campaign: the level signal tracks progress.
    game.loadLevel(1)
    game.renderFrame(0, 0.016)
    expect(spy.signals.at(-1)?.level).toBe(1)
  })

  it('surfaces the mute state in the HUD snapshot', () => {
    const spy = createAudioSpy(true)
    const game = makeGame(spy)

    expect(game.getHudState().audioEnabled).toBe(true)
    spy.audio.toggle()
    expect(game.getHudState().audioEnabled).toBe(false)
    expect(spy.toggles).toBe(1)
  })

  it('runs without any audio system (headless usage and tests)', () => {
    const game = makeGame()
    expect(game.getHudState().audioEnabled).toBe(true)
    expect(() => {
      game.renderFrame(0, 0.016)
    }).not.toThrow()
  })
})
