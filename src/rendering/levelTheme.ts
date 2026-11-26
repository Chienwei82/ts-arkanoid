/**
 * Per-level chromatic identity: every campaign level resolves to a curated
 * accent family (neon rails, glass, trail, ball light, title card) plus scene
 * lights and a galaxy tint. Custom levels fall back to a deterministic hue
 * family derived from their name, so any campaign gets art direction.
 *
 * Pure data plumbing: no three.js and no DOM, so it is testable in Node.
 */
import { RENDER } from '../config/gameConfig'
import { hashSeed } from '../utils/rng'

/** Chromatic identity of one sector; every field is '#rrggbb'. */
export interface LevelTheme {
  /** Primary accent: rails, conduits, trail, ball light and title cards. */
  readonly accent: string
  /** Secondary accent: playfield glass and planet halo. */
  readonly aux: string
  /** Colour of the key light (front-top). */
  readonly keyLight: string
  /** Colour of the fill / rim light (back-side). */
  readonly fillLight: string
  /** Multiplicative tint over the base galaxy colours ('#ffffff' keeps them). */
  readonly galaxyTint: string
}

/** The menu identity: the classic cyan-magenta neon look. */
export const menuTheme = (): LevelTheme => RENDER.levelThemes.menu

/**
 * Resolves the theme of a level: curated for the shipped campaign, and a
 * deterministic hue family derived from the level name for extra levels.
 */
export const resolveLevelTheme = (index: number, name: string): LevelTheme => {
  const levels = RENDER.levelThemes.levels
  if (index >= 0 && index < levels.length) return levels[index]
  return deriveTheme(name)
}

/** Arcade card label shown while the fresh level settles in. */
export const levelTitleText = (index: number, name: string): string => {
  const label = `NIVEL ${index + 1}`
  return name === '' ? label : `${label} · ${name.toUpperCase()}`
}

/** Derives a coherent theme from a level name (same name, same sky). */
const deriveTheme = (name: string): LevelTheme => {
  const hue = hashSeed(name) % 360
  return {
    accent: hslToHex(hue, 0.92, 0.62),
    aux: hslToHex(rotateHue(hue, 36), 0.85, 0.72),
    keyLight: hslToHex(hue, 0.6, 0.78),
    fillLight: hslToHex(rotateHue(hue, 200), 0.8, 0.6),
    galaxyTint: hslToHex(hue, 0.45, 0.82),
  }
}

const rotateHue = (hue: number, degrees: number): number => (((hue + degrees) % 360) + 360) % 360

/**
 * Converts HSL to '#rrggbb' (hue in degrees, saturation and lightness in 0..1
 * through the canonical CSS formula), the small helper that keeps custom
 * themes deterministic without adding a colour library.
 */
export const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const h = rotateHue(hue, 0) / 360
  const s = Math.min(1, Math.max(0, saturation))
  const l = Math.min(1, Math.max(0, lightness))
  const channel = (offset: number): number => {
    const k = (offset + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
  }
  const toHex = (value: number): string => value.toString(16).padStart(2, '0')
  return `#${toHex(channel(0))}${toHex(channel(8))}${toHex(channel(4))}`
}
