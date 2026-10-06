import { ActionCommand, AxisCommand, PointerTargetCommand, type CommandTarget } from './commands'
import type { InputFrame } from './InputManager'

/**
 * Turns an InputFrame into executed Commands using pre-allocated instances,
 * so the fixed-step loop never allocates command objects.
 */
export class InputDispatcher {
  private readonly target: CommandTarget
  private readonly axisCommand = new AxisCommand()
  private readonly pointerCommand = new PointerTargetCommand()
  private readonly actionCommand = new ActionCommand()

  constructor(target: CommandTarget) {
    this.target = target
  }

  dispatch(frame: InputFrame): void {
    this.axisCommand.axis = frame.axis
    this.axisCommand.execute(this.target)

    this.pointerCommand.x = frame.pointerX
    this.pointerCommand.execute(this.target)

    if (frame.launch) {
      this.actionCommand.action = 'launch'
      this.actionCommand.execute(this.target)
    }
    if (frame.togglePause) {
      this.actionCommand.action = 'togglePause'
      this.actionCommand.execute(this.target)
    }
    if (frame.start) {
      this.actionCommand.action = 'start'
      this.actionCommand.execute(this.target)
    }
    if (frame.toggleHelp) {
      this.actionCommand.action = 'toggleHelp'
      this.actionCommand.execute(this.target)
    }
  }
}
