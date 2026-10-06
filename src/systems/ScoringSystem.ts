import { SCORING } from '../config/gameConfig'
import type { GameBus } from '../core/EventBus'
import type { BrickType } from '../entities/types'
import type { RecordStorage } from '../utils/storage'

const POINTS: Readonly<Record<BrickType, number>> = SCORING.points

/** Score, combo multiplier and persistent record. Emits HUD events on change. */
export class ScoringSystem {
  score = 0
  combo = 0
  record = 0
  /** Record held when the current run started; drives the "new record" badge. */
  startRecord = 0

  private readonly bus: GameBus
  private readonly storage: RecordStorage

  constructor(bus: GameBus, storage: RecordStorage) {
    this.bus = bus
    this.storage = storage
    this.record = storage.load()
    this.startRecord = this.record
  }

  get multiplier(): number {
    return Math.min(1 + Math.floor(this.combo / SCORING.comboStep), SCORING.maxMultiplier)
  }

  /** True while the run in progress is already better than the stored record. */
  get isRunRecord(): boolean {
    return this.score > this.startRecord
  }

  registerBrickDestroy(type: BrickType): number {
    const gained = POINTS[type] * this.multiplier
    this.score += gained
    this.combo += 1
    if (this.score > this.record) {
      this.record = this.score
      this.storage.save(this.record)
      this.bus.emit('recordChanged', { record: this.record })
    }
    this.emitScore(gained)
    return gained
  }

  resetCombo(): void {
    if (this.combo === 0) return
    this.combo = 0
    this.emitScore(0)
  }

  resetRun(): void {
    this.score = 0
    this.combo = 0
    this.startRecord = this.record
    this.emitScore(0)
  }

  private emitScore(gained: number): void {
    this.bus.emit('scoreChanged', {
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      gained,
    })
  }
}
