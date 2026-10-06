import type { World } from '../systems/World'
import type { GameBus } from './EventBus'

/**
 * Rendering boundary: the engine depends on this interface only, which lets
 * tests inject a null renderer and keeps three.js out of gameplay modules.
 */
export interface GameRenderer {
  syncWorld(world: World, alpha: number): void
  update(dt: number): void
  render(): void
  screenToWorldX(clientX: number, clientY: number): number
  dispose(): void
}

/** Class of the canvas the renderer mounts; shared with the CSS and cleanup. */
export const GAME_CANVAS_CLASS = 'game-canvas'

export type RendererFactory = (container: HTMLElement, bus: GameBus) => GameRenderer

/**
 * Raised when the injected renderer factory cannot create the GL context. The
 * bridge maps it to a friendly "unsupported browser" message; any other
 * start-up failure is reported as an engine error instead of pretending the
 * device has no WebGL.
 */
export class RendererInitError extends Error {
  readonly reason: unknown

  constructor(reason: unknown) {
    super('the WebGL renderer could not be created')
    this.name = 'RendererInitError'
    this.reason = reason
  }
}
