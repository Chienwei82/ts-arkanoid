import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../src/core/EventBus'
import { ObjectPool } from '../src/utils/ObjectPool'
import {
  boxesOverlap,
  circleIntersectsBox,
  reflectVelocity,
  resolveCircleBox,
} from '../src/utils/collision'
import { clamp, copyVec, hexToInt, lerp, setVec, vec2, vecDistance } from '../src/utils/math'

describe('math helpers', () => {
  it('clamps values into the given range', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-5, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('interpolates between two values', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(-4, 4, 0)).toBe(-4)
  })

  it('converts #rrggbb into the integer form used by three.js and events', () => {
    expect(hexToInt('#ffffff')).toBe(0xffffff)
    expect(hexToInt('#3a2417')).toBe(0x3a2417)
  })

  it('mutates vectors in place to stay allocation-free', () => {
    const target = vec2(1, 2)
    setVec(target, 3, 4)
    expect(target).toEqual({ x: 3, y: 4 })

    copyVec(target, vec2(-1, -2))
    expect(target).toEqual({ x: -1, y: -2 })
    expect(vecDistance(vec2(0, 0), vec2(3, 4))).toBe(5)
  })
})

describe('collision geometry', () => {
  it('detects circle/box contact', () => {
    expect(circleIntersectsBox(vec2(0, 1.8), 1, vec2(0, 0), 2, 1)).toBe(true)
    expect(circleIntersectsBox(vec2(0, 2.6), 1, vec2(0, 0), 2, 1)).toBe(false)
    expect(circleIntersectsBox(vec2(2.9, 0), 1, vec2(0, 0), 2, 1)).toBe(true)
  })

  it('pushes the circle out and reflects its velocity', () => {
    const position = vec2(0, 1.8)
    const velocity = vec2(0, -4)
    expect(resolveCircleBox(position, 1, vec2(0, 0), 2, 1, velocity)).toBe(true)
    expect(position.y).toBeCloseTo(2)
    expect(velocity.y).toBeGreaterThan(0)
  })

  it('reports no contact when the shapes are apart', () => {
    const position = vec2(0, 6)
    const velocity = vec2(0, -4)
    expect(resolveCircleBox(position, 1, vec2(0, 0), 2, 1, velocity)).toBe(false)
    expect(velocity.y).toBe(-4)
  })

  it('ignores reflections that would pull a separating contact closer', () => {
    const velocity = vec2(0, 3)
    reflectVelocity(velocity, 0, 1)
    expect(velocity.y).toBe(3)
  })

  it('detects axis aligned box overlap', () => {
    expect(boxesOverlap(vec2(0, 0), 1, 1, vec2(1.5, 0), 1, 1)).toBe(true)
    expect(boxesOverlap(vec2(0, 0), 1, 1, vec2(2.5, 0), 1, 1)).toBe(false)
  })
})

describe('ObjectPool', () => {
  it('recycles items and resets them on release', () => {
    const reset = vi.fn<(item: { active: boolean }) => void>((item) => {
      item.active = false
    })
    const pool = new ObjectPool<{ active: boolean }>(() => ({ active: true }), reset, 2)

    const first = pool.acquire()
    const second = pool.acquire()
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(pool.activeCount).toBe(2)
    expect(pool.acquire()).toBeUndefined()

    if (first === undefined) throw new Error('pool returned nothing')
    pool.release(first)
    expect(reset).toHaveBeenCalledWith(first)
    expect(pool.activeCount).toBe(1)
    expect(pool.acquire()).toBe(first)
  })

  it('releases everything at once', () => {
    const pool = new ObjectPool<number>(
      () => 0,
      () => undefined,
      3,
    )
    pool.acquire()
    pool.acquire()
    pool.releaseAll()
    expect(pool.activeCount).toBe(0)
    expect(pool.all).toHaveLength(3)
  })

  it('releases each item only once', () => {
    const pool = new ObjectPool<number>(
      () => 1,
      () => undefined,
      1,
    )
    const item = pool.acquire()
    if (item === undefined) throw new Error('pool returned nothing')
    pool.release(item)
    pool.release(item)
    expect(pool.all).toHaveLength(1)
    expect(pool.activeCount).toBe(0)
  })
})

describe('EventBus', () => {
  it('delivers payloads to every listener of a channel', () => {
    const bus = new EventBus<{ ping: { value: number } }>()
    const first = vi.fn<(payload: { value: number }) => void>()
    const second = vi.fn<(payload: { value: number }) => void>()
    bus.on('ping', first)
    bus.on('ping', second)

    bus.emit('ping', { value: 7 })
    expect(first).toHaveBeenCalledWith({ value: 7 })
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes safely, even twice', () => {
    const bus = new EventBus<{ ping: number }>()
    const listener = vi.fn<(payload: number) => void>()
    const off = bus.on('ping', listener)

    off()
    off()
    bus.emit('ping', 1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('drops every listener on clear', () => {
    const bus = new EventBus<{ ping: number }>()
    const listener = vi.fn<(payload: number) => void>()
    bus.on('ping', listener)
    bus.clear()
    bus.emit('ping', 1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps channels isolated', () => {
    const bus = new EventBus<{ a: number; b: number }>()
    const listenerA = vi.fn<(payload: number) => void>()
    const listenerB = vi.fn<(payload: number) => void>()
    bus.on('a', listenerA)
    bus.on('b', listenerB)

    bus.emit('a', 5)
    expect(listenerA).toHaveBeenCalledWith(5)
    expect(listenerB).not.toHaveBeenCalled()
  })
})
