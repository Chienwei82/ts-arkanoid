import { BRICK, POWER_UPS, SCORING } from '../config/gameConfig'
import type { BrickType, PowerUpType } from '../entities/types'
import { POWER_UP_GLYPH, POWER_UP_LABEL, formatSeconds } from './format'

export interface PowerUpHelp {
  readonly type: PowerUpType
  readonly glyph: string
  readonly name: string
  readonly detail: string
}

export interface BrickHelp {
  readonly type: BrickType
  readonly name: string
  readonly detail: string
}

const percent = (factor: number): number => Math.round(Math.abs(1 - factor) * 100)

/**
 * Help guide copy. Every figure is read from the tuning config so the text can
 * never drift from the real gameplay values.
 */
export const POWER_UP_HELP: readonly PowerUpHelp[] = [
  {
    type: 'wide',
    glyph: POWER_UP_GLYPH.wide,
    name: POWER_UP_LABEL.wide,
    detail: `Ensancha la paleta durante ${formatSeconds(POWER_UPS.durations.wide)}.`,
  },
  {
    type: 'multi',
    glyph: POWER_UP_GLYPH.multi,
    name: POWER_UP_LABEL.multi,
    detail: 'Suelta dos bolas extra al instante: más bolas, más destrozos.',
  },
  {
    type: 'slow',
    glyph: POWER_UP_GLYPH.slow,
    name: POWER_UP_LABEL.slow,
    detail: `Ralentiza la bola un ${percent(POWER_UPS.slowFactor)} % durante ${formatSeconds(
      POWER_UPS.durations.slow,
    )}.`,
  },
  {
    type: 'fast',
    glyph: POWER_UP_GLYPH.fast,
    name: POWER_UP_LABEL.fast,
    detail: `Acelera la bola un ${percent(POWER_UPS.fastFactor)} % durante ${formatSeconds(
      POWER_UPS.durations.fast,
    )}: rompe más deprisa, pero cuesta más controlarla.`,
  },
  {
    type: 'laser',
    glyph: POWER_UP_GLYPH.laser,
    name: POWER_UP_LABEL.laser,
    detail: `Monta cañones en la paleta durante ${formatSeconds(
      POWER_UPS.durations.laser,
    )}. Mantén ESPACIO o el clic para disparar.`,
  },
  {
    type: 'life',
    glyph: POWER_UP_GLYPH.life,
    name: POWER_UP_LABEL.life,
    detail: `Suma una vida al instante (máximo ${SCORING.maxLives}).`,
  },
]

export const BRICK_HELP: readonly BrickHelp[] = [
  {
    type: 'normal',
    name: 'Normal',
    detail: `Se rompe de un golpe y vale ${SCORING.points.normal} puntos.`,
  },
  {
    type: 'tough',
    name: 'Resistente',
    detail: `Aguanta ${BRICK.toughHits} golpes antes de romperse y vale ${SCORING.points.tough} puntos.`,
  },
  {
    type: 'explosive',
    name: 'Explosivo',
    detail: `Al romperse daña a los bloques vecinos. Vale ${SCORING.points.explosive} puntos.`,
  },
  {
    type: 'indestructible',
    name: 'Indestructible',
    detail: 'No se puede romper: solo bloquea la bola y no da puntos.',
  },
]
