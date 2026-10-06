import type { PowerUpType } from '../entities/types'

const SCORE_DIGITS = 6

export const formatScore = (value: number): string =>
  Math.max(0, Math.round(value)).toString().padStart(SCORE_DIGITS, '0')

export const formatSeconds = (seconds: number): string => `${Math.max(0, Math.ceil(seconds))}s`

export const POWER_UP_LABEL: Readonly<Record<PowerUpType, string>> = {
  wide: 'Paleta ancha',
  multi: 'Multibola',
  slow: 'Bola lenta',
  fast: 'Bola rápida',
  laser: 'Láser',
  life: 'Vida extra',
  powerBall: 'Bola especial',
}

export const POWER_UP_GLYPH: Readonly<Record<PowerUpType, string>> = {
  wide: '↔',
  multi: '⁙',
  slow: '◔',
  fast: '⚡',
  laser: '⇡',
  life: '♥',
  powerBall: '✦',
}
