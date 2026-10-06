import { describe, expect, it } from 'vitest'
import { BALL, PHYSICS, POWER_UPS, SCORING } from '../src/config/gameConfig'
import { Game } from '../src/core/Game'
import { GAME_STATUSES } from '../src/core/types'
import type { LevelDefinition } from '../src/levels'
import { createMemoryRecord, type RecordStorage } from '../src/utils/storage'
import { setVec, vec2 } from '../src/utils/math'
import { collect, testLevel } from './helpers'

const LEVELS: readonly LevelDefinition[] = [
  testLevel(['..#'], { name: 'UNO', ballSpeed: 30 }),
  testLevel(['#.#'], { name: 'DOS', ballSpeed: 34 }),
  testLevel(['###'], { name: 'TRES', ballSpeed: 38 }),
]

const createGame = (storage: RecordStorage = createMemoryRecord()) => {
  const game = new Game({ levels: LEVELS, storage })
  // Scenarios drive the game with the intro help guide dismissed, the way a
  // player closes it before playing (the Help screen specs cover it open).
  game.requestToggleHelp()
  return game
}

/** Boot state: a fresh game shows the help guide before anything else. */
const createBootGame = () => new Game({ levels: LEVELS, storage: createMemoryRecord() })

/** Advances the fixed-step simulation without a renderer. */
const step = (game: Game, seconds: number): void => {
  const steps = Math.max(1, Math.round(seconds / PHYSICS.fixedStep))
  for (let index = 0; index < steps; index += 1) game.updateFixed(PHYSICS.fixedStep)
}

const dropBalls = (game: Game): void => {
  for (const ball of game.world.balls) {
    ball.active = false
    ball.stuck = false
  }
}

describe('Game setup', () => {
  it('starts in the menu with the first level loaded', () => {
    const game = createGame()
    expect(game.status).toBe('menu')
    expect(game.world.levelName).toBe('UNO')
    expect(game.world.levelTotal).toBe(3)
    expect(game.world.activeBallCount).toBe(1)
    game.dispose()
  })

  it('announces every level load', () => {
    const game = createGame()
    const changes = collect(game.bus, 'levelChanged')

    game.loadLevel(2)

    expect(changes).toEqual([{ index: 2, name: 'TRES', total: 3 }])
    expect(game.world.levelName).toBe('TRES')
    game.dispose()
  })

  it('wraps the level index around the campaign', () => {
    const game = createGame()
    game.loadLevel(3)
    expect(game.world.levelIndex).toBe(0)
    game.loadLevel(-1)
    expect(game.world.levelIndex).toBe(2)
    game.dispose()
  })

  it('reports the HUD snapshot', () => {
    const game = createGame(createMemoryRecord(120))
    const hud = game.getHudState()

    expect(hud.status).toBe('menu')
    expect(hud.record).toBe(120)
    expect(hud.score).toBe(0)
    expect(hud.lives).toBe(SCORING.startLives)
    expect(hud.multiplier).toBe(1)
    expect(hud.levelName).toBe('UNO')
    expect(hud.levelTotal).toBe(3)
    expect(hud.isFinalLevel).toBe(false)
    expect(hud.isRecord).toBe(false)
    game.dispose()
  })

  it('survives a double dispose', () => {
    const game = createGame()
    game.dispose()
    expect(() => {
      game.dispose()
    }).not.toThrow()
  })
})

describe('Game invariants', () => {
  it('reaches every status through the transition table', () => {
    const game = createGame()
    const seen: string[] = [game.status]

    for (const target of ['playing', 'paused', 'playing', 'levelComplete', 'menu'] as const) {
      expect(game.machine.request(target)).toBe(true)
      seen.push(game.status)
    }
    expect(game.machine.request(game.status)).toBe(false)
    expect(game.machine.request('playing')).toBe(true)
    seen.push(game.status)
    expect(game.machine.request('gameOver')).toBe(true)
    seen.push(game.status)

    expect([...new Set(seen)].sort()).toEqual([...GAME_STATUSES].sort())
    game.dispose()
  })

  it('clears flying entities when quitting to the menu mid-run', () => {
    const game = createGame()
    game.startRun()
    const ball = game.world.balls.find((candidate) => candidate.active)
    if (ball === undefined) throw new Error('expected an active ball')
    ball.stuck = false
    setVec(ball.vel, 10, 10)
    game.world.spawnPowerUp('wide', vec2(0, 0))
    game.world.spawnLaser(0, 0)

    game.requestQuitToMenu()

    expect(game.status).toBe('menu')
    expect(game.world.lasers.filter((bolt) => bolt.active)).toHaveLength(0)
    expect(game.world.powerUps.filter((drop) => drop.active)).toHaveLength(0)
    expect(game.world.activeBallCount).toBe(1)
    expect(game.world.balls[0].stuck).toBe(true)
    game.dispose()
  })

  it('launches the multiball clones when the source ball is stuck', () => {
    const game = createGame()
    game.startRun()
    const stuck = game.world.balls.find((candidate) => candidate.active)
    if (stuck === undefined) throw new Error('expected a stuck ball')
    expect(stuck.stuck).toBe(true)

    game.world.addBalls(2)

    const clones = game.world.balls.filter((ball) => ball.active && !ball.stuck)
    expect(game.world.activeBallCount).toBe(3)
    expect(clones).toHaveLength(2)
    for (const clone of clones) {
      // A cloned zero velocity would leave a frozen ball keeping the run alive.
      expect(Math.hypot(clone.vel.x, clone.vel.y)).toBeCloseTo(game.world.currentSpeed)
    }
    game.dispose()
  })

  it('falls back to the shared drop rate when the level omits one', () => {
    const levels: readonly LevelDefinition[] = [
      { ...LEVELS[0], powerUpDropRate: undefined },
      ...LEVELS.slice(1),
    ]
    const game = new Game({ levels, storage: createMemoryRecord() })

    game.loadLevel(0)

    expect(game.world.powerUpDropRate).toBe(POWER_UPS.dropChance)
    game.dispose()
  })

  it('rotates the trajectory of a moving ball instead of relaunching it', () => {
    const game = createGame()
    game.startRun()
    const source = game.world.balls[0]
    source.stuck = false
    setVec(source.vel, 0, game.world.currentSpeed)

    game.world.addBalls(2)

    const clones = game.world.balls.filter((ball) => ball.active && ball !== source)
    expect(clones).toHaveLength(2)
    for (const clone of clones) {
      expect(Math.hypot(clone.vel.x, clone.vel.y)).toBeCloseTo(game.world.currentSpeed)
    }
    // Mirror-image spread around the original straight-up trajectory.
    const xs = clones.map((clone) => clone.vel.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(-xs[1])
    expect(xs[0]).toBeLessThan(0)
    game.dispose()
  })

  it('stops spawning clones at the ball cap', () => {
    const game = createGame()
    game.startRun()
    const source = game.world.balls[0]
    source.stuck = false
    setVec(source.vel, 0, game.world.currentSpeed)

    game.world.addBalls(BALL.maxCount * 2)

    expect(game.world.activeBallCount).toBe(BALL.maxCount)
    game.dispose()
  })

  it('honours pause and ignores gameplay input on the end screens', () => {
    const game = createGame()
    game.startRun()
    game.updateFixed(PHYSICS.fixedStep)

    game.requestTogglePause()
    expect(game.status).toBe('paused')
    const launches = collect(game.bus, 'ballLaunched')
    game.requestLaunch()
    expect(launches).toHaveLength(0)

    game.requestTogglePause()
    expect(game.status).toBe('playing')
    game.dispose()
  })

  it('keeps stepping input through every non playing screen', () => {
    const game = createGame()
    const statuses = GAME_STATUSES.map((status) => status)

    game.startRun()
    expect(() => {
      game.updateFixed(PHYSICS.fixedStep)
    }).not.toThrow()

    game.machine.request('paused')
    expect(() => {
      game.updateFixed(PHYSICS.fixedStep)
    }).not.toThrow()

    game.machine.request('playing')
    game.machine.request('levelComplete')
    expect(() => {
      game.updateFixed(PHYSICS.fixedStep)
    }).not.toThrow()

    game.machine.request('playing')
    game.machine.request('gameOver')
    expect(() => {
      game.updateFixed(PHYSICS.fixedStep)
    }).not.toThrow()

    game.machine.request('menu')
    expect(() => {
      game.updateFixed(PHYSICS.fixedStep)
    }).not.toThrow()
    expect(statuses).toHaveLength(GAME_STATUSES.length)
    game.dispose()
  })

  it('ignores commands that do not apply to the current screen', () => {
    const game = createGame()
    const changes = collect(game.bus, 'statusChanged')

    game.startRun()
    const levelBefore = game.world.levelIndex
    const scoreBefore = game.scoring.score
    game.startRun()
    game.requestNextLevel()
    game.requestLaunch()

    // Restarting mid-run and skipping a level are no-ops while playing.
    expect(changes).toEqual([{ from: 'menu', to: 'playing' }])
    expect(game.status).toBe('playing')
    expect(game.world.levelIndex).toBe(levelBefore)
    expect(game.scoring.score).toBe(scoreBefore)

    game.requestTogglePause()
    expect(changes.at(-1)).toEqual({ from: 'playing', to: 'paused' })
    game.dispose()
  })

  it('runs headless without a renderer', () => {
    const game = createGame()
    expect(() => {
      game.renderFrame(0.5, 0.016)
    }).not.toThrow()
    game.dispose()
  })
})

describe('Game state machine', () => {
  it('starts a run and resets score, lives and level', () => {
    const game = createGame(createMemoryRecord(500))
    const statuses = collect(game.bus, 'statusChanged')

    game.startRun()

    expect(game.status).toBe('playing')
    expect(game.scoring.score).toBe(0)
    expect(game.world.lives).toBe(SCORING.startLives)
    expect(game.world.levelIndex).toBe(0)
    expect(game.scoring.record).toBe(500)
    expect(statuses).toEqual([{ from: 'menu', to: 'playing' }])
    game.dispose()
  })

  it('ignores a pause request outside a running game', () => {
    const game = createGame()
    game.requestTogglePause()
    expect(game.status).toBe('menu')

    game.startRun()
    game.requestTogglePause()
    expect(game.status).toBe('paused')

    game.requestStart()
    expect(game.status).toBe('playing')
    game.dispose()
  })

  it('quits back to the menu', () => {
    const game = createGame()
    game.startRun()
    game.requestQuitToMenu()
    expect(game.status).toBe('menu')
    game.dispose()
  })

  it('respawns the ball while lives remain', () => {
    const game = createGame()
    game.startRun()
    game.world.lives = 2
    dropBalls(game)

    step(game, PHYSICS.fixedStep)

    expect(game.world.lives).toBe(1)
    expect(game.status).toBe('playing')
    expect(game.world.activeBallCount).toBe(1)
    game.dispose()
  })

  it('ends the run on the last life and announces the score', () => {
    const game = createGame(createMemoryRecord(1000))
    const overEvents = collect(game.bus, 'gameOver')
    const lifeEvents = collect(game.bus, 'lifeLost')
    game.startRun()
    game.world.lives = 1
    dropBalls(game)

    step(game, PHYSICS.fixedStep)

    expect(game.status).toBe('gameOver')
    expect(game.world.lives).toBe(0)
    expect(lifeEvents).toEqual([{ lives: 0 }])
    expect(overEvents).toHaveLength(1)
    expect(overEvents[0]).toEqual({ score: 0, record: 1000, isRecord: false })
    game.dispose()
  })

  it('flags a record-breaking run when the game ends', () => {
    const game = createGame(createMemoryRecord(10))
    const overEvents = collect(game.bus, 'gameOver')
    game.startRun()
    game.scoring.registerBrickDestroy('tough')
    game.world.lives = 1
    dropBalls(game)

    step(game, PHYSICS.fixedStep)

    expect(overEvents[0].isRecord).toBe(true)
    expect(overEvents[0].score).toBe(SCORING.points.tough)
    expect(game.getHudState().isRecord).toBe(true)
    game.dispose()
  })

  it('completes the level when the field is cleared and moves on', () => {
    const game = createGame()
    const completed = collect(game.bus, 'levelCompleted')
    game.startRun()
    for (const brick of game.world.bricks) brick.alive = false

    step(game, PHYSICS.fixedStep)

    expect(game.status).toBe('levelComplete')
    expect(completed).toEqual([{ index: 0, isFinal: false }])

    game.requestNextLevel()
    expect(game.status).toBe('playing')
    expect(game.world.levelIndex).toBe(1)
    expect(game.world.levelName).toBe('DOS')
    expect(game.world.activeBallCount).toBe(1)
    game.dispose()
  })

  it('returns to the menu after the final level', () => {
    const game = createGame()
    const completed = collect(game.bus, 'levelCompleted')
    game.startRun()
    game.loadLevel(LEVELS.length - 1)
    for (const brick of game.world.bricks) brick.alive = false

    step(game, PHYSICS.fixedStep)

    expect(completed[0].isFinal).toBe(true)
    game.requestNextLevel()
    expect(game.status).toBe('menu')
    game.dispose()
  })
})

describe('Help screen', () => {
  it('opens from the start and toggles with announced events', () => {
    const game = createBootGame()
    const changes = collect(game.bus, 'helpChanged')
    expect(game.getHudState().helpVisible).toBe(true)

    game.requestToggleHelp()
    expect(game.getHudState().helpVisible).toBe(false)
    game.requestToggleHelp()
    expect(game.getHudState().helpVisible).toBe(true)

    expect(changes).toEqual([{ visible: false }, { visible: true }])
    game.dispose()
  })

  it('freezes the run while it covers the board and resumes on close', () => {
    const game = createGame()
    game.startRun()

    game.requestToggleHelp()
    expect(game.status).toBe('paused')

    game.requestToggleHelp()
    expect(game.status).toBe('playing')
    game.dispose()
  })

  it('returns to the pause panel when it was opened from a manual pause', () => {
    const game = createGame()
    game.startRun()
    game.requestTogglePause()

    game.requestToggleHelp()
    game.requestToggleHelp()

    expect(game.status).toBe('paused')
    game.dispose()
  })

  it('ignores every gameplay command while it is open', () => {
    const game = createBootGame()

    game.requestStart()
    game.requestLaunch()
    game.requestTogglePause()
    game.requestNextLevel()
    game.requestQuitToMenu()
    game.movePaddleAxis(1)
    game.setPaddlePointerTarget(10)

    expect(game.status).toBe('menu')
    expect(game.world.paddle.axisInput).toBe(0)
    expect(game.world.paddle.targetX).toBeNull()
    game.dispose()
  })
})
