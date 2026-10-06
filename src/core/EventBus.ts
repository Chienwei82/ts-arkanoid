import type { GameEventMap } from './events'

export type Unsubscribe = () => void
type Listener<T> = (payload: T) => void

/**
 * Small typed pub/sub hub (Observer pattern). Keys are taken from the event
 * map, so `emit('livesChanged', { ... })` type-checks both name and payload.
 */
export class EventBus<TEvents extends object> {
  private listeners: { [K in keyof TEvents]?: Set<Listener<TEvents[K]>> } = {}

  on<K extends keyof TEvents>(name: K, listener: Listener<TEvents[K]>): Unsubscribe {
    const bucket = (this.listeners[name] ??= new Set())
    bucket.add(listener)
    let active = true
    return () => {
      if (!active) return
      active = false
      bucket.delete(listener)
    }
  }

  emit<K extends keyof TEvents>(name: K, payload: TEvents[K]): void {
    this.listeners[name]?.forEach((listener) => listener(payload))
  }

  clear(): void {
    this.listeners = {}
  }
}

export type GameBus = EventBus<GameEventMap>
