import { useSyncExternalStore } from 'react'
import type { GameFacade } from '../bridge'
import type { HudState } from '../core/types'

/**
 * Subscribes React to the engine's snapshot. The engine pushes a new immutable
 * HudState on every HUD event, so React re-renders only when something visible
 * actually changed - and never runs inside the render loop.
 */
export const useHudState = (session: GameFacade): HudState =>
  useSyncExternalStore(session.subscribe, session.getSnapshot)
