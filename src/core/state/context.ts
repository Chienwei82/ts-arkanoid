import type { LevelDefinition } from '../../levels'
import type { CommandTarget } from '../../systems/commands'
import type { CollisionSystem } from '../../systems/CollisionSystem'
import type { InputDispatcher } from '../../systems/InputDispatcher'
import type { InputManager } from '../../systems/InputManager'
import type { LaserSystem } from '../../systems/LaserSystem'
import type { PhysicsSystem } from '../../systems/PhysicsSystem'
import type { PowerUpSystem } from '../../systems/PowerUpSystem'
import type { ScoringSystem } from '../../systems/ScoringSystem'
import type { World } from '../../systems/World'
import type { GameBus } from '../EventBus'
import type { GameStateMachine } from './GameStateMachine'
import type { GameStatus } from '../types'

/** A state of the State pattern: entered/exited/updated by the machine. */
export interface GameState {
  readonly status: GameStatus
  enter(ctx: GameContext, from: GameStatus | null): void
  exit(ctx: GameContext, to: GameStatus): void
  update(ctx: GameContext, dt: number): void
}

/** Everything a state may touch; implemented by Game. */
export interface GameContext extends CommandTarget {
  readonly bus: GameBus
  readonly world: World
  readonly scoring: ScoringSystem
  readonly powerUpSystem: PowerUpSystem
  readonly physics: PhysicsSystem
  readonly collision: CollisionSystem
  readonly laserSystem: LaserSystem
  readonly dispatcher: InputDispatcher
  readonly input: InputManager | null
  readonly levels: readonly LevelDefinition[]
  readonly machine: GameStateMachine
  loadLevel(index: number): void
  startRun(): void
}
