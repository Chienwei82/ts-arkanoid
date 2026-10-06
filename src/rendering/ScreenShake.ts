import { RENDER } from '../config/gameConfig'

const NOISE_PRIMARY = 0.62
const NOISE_SECONDARY = 0.38
const NOISE_DETUNE = 1.7

/**
 * Trauma-based camera shake: trauma decays linearly while its square drives the
 * amplitudes, so soft hits stay a nudge and hard hits feel heavy. Two detuned
 * sines replace a random generator, which keeps the shake allocation-free and
 * reproducible between runs.
 */
export class ScreenShake {
  private trauma = 0
  private time = 0

  addTrauma(amount: number): void {
    this.trauma = Math.min(RENDER.shake.maxTrauma, this.trauma + amount)
  }

  update(dt: number): void {
    this.time += dt
    this.trauma = Math.max(0, this.trauma - RENDER.shake.decay * dt)
  }

  get strength(): number {
    return this.trauma * this.trauma
  }

  offsetX(): number {
    return this.noise(37.1) * RENDER.shake.offset * this.strength
  }

  offsetY(): number {
    return this.noise(29.7) * RENDER.shake.offset * this.strength
  }

  roll(): number {
    return this.noise(23.3) * RENDER.shake.roll * this.strength
  }

  reset(): void {
    this.trauma = 0
  }

  private noise(frequency: number): number {
    const phase = this.time * frequency
    return Math.sin(phase) * NOISE_PRIMARY + Math.sin(phase * NOISE_DETUNE) * NOISE_SECONDARY
  }
}
