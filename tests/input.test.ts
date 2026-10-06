// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputManager } from '../src/systems/InputManager'
import { TouchInput } from '../src/systems/TouchInput'

interface Harness {
  readonly manager: InputManager
  readonly host: HTMLDivElement
  readonly hidden: ReturnType<typeof vi.fn>
}

const key = (type: 'keydown' | 'keyup', code: string): KeyboardEvent =>
  new KeyboardEvent(type, { code, cancelable: true, repeat: false })

const pointer = (type: string, clientX: number): PointerEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY: 0 })
  return event as PointerEvent
}

const createHarness = (): Harness => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const hidden = vi.fn<() => void>()
  const manager = new InputManager(host, (clientX) => clientX / 10, hidden)
  manager.attach()
  return { manager, host, hidden }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('InputManager', () => {
  it('maps keyboard axis keys and prevents page scrolling', () => {
    const { manager } = createHarness()
    const down = key('keydown', 'ArrowLeft')
    window.dispatchEvent(down)

    expect(manager.takeFrame().axis).toBe(-1)
    expect(down.defaultPrevented).toBe(true)

    window.dispatchEvent(key('keydown', 'KeyD'))
    expect(manager.takeFrame().axis).toBe(0)

    window.dispatchEvent(key('keyup', 'ArrowLeft'))
    expect(manager.takeFrame().axis).toBe(1)
  })

  it('consumes edge flags so one press fires exactly once', () => {
    const { manager } = createHarness()
    window.dispatchEvent(key('keydown', 'Space'))

    const first = manager.takeFrame()
    expect(first.launch).toBe(true)
    expect(first.start).toBe(true)
    expect(first.fire).toBe(true)

    const second = manager.takeFrame()
    expect(second.launch).toBe(false)
    expect(second.start).toBe(false)
    expect(second.fire).toBe(true)
  })

  it('tracks the pointer position through the injected mapper', () => {
    const { manager, host } = createHarness()
    host.dispatchEvent(pointer('pointermove', 120))
    expect(manager.takeFrame().pointerX).toBe(12)

    host.dispatchEvent(pointer('pointerdown', 250))
    const frame = manager.takeFrame()
    expect(frame.pointerX).toBe(25)
    expect(frame.launch).toBe(true)

    window.dispatchEvent(new Event('pointerup'))
    expect(manager.takeFrame().fire).toBe(false)
  })

  it('hands control to the keyboard instead of a stale pointer target', () => {
    const { manager, host } = createHarness()
    host.dispatchEvent(pointer('pointermove', 120))
    expect(manager.takeFrame().pointerX).toBe(12)

    window.dispatchEvent(key('keydown', 'ArrowRight'))

    const frame = manager.takeFrame()
    expect(frame.pointerX).toBeNull()
    expect(frame.axis).toBe(1)
  })

  it('releases held keys and pauses when focus is lost', () => {
    const { manager, hidden } = createHarness()
    window.dispatchEvent(key('keydown', 'Space'))
    manager.takeFrame()

    window.dispatchEvent(new Event('blur'))

    const frame = manager.takeFrame()
    expect(frame.fire).toBe(false)
    expect(hidden).toHaveBeenCalledTimes(1)
  })

  it('pauses when the tab becomes hidden', () => {
    const { hidden } = createHarness()
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    document.dispatchEvent(new Event('visibilitychange'))

    expect(hidden).toHaveBeenCalledTimes(1)
    state.mockRestore()
  })

  it('blocks the context menu over the play area', () => {
    const { host } = createHarness()
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true })

    host.dispatchEvent(menu)

    expect(menu.defaultPrevented).toBe(true)
  })

  it('tracks the pause and confirm keys as edges', () => {
    const { manager } = createHarness()
    window.dispatchEvent(key('keydown', 'Escape'))

    const paused = manager.takeFrame()
    expect(paused.togglePause).toBe(true)
    expect(manager.takeFrame().togglePause).toBe(false)

    window.dispatchEvent(key('keydown', 'KeyP'))
    expect(manager.takeFrame().togglePause).toBe(true)

    window.dispatchEvent(key('keydown', 'Enter'))
    expect(manager.takeFrame().start).toBe(true)
  })

  it('tracks the help key as an edge', () => {
    const { manager } = createHarness()
    window.dispatchEvent(key('keydown', 'KeyH'))

    expect(manager.takeFrame().toggleHelp).toBe(true)
    expect(manager.takeFrame().toggleHelp).toBe(false)
  })

  it('ignores keys it does not map', () => {
    const { manager } = createHarness()
    const unmapped = key('keydown', 'KeyQ')
    window.dispatchEvent(unmapped)

    const frame = manager.takeFrame()
    expect(frame.axis).toBe(0)
    expect(frame.launch).toBe(false)
    expect(unmapped.defaultPrevented).toBe(false)
  })

  it('blocks page scrolling only for the mapped keys', () => {
    const { manager } = createHarness()
    const arrow = key('keydown', 'ArrowRight')
    const space = key('keydown', 'Space')
    window.dispatchEvent(arrow)
    window.dispatchEvent(space)

    expect(arrow.defaultPrevented).toBe(true)
    expect(space.defaultPrevented).toBe(true)
    expect(manager.takeFrame().launch).toBe(true)
  })

  it('detaches every listener on dispose', () => {
    const { manager, host, hidden } = createHarness()
    manager.dispose()

    window.dispatchEvent(key('keydown', 'Space'))
    window.dispatchEvent(new Event('blur'))
    host.dispatchEvent(pointer('pointermove', 90))

    const frame = manager.takeFrame()
    expect(frame.axis).toBe(0)
    expect(frame.pointerX).toBeNull()
    expect(frame.launch).toBe(false)
    expect(hidden).not.toHaveBeenCalled()

    manager.dispose()
  })
})

describe('InputManager with a touch source', () => {
  it('folds on-screen controls into the same frame as the keyboard', () => {
    const touch = new TouchInput()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const manager = new InputManager(host, null, vi.fn<() => void>(), touch)
    manager.attach()

    window.dispatchEvent(key('keydown', 'ArrowLeft'))
    touch.setAxis(1)
    touch.press('launch')
    touch.press('togglePause')

    const frame = manager.takeFrame()
    expect(frame.axis).toBe(0)
    expect(frame.launch).toBe(true)
    expect(frame.start).toBe(true)
    expect(frame.fire).toBe(true)
    expect(frame.togglePause).toBe(true)

    manager.dispose()
  })

  it('drops touch state together with the keys on focus loss', () => {
    const touch = new TouchInput()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const manager = new InputManager(host, null, vi.fn<() => void>(), touch)
    manager.attach()

    touch.setAxis(1)
    touch.press('launch')
    window.dispatchEvent(new Event('blur'))

    const frame = manager.takeFrame()
    expect(frame.axis).toBe(0)
    expect(frame.fire).toBe(false)
    expect(frame.launch).toBe(false)
    manager.dispose()
  })
})
