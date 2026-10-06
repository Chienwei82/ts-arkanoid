/**
 * Fixed-capacity object pool. Items are allocated once and recycled, so hot
 * paths (power-ups, projectiles, particles) never allocate after start-up.
 */
export class ObjectPool<T> {
  private readonly items: T[] = []
  private readonly free: T[] = []
  private readonly used = new Set<T>()
  private readonly resetItem: (item: T) => void

  constructor(factory: () => T, resetItem: (item: T) => void, capacity: number) {
    this.resetItem = resetItem
    for (let i = 0; i < capacity; i += 1) {
      const item = factory()
      this.items.push(item)
      this.free.push(item)
    }
  }

  /** All items, active or not; callers filter on their own `active` flag. */
  get all(): readonly T[] {
    return this.items
  }

  get activeCount(): number {
    return this.used.size
  }

  acquire(): T | undefined {
    const item = this.free.pop()
    if (item !== undefined) this.used.add(item)
    return item
  }

  release(item: T): void {
    if (!this.used.delete(item)) return
    this.resetItem(item)
    this.free.push(item)
  }

  releaseAll(): void {
    for (const item of this.used) {
      this.resetItem(item)
      this.free.push(item)
    }
    this.used.clear()
  }
}
