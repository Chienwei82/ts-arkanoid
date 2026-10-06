import type { AudioSignals, GameAudio } from '../src/core/audio'
import { EventBus, type GameBus } from '../src/core/EventBus'
import type { GameEventMap, GameEventName } from '../src/core/events'
import type { Ball } from '../src/entities/types'
import type { LevelDefinition } from '../src/levels'
import { CollisionSystem } from '../src/systems/CollisionSystem'
import { PowerUpSystem } from '../src/systems/PowerUpSystem'
import { ScoringSystem } from '../src/systems/ScoringSystem'
import { World } from '../src/systems/World'
import { copyVec, setVec } from '../src/utils/math'
import { createMemoryRecord } from '../src/utils/storage'

export const TEST_PALETTE: readonly string[] = ['#ff5a4a', '#3f8cff']

/** Minimal level definition used by the physics/collision specs. */
export const testLevel = (
  rows: readonly string[],
  overrides: Partial<LevelDefinition> = {},
): LevelDefinition => ({
  id: 'test-level',
  name: 'TEST',
  rows,
  palette: TEST_PALETTE,
  ballSpeed: 30,
  powerUpDropRate: 0,
  ...overrides,
})

export interface Scene {
  readonly bus: GameBus
  readonly world: World
  readonly scoring: ScoringSystem
  readonly powerUpSystem: PowerUpSystem
  readonly collision: CollisionSystem
}

export interface SceneOptions {
  readonly dropRate?: number
  /** Random source for drops: `() => 1` disables them deterministically. */
  readonly random?: () => number
}

/** Wires the gameplay systems with injected storage and randomness (no DOM). */
export const createScene = (options: SceneOptions = {}): Scene => {
  const bus = new EventBus<GameEventMap>()
  const world = new World()
  const scoring = new ScoringSystem(bus, createMemoryRecord())
  const powerUpSystem = new PowerUpSystem(bus, options.random ?? (() => 1))
  const collision = new CollisionSystem(bus, scoring, powerUpSystem)
  if (options.dropRate !== undefined) world.powerUpDropRate = options.dropRate
  return { bus, world, scoring, powerUpSystem, collision }
}

/** Collects every payload of one event, keeping the payload type intact. */
export const collect = <K extends GameEventName>(bus: GameBus, name: K): GameEventMap[K][] => {
  const items: GameEventMap[K][] = []
  bus.on(name, (payload) => {
    items.push(payload)
  })
  return items
}

/** Places an already flying ball at a position with a given direction. */
export const launchBall = (world: World, x: number, y: number, vx: number, vy: number): Ball => {
  const ball = world.spawnStuckBall()
  if (ball === undefined) throw new Error('no ball available in the pool')
  ball.stuck = false
  setVec(ball.pos, x, y)
  copyVec(ball.prev, ball.pos)
  setVec(ball.vel, vx, vy)
  return ball
}

/** Test double for the engine's audio sink: records signals and bus bindings. */
export interface AudioSpy {
  readonly audio: GameAudio
  readonly signals: AudioSignals[]
  readonly buses: (GameBus | null)[]
  toggles: number
}

export const createAudioSpy = (initial = true): AudioSpy => {
  let enabled = initial
  const spy: AudioSpy = {
    signals: [],
    buses: [],
    toggles: 0,
    audio: {
      get enabled() {
        return enabled
      },
      bind: (bus) => {
        spy.buses.push(bus)
      },
      unbind: () => {
        spy.buses.push(null)
      },
      unlock: () => undefined,
      toggle: () => {
        enabled = !enabled
        spy.toggles += 1
        return enabled
      },
      update: (_dt, signals) => {
        spy.signals.push(signals)
      },
      dispose: () => undefined,
    },
  }
  return spy
}
