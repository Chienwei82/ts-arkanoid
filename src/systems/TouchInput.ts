import { clamp } from '../utils/math'
import type { InputFrame } from './InputManager'

/** Held or tapped actions the on-screen widgets can trigger. */
export type TouchAction = 'launch' | 'togglePause' | 'toggleHelp'

/**
 * Touch input source fed by the on-screen controls: a virtual joystick writes
 * the movement axis and buttons press/release actions. `mergeInto` folds this
 * state into the same InputFrame the keyboard and mouse produce, so gameplay
 * never learns where the input came from. State is per-session, not per-frame:
 * no allocation happens on the hot path.
 */
export class TouchInput {
  private axisValue = 0
  private fireHeld = false
  private edgeLaunch = false
  private edgePause = false
  private edgeHelp = false

  /** Joystick position in the -1..1 range. */
  setAxis(axis: number): void {
    this.axisValue = clamp(axis, -1, 1)
  }

  press(action: TouchAction): void {
    switch (action) {
      case 'launch':
        // Mirrors the Space key: one button both launches and holds the laser
        // trigger, exactly like the keyboard mapping.
        this.edgeLaunch = true
        this.fireHeld = true
        break
      case 'togglePause':
        this.edgePause = true
        break
      case 'toggleHelp':
        this.edgeHelp = true
        break
    }
  }

  release(action: TouchAction): void {
    if (action === 'launch') this.fireHeld = false
  }

  /** Drops every held and pending state (blur, hidden tab, widget unmount). */
  releaseAll(): void {
    this.axisValue = 0
    this.fireHeld = false
    this.edgeLaunch = false
    this.edgePause = false
    this.edgeHelp = false
  }

  /** ORs its contribution into the frame and consumes one-shot edges. */
  mergeInto(frame: InputFrame): void {
    if (this.axisValue !== 0) frame.axis = clamp(frame.axis + this.axisValue, -1, 1)
    if (this.edgeLaunch) {
      frame.launch = true
      frame.start = true
      this.edgeLaunch = false
    }
    if (this.fireHeld) frame.fire = true
    if (this.edgePause) {
      frame.togglePause = true
      this.edgePause = false
    }
    if (this.edgeHelp) {
      frame.toggleHelp = true
      this.edgeHelp = false
    }
  }
}
