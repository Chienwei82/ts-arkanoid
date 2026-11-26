import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/config/gameConfig'
import { hslToHex, levelTitleText, menuTheme, resolveLevelTheme } from '../src/rendering/levelTheme'

describe('hslToHex', () => {
  it('converts the CSS primaries', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000')
    expect(hslToHex(120, 1, 0.5)).toBe('#00ff00')
    expect(hslToHex(240, 1, 0.5)).toBe('#0000ff')
  })

  it('handles pure white and wraps out-of-range hues', () => {
    expect(hslToHex(0, 0, 1)).toBe('#ffffff')
    expect(hslToHex(480, 1, 0.5)).toBe('#00ff00')
  })
})

describe('level themes', () => {
  it('serves the curated theme of every campaign level', () => {
    const levels = RENDER.levelThemes.levels

    for (let index = 0; index < levels.length; index += 1) {
      expect(resolveLevelTheme(index, 'whatever')).toBe(levels[index])
    }
  })

  it('keeps every shipped field a well-formed hex string', () => {
    const themes = [menuTheme(), ...RENDER.levelThemes.levels]

    for (const theme of themes) {
      for (const value of Object.values(theme)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('derives a deterministic theme for custom levels', () => {
    const first = resolveLevelTheme(999, 'El Diorama')
    expect(first).toEqual(resolveLevelTheme(999, 'El Diorama'))
    expect(first).not.toEqual(resolveLevelTheme(999, 'Orbital Yard'))
    for (const value of Object.values(first)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('exposes the menu identity untouched', () => {
    expect(menuTheme()).toBe(RENDER.levelThemes.menu)
  })
})

describe('level title', () => {
  it('composes the arcade card label of a level', () => {
    expect(levelTitleText(0, 'ignición')).toBe('NIVEL 1 · IGNICIÓN')
    expect(levelTitleText(2, 'laberinto')).toBe('NIVEL 3 · LABERINTO')
  })

  it('falls back to the bare level number when the name is empty', () => {
    expect(levelTitleText(4, '')).toBe('NIVEL 5')
  })
})
