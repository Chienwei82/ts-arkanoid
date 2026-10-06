/**
 * AudioDirector: the single audio system the shell wires up. It listens to the
 * engine event bus and translates gameplay into a sound effect plus a short
 * intensity pulse, drives the procedural music from the per-frame intensity the
 * engine hands it, and owns the whole WebAudio lifecycle (autoplay unlock, mute
 * toggle with persistence, pause and hidden-tab handling, disposal).
 *
 * The engine never learns that audio exists: it only calls `update` every frame
 * and exposes the bus, exactly like it does for the renderer.
 */
import type { AudioSignals, GameAudio } from '../core/audio'
import type { GameBus, Unsubscribe } from '../core/EventBus'
import type { GameEventMap } from '../core/events'
import type { GameStatus } from '../core/types'
import { IntensityTracker } from './intensityTracker'
import { LEVEL_SONG_SEEDS, MENU_SONG_SEED } from './musicConstants'
import { MusicDirector } from './musicDirector'
import { createLocalStorageAudio, type AudioPreferenceStore } from './preferences'
import { SoundFX } from './sound'

export interface AudioDirectorOptions {
  /** Mute persistence; defaults to localStorage. */
  readonly preferences?: AudioPreferenceStore
}

export class AudioDirector implements GameAudio {
  private readonly sound = new SoundFX()
  private readonly music = new MusicDirector()
  private readonly intensity = new IntensityTracker()
  private readonly store: AudioPreferenceStore
  private unsubscribers: Unsubscribe[] = []
  private audioOn: boolean
  private levelIndex = 0
  /** Boot screen is the menu, so the first unlock can start the menu song. */
  private status: GameStatus = 'menu'

  constructor(options: AudioDirectorOptions = {}) {
    this.store = options.preferences ?? createLocalStorageAudio()
    this.audioOn = this.store.load()
    this.applyMute(this.audioOn)
    // Autoplay policy: one-shot listeners on the first real gesture.
    window.addEventListener('pointerdown', this.onGesture, { once: true })
    window.addEventListener('keydown', this.onGesture, { once: true })
    window.addEventListener('touchend', this.onGesture, { once: true })
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  get enabled(): boolean {
    return this.audioOn
  }

  private readonly onGesture = (): void => {
    this.unlock()
  }

  private readonly onVisibility = (): void => {
    this.music.setHidden(document.hidden)
  }

  /** Subscribes to the engine bus. Safe to call again (it rebinds). */
  bind(bus: GameBus): void {
    this.unbind()
    this.unsubscribers = [
      bus.on('statusChanged', this.onStatusChanged),
      bus.on('levelChanged', this.onLevelChanged),
      bus.on('ballLaunched', this.onBallLaunched),
      bus.on('paddleHit', this.onPaddleHit),
      bus.on('wallHit', this.onWallHit),
      bus.on('brickDamaged', this.onBrickDamaged),
      bus.on('brickDestroyed', this.onBrickDestroyed),
      bus.on('powerUpCollected', this.onPowerUpCollected),
      bus.on('laserFired', this.onLaserFired),
      bus.on('lifeLost', this.onLifeLost),
      bus.on('levelCompleted', this.onLevelCompleted),
      bus.on('gameOver', this.onGameOver),
    ]
  }

  unbind(): void {
    for (const off of this.unsubscribers) off()
    this.unsubscribers = []
  }

  /** First user gesture: resume/create the AudioContext and start the song. */
  unlock(): void {
    this.sound.unlock()
    this.music.unlock()
    if (this.status === 'menu') this.music.start(MENU_SONG_SEED)
  }

  toggle(): boolean {
    this.audioOn = !this.audioOn
    this.applyMute(this.audioOn)
    this.store.save(this.audioOn)
    return this.audioOn
  }

  /** Per-frame intensity from the engine, smoothed and handed to the music. */
  update(dt: number, signals: AudioSignals): void {
    this.music.setIntensity(this.intensity.update(dt, signals))
  }

  dispose(): void {
    this.unbind()
    window.removeEventListener('pointerdown', this.onGesture)
    window.removeEventListener('keydown', this.onGesture)
    window.removeEventListener('touchend', this.onGesture)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.music.dispose()
  }

  private applyMute(on: boolean): void {
    this.sound.enabled = on
    if (on) this.music.enable()
    else this.music.disable()
  }

  private seedForLevel(index: number): number {
    const count = LEVEL_SONG_SEEDS.length
    const i = ((index % count) + count) % count
    return LEVEL_SONG_SEEDS[i] ?? MENU_SONG_SEED
  }

  /* ------------------- gameplay events → sound + intensity ---------------- */

  private readonly onStatusChanged = ({ from, to }: GameEventMap['statusChanged']): void => {
    this.status = to
    if (to === 'playing') {
      // Resuming from pause must keep the song playing where it was.
      if (from === 'paused') {
        this.music.setPaused(false)
        return
      }
      this.intensity.reset()
      this.music.start(this.seedForLevel(this.levelIndex))
      return
    }
    if (to === 'paused') {
      this.music.setPaused(true)
      return
    }
    if (to === 'menu') this.music.start(MENU_SONG_SEED)
  }

  private readonly onLevelChanged = ({ index }: GameEventMap['levelChanged']): void => {
    this.levelIndex = index
  }

  private readonly onBallLaunched = (): void => {
    this.sound.play('launch')
  }

  private readonly onPaddleHit = (): void => {
    this.sound.play('paddle')
  }

  private readonly onWallHit = (): void => {
    this.sound.play('wall')
  }

  private readonly onBrickDamaged = (): void => {
    this.sound.play('crack')
  }

  private readonly onBrickDestroyed = ({ type, chain }: GameEventMap['brickDestroyed']): void => {
    if (type === 'explosive') {
      this.sound.play('explode')
      this.intensity.event('explode')
      return
    }
    this.sound.play('brick')
    this.intensity.event(chain ? 'chain' : 'break')
  }

  private readonly onPowerUpCollected = (): void => {
    this.sound.play('powerup')
    this.intensity.event('powerup')
  }

  private readonly onLaserFired = (): void => {
    this.sound.play('laser')
  }

  private readonly onLifeLost = (): void => {
    this.sound.play('life')
    this.intensity.event('life')
  }

  private readonly onLevelCompleted = (): void => {
    this.sound.play('levelclear')
    this.intensity.event('levelclear')
  }

  private readonly onGameOver = ({ isRecord }: GameEventMap['gameOver']): void => {
    this.sound.play(isRecord ? 'record' : 'gameover')
    this.music.resolveEnding()
  }
}
