// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/config/gameConfig'
import { LevelTitleCard } from '../src/rendering/LevelTitleCard'

const STEP = 1 / 60

const runFor = (card: LevelTitleCard, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) card.update(STEP)
}

const opacityOf = (card: LevelTitleCard): number => card.object.material.opacity

describe('level title card', () => {
  it('stays hidden until shown and hides once its life ends', () => {
    const card = new LevelTitleCard()
    expect(card.object.visible).toBe(false)

    card.show('NIVEL 1 · IGNICIÓN', 0xff9f2e)
    expect(card.object.visible).toBe(true)

    runFor(card, RENDER.titleCard.life + STEP)
    expect(card.object.visible).toBe(false)

    card.dispose()
  })

  it('fades in from zero and never exceeds the opacity cap', () => {
    const card = new LevelTitleCard()
    card.show('NIVEL 1 · IGNICIÓN', 0xff9f2e)

    expect(opacityOf(card)).toBe(0)

    card.update(RENDER.titleCard.fadeTime)
    const risen = opacityOf(card)
    expect(risen).toBeGreaterThan(0)
    expect(risen).toBeLessThanOrEqual(RENDER.titleCard.opacity)

    // A full life later the card is gone for good.
    card.update(RENDER.titleCard.life)
    expect(card.object.visible).toBe(false)

    card.dispose()
  })

  it('keeps the exact quad width under reduced motion', () => {
    const card = new LevelTitleCard()
    card.setMotionScale(0)
    card.show('NIVEL 2 · FORTÍN', 0x49e6ff)

    runFor(card, RENDER.titleCard.life * 0.5)

    expect(card.object.scale.x).toBeCloseTo(RENDER.titleCard.width, 5)
    card.dispose()
  })

  it('breathes the pop around the base width with motion enabled', () => {
    const card = new LevelTitleCard()
    card.show('NIVEL 3 · LABERINTO', 0x4dffa6)

    let widest = 0
    for (let elapsed = 0; elapsed < 0.5; elapsed += STEP) {
      card.update(STEP)
      widest = Math.max(widest, card.object.scale.x)
    }
    expect(widest).toBeGreaterThan(RENDER.titleCard.width)

    card.dispose()
  })
})
