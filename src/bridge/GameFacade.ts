import type { HudState } from '../core/types'

/**
 * Thin contract between the engine and React. The UI only ever talks to this
 * surface, and the engine never learns that React exists.
 *
 * Snapshot accessors are declared as properties because the implementation
 * binds them to its instance; the store hooks rely on that stability.
 */
export interface GameFacade {
  /**
   * Mounts (or re-mounts) the engine into a host element and returns the
   * detach function React calls on unmount. A null host runs headless.
   */
  attach(container: HTMLElement | null): () => void
  /** Cached snapshot for useSyncExternalStore; identity changes only on news. */
  readonly getSnapshot: () => HudState
  readonly subscribe: (listener: () => void) => () => void
  start(): void
  togglePause(): void
  /** Opens/closes the help guide overlay (same behaviour as the H key). */
  toggleHelp(): void
  quitToMenu(): void
  nextLevel(): void
  /** Full page reload, the only reliable recovery after a lost GL context. */
  reload(): void
}
