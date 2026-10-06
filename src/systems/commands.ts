/**
 * Command pattern: input devices translate raw events into these objects, and
 * the game only ever executes commands — devices stay out of gameplay logic.
 */
export interface CommandTarget {
  movePaddleAxis(axis: number): void
  setPaddlePointerTarget(x: number | null): void
  requestLaunch(): void
  requestTogglePause(): void
  requestPause(): void
  requestStart(): void
  requestNextLevel(): void
  requestQuitToMenu(): void
  requestToggleHelp(): void
}

export interface Command {
  execute(target: CommandTarget): void
}

export type GameAction =
  'launch' | 'togglePause' | 'pause' | 'start' | 'nextLevel' | 'quitToMenu' | 'toggleHelp'

/** Reusable command whose payload is refreshed before each execution. */
export class AxisCommand implements Command {
  axis = 0

  execute(target: CommandTarget): void {
    target.movePaddleAxis(this.axis)
  }
}

export class PointerTargetCommand implements Command {
  x: number | null = null

  execute(target: CommandTarget): void {
    target.setPaddlePointerTarget(this.x)
  }
}

export class ActionCommand implements Command {
  action: GameAction = 'launch'

  execute(target: CommandTarget): void {
    switch (this.action) {
      case 'launch':
        target.requestLaunch()
        break
      case 'togglePause':
        target.requestTogglePause()
        break
      case 'pause':
        target.requestPause()
        break
      case 'start':
        target.requestStart()
        break
      case 'nextLevel':
        target.requestNextLevel()
        break
      case 'quitToMenu':
        target.requestQuitToMenu()
        break
      case 'toggleHelp':
        target.requestToggleHelp()
        break
    }
  }
}
