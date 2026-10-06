import type { GameBus } from '../core/EventBus'
import { SPEED_POWER_UPS, powerUpEffects, type PowerUpEffect } from '../entities/PowerUpEffect'
import { rollPowerUpType } from '../entities/powerUpFactory'
import type { PowerUpStatus, PowerUpType } from '../entities/types'
import type { Vec2 } from '../utils/math'
import type { World } from './World'

interface EffectSlot {
  active: boolean
  type: PowerUpType
  effect: PowerUpEffect
  remaining: number
  lastEmittedSecond: number
}

/** More slots than timed effect types, so a full board never drops effects. */
const SLOT_COUNT = 6

/**
 * Runs power-up Strategies: drops rolls, activation, timed revert. Keeps its
 * own slot pool so HUD status updates only when visible seconds change.
 */
export class PowerUpSystem {
  private readonly slots: EffectSlot[]
  private readonly bus: GameBus
  private readonly random: () => number
  /** Speed twin that currently owns the ball factor ("last pickup wins"). */
  private speedWinner: PowerUpType | null = null

  constructor(bus: GameBus, random: () => number = Math.random) {
    this.bus = bus
    this.random = random
    this.slots = Array.from({ length: SLOT_COUNT }, (): EffectSlot => ({
      active: false,
      type: 'slow',
      effect: powerUpEffects.slow,
      remaining: 0,
      lastEmittedSecond: 0,
    }))
  }

  maybeSpawn(world: World, at: Vec2): void {
    if (this.random() >= world.powerUpDropRate) return
    const type = rollPowerUpType(this.random)
    world.spawnPowerUp(type, at)
  }

  collect(world: World, type: PowerUpType): void {
    const effect = powerUpEffects[type]
    this.bus.emit('powerUpCollected', { type })
    if (effect.duration === null) {
      effect.apply(world)
      // Announce after applying: listeners snapshot the world state.
      this.emitStatus()
      return
    }
    const slot =
      this.slots.find((entry) => entry.active && entry.type === type) ??
      this.slots.find((entry) => !entry.active)
    if (slot === undefined) return
    const isNew = !slot.active
    slot.active = true
    slot.type = type
    slot.effect = effect
    slot.remaining = effect.duration
    slot.lastEmittedSecond = Math.ceil(effect.duration)
    if (SPEED_POWER_UPS.includes(type)) {
      // Last pickup wins: while both twins run, the newest one owns the factor.
      this.speedWinner = type
      effect.apply(world)
    } else if (isNew) {
      effect.apply(world)
    }
    this.emitStatus()
  }

  update(world: World, dt: number): void {
    let changed = false
    for (const slot of this.slots) {
      if (!slot.active) continue
      slot.remaining -= dt
      if (slot.remaining <= 0) {
        slot.active = false
        slot.effect.revert(world)
        if (SPEED_POWER_UPS.includes(slot.type)) this.resolveSpeedWinner(world)
        this.bus.emit('powerUpExpired', { type: slot.type })
        changed = true
        continue
      }
      const visibleSecond = Math.ceil(slot.remaining)
      if (visibleSecond !== slot.lastEmittedSecond) {
        slot.lastEmittedSecond = visibleSecond
        changed = true
      }
    }
    if (!changed) return
    this.emitStatus()
  }

  isActive(type: PowerUpType): boolean {
    return this.slots.some((slot) => slot.active && slot.type === type)
  }

  /** Reverts every running effect (level change / new run). */
  reset(world: World): void {
    this.speedWinner = null
    let any = false
    for (const slot of this.slots) {
      if (!slot.active) continue
      slot.active = false
      slot.effect.revert(world)
      any = true
    }
    if (any) this.emitStatus()
  }

  snapshot(): PowerUpStatus[] {
    return this.slots
      .filter((slot) => slot.active)
      .map((slot) => ({ type: slot.type, remaining: slot.remaining }))
  }

  /**
   * revert() resets the speed factor to 1 unconditionally, so whenever a speed
   * effect leaves the board the winner (or the surviving twin) must take the
   * factor over again.
   */
  private resolveSpeedWinner(world: World): void {
    const winner =
      this.speedWinner !== null && this.isActive(this.speedWinner)
        ? this.speedWinner
        : (this.slots.find((slot) => slot.active && SPEED_POWER_UPS.includes(slot.type))?.type ??
          null)
    this.speedWinner = winner
    if (winner !== null) powerUpEffects[winner].apply(world)
  }

  private emitStatus(): void {
    this.bus.emit('powerUpsChanged', { active: this.snapshot() })
  }
}
