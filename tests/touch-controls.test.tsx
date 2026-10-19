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

const barOf = (container: HTMLElement): HTMLElement => {
  const bar = container.querySelector<HTMLElement>('.touch-bar')
  if (bar === null) throw new Error('drag bar not rendered')
  return bar
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TouchControls', () => {
  it('renders the drag bar and one button per game action', () => {
    const { container } = render(<TouchControls touch={new TouchInput()} />)

    expect(barOf(container)).not.toBeNull()
    for (const label of ['DISPARAR', 'PAUSA', 'AYUDA']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull()
    }
  })

  it('steers the paddle axis while dragging and stops on release', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const bar = barOf(container)

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 100, clientY: 400 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 172, clientY: 400 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 64, clientY: 400 })
    expect(take(touch).axis).toBeCloseTo(-0.5, 5)

    vi.spyOn(performance, 'now').mockReturnValue(10_000)
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 64, clientY: 400 })
    expect(take(touch).axis).toBe(0)
  })

  it('fires a launch edge when the bar is tapped', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const bar = barOf(container)

    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1100)
    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 200, clientY: 400 })
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 203, clientY: 402 })

    const first = take(touch)
    expect(first.launch).toBe(true)
    expect(first.start).toBe(true)
    expect(take(touch).launch).toBe(false)
  })

  it('supports multitouch: drag bar and fire button held at the same time', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const bar = barOf(container)

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 100, clientY: 400 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 172, clientY: 400 })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'DISPARAR' }), {
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
    const fire = screen.getByRole('button', { name: 'DISPARAR' })

    fireEvent.pointerDown(fire, { pointerId: 1 })
    fireEvent.pointerDown(fire, { pointerId: 2 })
    expect(take(touch).fire).toBe(true)

    fireEvent.pointerUp(fire, { pointerId: 1 })
    expect(take(touch).fire).toBe(true)

    fireEvent.pointerCancel(fire, { pointerId: 2 })
    expect(take(touch).fire).toBe(false)
  })

  it('releases the drag bar on pointercancel so the paddle never drifts', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const bar = barOf(container)

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 100, clientY: 400 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 172, clientY: 400 })
    expect(take(touch).axis).not.toBe(0)

    fireEvent.pointerCancel(bar, { pointerId: 1 })
    expect(take(touch).axis).toBe(0)
  })

  it('ignores a second finger on the drag bar and follows the first', () => {
    const touch = new TouchInput()
    const { container } = render(<TouchControls touch={touch} />)
    const bar = barOf(container)

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 100, clientY: 400 })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 172, clientY: 400 })
    fireEvent.pointerDown(bar, { pointerId: 2, clientX: 300, clientY: 400 })
    fireEvent.pointerMove(bar, { pointerId: 2, clientX: 100, clientY: 400 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    vi.spyOn(performance, 'now').mockReturnValue(10_000)
    fireEvent.pointerUp(bar, { pointerId: 2 })
    expect(take(touch).axis).toBeCloseTo(1, 5)

    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 172, clientY: 400 })
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
