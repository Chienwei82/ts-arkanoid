import type { GameStatus } from '../types'
import type { GameContext, GameState } from './context'
import { gameOverState, levelCompleteState, menuState, pausedState, playingState } from './states'

const ALLOWED_TRANSITIONS: Readonly<Record<GameStatus, readonly GameStatus[]>> = {
  menu: ['playing'],
  playing: ['paused', 'levelComplete', 'gameOver', 'menu'],
  paused: ['playing', 'menu'],
  levelComplete: ['playing', 'menu'],
  gameOver: ['playing', 'menu'],
}

const stateFor = (status: GameStatus): GameState => {
  switch (status) {
    case 'menu':
      return menuState
    case 'playing':
      return playingState
    case 'paused':
      return pausedState
    case 'levelComplete':
      return levelCompleteState
    case 'gameOver':
      return gameOverState
  }
}

/**
 * State pattern: owns the active GameState, validates transitions and emits
 * `statusChanged` so effects/UI react to every screen change.
 */
export class GameStateMachine {
  private readonly ctx: GameContext
  private state: GameState

  constructor(ctx: GameContext, initial: GameStatus) {
    this.ctx = ctx
    this.state = stateFor(initial)
    this.state.enter(ctx, null)
  }

  get status(): GameStatus {
    return this.state.status
  }

  get current(): GameState {
    return this.state
  }

  request(to: GameStatus): boolean {
    if (to === this.state.status) return false
    if (!ALLOWED_TRANSITIONS[this.state.status].includes(to)) return false
    const from = this.state.status
    this.state.exit(this.ctx, to)
    this.state = stateFor(to)
    this.state.enter(this.ctx, from)
    this.ctx.bus.emit('statusChanged', { from, to })
    return true
  }
}
