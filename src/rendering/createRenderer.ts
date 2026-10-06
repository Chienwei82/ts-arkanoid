import type { RendererFactory } from '../core/renderer'
import { CraftGameRenderer } from './CraftGameRenderer'

/**
 * Renderer factory handed to the engine at start-up. Keeping it here means the
 * core only ever sees the GameRenderer interface.
 */
export const createGameRenderer: RendererFactory = (container, bus) =>
  new CraftGameRenderer(container, bus)
