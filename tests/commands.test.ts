import { describe, expect, it, vi } from 'vitest'
import {
  ActionCommand,
  AxisCommand,
  PointerTargetCommand,
  type CommandTarget,
} from '../src/systems/commands'
import { InputDispatcher } from '../src/systems/InputDispatcher'
import { EMPTY_INPUT_FRAME, type InputFrame } from '../src/systems/InputManager'

const frame = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  ...EMPTY_INPUT_FRAME,
  ...overrides,
})

interface TargetSpy extends CommandTarget {
  readonly calls: string[]
}

const createTarget = (): TargetSpy => {
  const calls: string[] = []
  return {
    calls,
    movePaddleAxis: (axis) => calls.push(`axis:${axis}`),
    setPaddlePointerTarget: (x) => calls.push(`pointer:${x}`),
    requestLaunch: () => calls.push('launch'),
    requestTogglePause: () => calls.push('togglePause'),
    requestPause: () => calls.push('pause'),
    requestStart: () => calls.push('start'),
    requestNextLevel: () => calls.push('nextLevel'),
    requestQuitToMenu: () => calls.push('quitToMenu'),
    requestToggleHelp: () => calls.push('toggleHelp'),
  }
}

describe('commands', () => {
  it('carries its payload when executed', () => {
    const target = createTarget()
    const axis = new AxisCommand()
    const pointer = new PointerTargetCommand()

    axis.axis = -1
    axis.execute(target)
    pointer.x = 12.5
    pointer.execute(target)
    pointer.x = null
    pointer.execute(target)

    expect(target.calls).toEqual(['axis:-1', 'pointer:12.5', 'pointer:null'])
  })

  it('routes every action through the target', () => {
    const target = createTarget()
    const command = new ActionCommand()
    const actions = [
      'launch',
      'togglePause',
      'pause',
      'start',
      'nextLevel',
      'quitToMenu',
      'toggleHelp',
    ] as const

    for (const action of actions) {
      command.action = action
      command.execute(target)
    }

    expect(target.calls).toEqual([...actions])
  })
})

describe('InputDispatcher', () => {
  it('dispatches axis and pointer state on every frame', () => {
    const target = createTarget()
    const dispatcher = new InputDispatcher(target)

    dispatcher.dispatch(frame({ axis: 1, pointerX: 3 }))

    expect(target.calls).toEqual(['axis:1', 'pointer:3'])
  })

  it('executes edge actions in a stable order and skips absent ones', () => {
    const target = createTarget()
    const dispatcher = new InputDispatcher(target)

    dispatcher.dispatch(frame())
    expect(target.calls).toEqual(['axis:0', 'pointer:null'])

    dispatcher.dispatch(frame({ launch: true, togglePause: true, start: true }))
    expect(target.calls.slice(-3)).toEqual(['launch', 'togglePause', 'start'])

    dispatcher.dispatch(frame({ toggleHelp: true }))
    expect(target.calls.slice(-1)).toEqual(['toggleHelp'])
  })

  it('reuses its commands instead of allocating per frame', () => {
    const target = createTarget()
    const dispatcher = new InputDispatcher(target)
    const spy = vi.spyOn(ActionCommand.prototype, 'execute')

    for (let step = 0; step < 5; step += 1) {
      dispatcher.dispatch(frame({ launch: true }))
    }

    expect(spy).toHaveBeenCalledTimes(5)
    expect(target.calls.filter((call) => call === 'launch')).toHaveLength(5)
    spy.mockRestore()
  })
})
