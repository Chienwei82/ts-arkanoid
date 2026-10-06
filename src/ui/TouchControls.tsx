import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { TouchAction, TouchInput } from '../systems/TouchInput'
import { clamp } from '../utils/math'

interface TouchControlsProps {
  readonly touch: TouchInput
}

/** Fraction of the stick travel ignored, so resting fingers never drift. */
const DEAD_ZONE = 0.18
/** Knob travel as a percentage of the stick radius. */
const KNOB_TRAVEL = 32

const capturePointer = (element: Element, pointerId: number): void => {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    // The pointer can be gone before capture lands (a cancel racing the down);
    // the per-pointer bookkeeping below stays correct either way.
  }
}

interface HoldButtonProps {
  readonly label: string
  readonly action: TouchAction
  readonly touch: TouchInput
  readonly tone?: 'primary' | 'ghost'
  readonly className?: string
}

/**
 * Paper action button that triggers its action while any finger holds it.
 * Every pointer id is tracked on its own, so two thumbs can hold two buttons
 * (or a button and the stick) at the same time and a cancel never sticks.
 */
const HoldButton = ({
  label,
  action,
  touch,
  tone = 'primary',
  className = '',
}: HoldButtonProps) => {
  const pointers = useRef<Set<number>>(new Set())

  const releasePointer = (pointerId: number): void => {
    if (!pointers.current.delete(pointerId)) return
    if (pointers.current.size === 0) touch.release(action)
  }

  return (
    <button
      type="button"
      className={`btn touch-btn btn--${tone} ${className}`}
      onPointerDown={(event) => {
        capturePointer(event.currentTarget, event.pointerId)
        pointers.current.add(event.pointerId)
        touch.press(action)
      }}
      onPointerUp={(event) => releasePointer(event.pointerId)}
      onPointerCancel={(event) => releasePointer(event.pointerId)}
      onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

/**
 * On-screen controls for touch play: a virtual joystick steers the paddle and
 * three paper buttons cover every game action (launch/fire, pause, help). The
 * widgets are HTML over the canvas — never part of the three.js scene — and
 * talk to the same TouchInput sink the InputManager reads, so they are just
 * another input device for the engine.
 */
export const TouchControls = ({ touch }: TouchControlsProps) => {
  const baseRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const stickPointer = useRef<number | null>(null)

  const placeKnob = (offsetX: number, radius: number): void => {
    const knob = knobRef.current
    if (knob === null) return
    const ratio = radius > 0 ? clamp(offsetX / radius, -1, 1) : 0
    knob.style.left = `${50 + ratio * KNOB_TRAVEL}%`
  }

  const updateAxis = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const base = baseRef.current
    if (base === null) return
    const rect = base.getBoundingClientRect()
    const radius = rect.width / 2
    const offsetX = clamp(event.clientX - (rect.left + radius), -radius, radius)
    const raw = radius > 0 ? offsetX / radius : 0
    placeKnob(offsetX, radius)
    const magnitude = Math.abs(raw)
    touch.setAxis(
      magnitude <= DEAD_ZONE ? 0 : Math.sign(raw) * ((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE)),
    )
  }

  const endStick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== stickPointer.current) return
    stickPointer.current = null
    touch.setAxis(0)
    placeKnob(0, 1)
  }

  return (
    <div
      className="touch-controls"
      role="group"
      aria-label="Controles táctiles"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={baseRef}
        className="touch-stick"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (stickPointer.current !== null) return
          capturePointer(event.currentTarget, event.pointerId)
          stickPointer.current = event.pointerId
          updateAxis(event)
        }}
        onPointerMove={(event) => {
          if (event.pointerId !== stickPointer.current) return
          updateAxis(event)
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
        onLostPointerCapture={endStick}
      >
        <div ref={knobRef} className="touch-stick__knob" />
      </div>
      <div className="touch-actions">
        <HoldButton
          label="AYUDA"
          action="toggleHelp"
          touch={touch}
          tone="ghost"
          className="touch-btn--small"
        />
        <HoldButton
          label="PAUSA"
          action="togglePause"
          touch={touch}
          tone="ghost"
          className="touch-btn--small"
        />
        <HoldButton label="LANZAR" action="launch" touch={touch} className="touch-btn--fire" />
      </div>
    </div>
  )
}
