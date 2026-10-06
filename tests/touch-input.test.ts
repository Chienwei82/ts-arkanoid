import { describe, expect, it } from 'vitest'
import { EMPTY_INPUT_FRAME, type InputFrame } from '../src/systems/InputManager'
import { TouchInput } from '../src/systems/TouchInput'

const frame = (): InputFrame => ({ ...EMPTY_INPUT_FRAME })

/** Merges the touch state into a fresh frame the way InputManager does. */
const take = (touch: TouchInput): InputFrame => {
  const next = frame()
  touch.mergeInto(next)
  return next
}

describe('TouchInput', () => {
  it('feeds the joystick axis into the frame and clamps it', () => {
    const touch = new TouchInput()
    touch.setAxis(0.5)
    expect(take(touch).axis).toBe(0.5)

    touch.setAxis(-4)
    expect(take(touch).axis).toBe(-1)
  })

  it('mirrors the Space key for the launch button', () => {
    const touch = new TouchInput()
    touch.press('launch')

    const first = take(touch)
    expect(first.launch).toBe(true)
    expect(first.start).toBe(true)
    expect(first.fire).toBe(true)

    // Held fire stays until release, but the edges fire only once.
    const second = take(touch)
    expect(second.launch).toBe(false)
    expect(second.start).toBe(false)
    expect(second.fire).toBe(true)

    touch.release('launch')
    expect(take(touch).fire).toBe(false)
  })

  it('consumes pause and help taps as one-shot edges', () => {
    const touch = new TouchInput()
    touch.press('togglePause')
    touch.press('toggleHelp')

    const first = take(touch)
    expect(first.togglePause).toBe(true)
    expect(first.toggleHelp).toBe(true)
    expect(take(touch).togglePause).toBe(false)
    expect(take(touch).toggleHelp).toBe(false)
  })

  it('only adds to the frame, never masks keyboard state', () => {
    const touch = new TouchInput()
    touch.setAxis(1)
    touch.press('launch')

    const base: InputFrame = { ...frame(), axis: -1, fire: true, launch: true }
    touch.mergeInto(base)
    expect(base.axis).toBe(0)
    expect(base.fire).toBe(true)
    expect(base.launch).toBe(true)
    expect(base.start).toBe(true)
  })

  it('drops every held and pending state with releaseAll', () => {
    const touch = new TouchInput()
    touch.setAxis(1)
    touch.press('launch')
    touch.press('togglePause')

    touch.releaseAll()
    const next = take(touch)
    expect(next.axis).toBe(0)
    expect(next.launch).toBe(false)
    expect(next.fire).toBe(false)
    expect(next.togglePause).toBe(false)
  })
})
