import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { TouchAction, TouchInput } from '../systems/TouchInput'
import { clamp } from '../utils/math'

interface TouchControlsProps {
  readonly touch: TouchInput
}

/** Pixels of finger travel from the grab point that command full paddle speed. */
const DRAG_FULL_SPEED_PX = 72
/** Max tap duration / travel before a drag-strip touch stops counting as a tap. */
const TAP_MAX_MS = 300
const TAP_MAX_PX = 14

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
 * On-screen controls for touch play: a bottom drag strip steers the paddle
 * (drag anywhere along it, or tap it to launch/fire) and a big ergonomic fire
 * button covers launch + laser hold; pause/help stay reachable as small chips
 * above it. The widgets are HTML over the canvas — never part of the three.js
 * scene — and talk to the same TouchInput sink the InputManager reads, so they
 * are just another input device for the engine.
 */
export const TouchControls = ({ touch }: TouchControlsProps) => {
  const barPointer = useRef<number | null>(null)
  const barStartX = useRef(0)
  const barStartTime = useRef(0)

  const setBarAxis = (clientX: number): void => {
    const delta = clientX - barStartX.current
    touch.setAxis(clamp(delta / DRAG_FULL_SPEED_PX, -1, 1))
  }

  const endBar = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== barPointer.current) return
    const travel = Math.abs(event.clientX - barStartX.current)
    const duration = performance.now() - barStartTime.current
    const wasTap = travel <= TAP_MAX_PX && duration <= TAP_MAX_MS
    barPointer.current = null
    touch.setAxis(0)
    // A quick tap on the strip doubles as launch/fire so players can play
    // one-handed without reaching for the fire button.
    if (wasTap) {
      touch.press('launch')
      touch.release('launch')
    }
  }

  return (
    <div
      className="touch-controls"
      role="group"
      aria-label="Controles táctiles"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="touch-bar-row">
        <div
          className="touch-bar"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (barPointer.current !== null) return
            capturePointer(event.currentTarget, event.pointerId)
            barPointer.current = event.pointerId
            barStartX.current = event.clientX
            barStartTime.current = performance.now()
            touch.setAxis(0)
          }}
          onPointerMove={(event) => {
            if (event.pointerId !== barPointer.current) return
            setBarAxis(event.clientX)
          }}
          onPointerUp={endBar}
          onPointerCancel={endBar}
          onLostPointerCapture={endBar}
        >
          <span className="touch-bar__hint">◀ arrastra para mover · toca para lanzar ▶</span>
        </div>
        <HoldButton label="DISPARAR" action="launch" touch={touch} className="touch-btn--fire" />
      </div>
      <div className="touch-mini">
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
      </div>
    </div>
  )
}
