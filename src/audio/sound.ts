/**
 * SoundFX: a tiny WebAudio synth for the gameplay blips. No assets: every sound
 * is a couple of oscillators with a short envelope. `unlock()` has to be called
 * from a user gesture (autoplay policy); until then every `play` is a no-op, so
 * it is safe to call anywhere and safe to run in tests (no AudioContext).
 */
export type SoundName =
  | 'launch'
  | 'paddle'
  | 'wall'
  | 'brick'
  | 'crack'
  | 'explode'
  | 'powerup'
  | 'laser'
  | 'life'
  | 'levelclear'
  | 'gameover'
  | 'record'

export class SoundFX {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** true from the first user gesture: autoplay policy requires creating and
      resuming the AudioContext inside a gesture (otherwise Chrome blocks it). */
  private unlocked = false
  enabled = true

  private ensure(): AudioContext | null {
    // Without a previous gesture the context is not created: the browser would
    // block it and warn "The AudioContext was not allowed to start".
    if (!this.enabled || !this.unlocked) return null
    try {
      if (this.ctx === null) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (Ctor === undefined) return null
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.16
        this.master.connect(this.ctx.destination)
      }
      // After a gesture there has been interaction: resuming is safe (no warning).
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  /** Call from a user gesture (pointerdown/keydown/touchend/click). */
  unlock(): void {
    this.unlocked = true
    this.ensure()
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    vol = 1,
    when = 0,
    slide = 0,
  ): void {
    const ctx = this.ensure()
    if (ctx === null || this.master === null) return
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slide !== 0)
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  /** Plays an arpeggio/glissando built from simple tones. */
  private seq(
    freqs: readonly number[],
    dur: number,
    type: OscillatorType,
    vol: number,
    gap: number,
    slide = 0,
  ): void {
    freqs.forEach((freq, i) => this.tone(freq, dur, type, vol, i * gap, slide))
  }

  play(name: SoundName): void {
    if (!this.enabled) return
    switch (name) {
      case 'launch':
        this.tone(320, 0.12, 'square', 0.45, 0, 300)
        break
      case 'paddle':
        this.tone(240, 0.06, 'triangle', 0.4, 0, 60)
        break
      case 'wall':
        this.tone(170, 0.035, 'square', 0.16)
        break
      case 'brick':
        this.tone(540, 0.05, 'square', 0.4)
        this.tone(810, 0.05, 'square', 0.18, 0.01)
        break
      case 'crack':
        this.tone(280, 0.05, 'triangle', 0.35)
        break
      case 'explode':
        this.tone(220, 0.26, 'sawtooth', 0.5, 0, -165)
        this.tone(90, 0.3, 'triangle', 0.7, 0.01, -30)
        break
      case 'powerup':
        this.seq([660, 880, 1100], 0.09, 'sine', 0.5, 0.06)
        break
      case 'laser':
        this.tone(900, 0.1, 'sawtooth', 0.34, 0, -620)
        break
      case 'life':
        this.seq([523, 659, 784], 0.09, 'triangle', 0.5, 0.08)
        break
      case 'levelclear':
        this.seq([523, 659, 784, 1046], 0.1, 'square', 0.55, 0.09)
        break
      case 'gameover':
        this.seq([392, 330, 262, 196], 0.22, 'sawtooth', 0.45, 0.14, -30)
        break
      case 'record':
        this.seq([784, 988, 1175, 1568], 0.1, 'sine', 0.5, 0.08)
        break
    }
  }
}
