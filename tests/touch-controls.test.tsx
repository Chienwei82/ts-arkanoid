// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_INPUT_FRAME, type InputFrame } from '../src/systems/InputManager'
import { TouchInput } from '../src/systems/TouchInput'
import { TouchControls } from '../src/ui/TouchControls'

const take = (touch: TouchInput): InputFrame => {
  const next: InputFrame = { ...EMPTY_INPUT_FRAME }
  touch.mergeInto(next)
  return next
}

/** jsdom lays everything out at zero; the stick needs a real box to measure. */
const stubStickRect = (element: Element): void => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

const stickOf = (container: HTMLElement): HTMLElement => {
  const stick = container.querySelector<HTMLElement>('.touch-stick')
  if (stick === null) throw new Error('joystick not rendered')
  stubStickRect(stick)
  return stick
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TouchControls', () => {
  it('renders the joystick and one button per game action', () => {
    const { container } = render(<TouchControls touch={new TouchInput()} />)

    expect(stickOf(container)).not.toBeNull()
    for (const label of ['LANZAR', 'PAUSA', 'AYUDA']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull()
    }
  })

  it('steers the paddle axis from the joystick and re-centres on release', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const stick = stickOf(container)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 75, clientY: 50 })
    expect(take(touch).axis).toBeCloseTo(0.39, 2)

    fireEvent.pointerUp(stick, { pointerId: 1, clientX: 75, clientY: 50 })
    expect(take(touch).axis).toBe(0)
  })

  it('supports multitouch: joystick and button held at the same time', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const stick = stickOf(container)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'LANZAR' }), {
      pointerId: 2,
      clientX: 300,
      clientY: 400,
    })

    const frame = take(touch)
    expect(frame.axis).toBeCloseTo(1, 5)
    expect(frame.launch).toBe(true)
    expect(frame.start).toBe(true)
    expect(frame.fire).toBe(true)
  })

  it('keeps firing until every finger leaves the button', () => {
    const touch = new TouchInput()
    render(<TouchControls touch={touch} />)
    const fire = screen.getByRole('button', { name: 'LANZAR' })

    fireEvent.pointerDown(fire, { pointerId: 1 })
    fireEvent.pointerDown(fire, { pointerId: 2 })
    expect(take(touch).fire).toBe(true)

    fireEvent.pointerUp(fire, { pointerId: 1 })
    expect(take(touch).fire).toBe(true)

    fireEvent.pointerCancel(fire, { pointerId: 2 })
    expect(take(touch).fire).toBe(false)
  })

  it('releases the joystick on pointercancel so the paddle never drifts', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const stick = stickOf(container)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(take(touch).axis).not.toBe(0)

    fireEvent.pointerCancel(stick, { pointerId: 1 })
    expect(take(touch).axis).toBe(0)
  })

  it('ignores a second finger on the joystick and follows the first', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const stick = stickOf(container)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    fireEvent.pointerDown(stick, { pointerId: 2, clientX: 0, clientY: 50 })
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 0, clientY: 50 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    fireEvent.pointerUp(stick, { pointerId: 2 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    fireEvent.pointerUp(stick, { pointerId: 1 })
    expect(take(touch).axis).toBe(0)
  })

  it('emits pause and help as one-shot taps', () => {
    const touch = new TouchInput()
    render(<TouchControls touch={touch} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'PAUSA' }), { pointerId: 1 })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'AYUDA' }), { pointerId: 2 })

    const frame = take(touch)
    expect(frame.togglePause).toBe(true)
    expect(frame.toggleHelp).toBe(true)
    expect(take(touch).togglePause).toBe(false)
  })
})
