import { EMPTY_INPUT_FRAME, type InputFrame } from '../../systems/InputManager'
import type { GameContext, GameState } from './context'

const readFrame = (ctx: GameContext): InputFrame => ctx.input?.takeFrame() ?? EMPTY_INPUT_FRAME

/**
 * Shared outcome checks after a playing step: level completion wins over life
 * loss, then lives are spent and the ball respawns (or the run ends).
 */
const resolveRunOutcomes = (ctx: GameContext): void => {
  if (!ctx.world.destructibleAlive) {
    const isFinal = ctx.world.levelIndex >= ctx.levels.length - 1
    ctx.bus.emit('levelCompleted', { index: ctx.world.levelIndex, isFinal })
    ctx.machine.request('levelComplete')
    return
  }
  if (ctx.world.activeBallCount > 0) return

  ctx.scoring.resetCombo()
  ctx.world.lives -= 1
  ctx.bus.emit('livesChanged', { lives: ctx.world.lives })
  ctx.bus.emit('lifeLost', { lives: ctx.world.lives })
  if (ctx.world.lives <= 0) {
    ctx.bus.emit('gameOver', {
      score: ctx.scoring.score,
      record: ctx.scoring.record,
      isRecord: ctx.scoring.isRunRecord,
    })
    ctx.machine.request('gameOver')
    return
  }
  ctx.world.spawnStuckBall()
}

export const menuState: GameState = {
  status: 'menu',
  enter(ctx) {
    // Preview ball resting on the paddle keeps the menu visually alive.
    if (ctx.world.activeBallCount === 0) ctx.world.spawnStuckBall()
  },
  exit() {},
  update(ctx) {
    ctx.dispatcher.dispatch(readFrame(ctx))
  },
}

export const playingState: GameState = {
  status: 'playing',
  enter(ctx) {
    if (ctx.world.activeBallCount === 0) ctx.world.spawnStuckBall()
  },
  exit() {},
  update(ctx, dt) {
    const frame = readFrame(ctx)
    ctx.dispatcher.dispatch(frame)
    ctx.physics.update(ctx.world, dt)
    ctx.collision.update(ctx.world)
    ctx.laserSystem.update(ctx.world, dt, frame.fire)
    ctx.powerUpSystem.update(ctx.world, dt)
    resolveRunOutcomes(ctx)
  },
}

export const pausedState: GameState = {
  status: 'paused',
  enter() {},
  exit() {},
  update(ctx) {
    ctx.dispatcher.dispatch(readFrame(ctx))
  },
}

export const levelCompleteState: GameState = {
  status: 'levelComplete',
  enter() {},
  exit() {},
  update(ctx) {
    ctx.dispatcher.dispatch(readFrame(ctx))
  },
}

export const gameOverState: GameState = {
  status: 'gameOver',
  enter() {},
  exit() {},
  update(ctx) {
    ctx.dispatcher.dispatch(readFrame(ctx))
  },
}
