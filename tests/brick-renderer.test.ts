// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { BrickRenderer } from '../src/rendering/BrickRenderer'
import type { CraftTextures } from '../src/rendering/textures'
import type { Brick } from '../src/entities/types'
import type { BrickBehavior } from '../src/entities/BrickBehavior'

/**
 * The renderer only reads the painted textures, so a stub keeps the test free of
 * Canvas 2D (jsdom has no 2D context): the animation lifecycle is what matters.
 */
const createTextures = (): CraftTextures =>
  ({
    brickMaterials: {
      wood: null,
      metal: null,
      concrete: null,
      explosive: null,
    },
  }) as unknown as CraftTextures

const behaviour: BrickBehavior = {
  type: 'normal',
  hit: (brick: Brick) => {
    brick.hitsLeft = Math.max(0, brick.hitsLeft - 1)
    return { destroyed: brick.hitsLeft === 0, explodes: false }
  },
}

const createBrick = (id: number, x: number, hits = 1): Brick => ({
  id,
  pos: { x, y: 0 },
  halfWidth: 2,
  halfHeight: 1.2,
  type: 'normal',
  row: 0,
  col: id,
  color: 0x35c4ff,
  baseHits: hits,
  behavior: behaviour,
  hitsLeft: hits,
  alive: true,
})

/** One group of three layers (ink, frame, body) because every brick is 'normal'. */
const layersOf = (renderer: BrickRenderer): InstancedMesh[] =>
  renderer.object.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh)

const matrix = new Matrix4()
const position = new Vector3()
const quaternion = new Quaternion()
const scale = new Vector3()

/** Uniform X scale of one instance, read back from the instance buffer. */
const scaleAt = (layer: InstancedMesh, slot: number): number => {
  layer.getMatrixAt(slot, matrix)
  matrix.decompose(position, quaternion, scale)
  return scale.x
}

/** Drives the renderer the way the game does: sync every frame, then animate. */
const runFor = (renderer: BrickRenderer, seconds: number): void => {
  const step = 1 / 60
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    renderer.sync()
    renderer.animate(step)
  }
}

describe('brick renderer', () => {
  it('hides a destroyed brick when its shatter animation ends', () => {
    const renderer = new BrickRenderer(createTextures())
    const bricks = [createBrick(1, -4), createBrick(2, 4)]
    renderer.setBricks(bricks)
    const layers = layersOf(renderer)

    bricks[0].alive = false
    // While shattering the piece is still drawn, so the burst is visible.
    renderer.sync()
    renderer.animate(1 / 60)
    expect(scaleAt(layers[2], 0)).toBeGreaterThan(0.5)

    // Sync runs every frame in the real loop; the animation must not freeze.
    runFor(renderer, 1)

    for (const layer of layers) {
      expect(scaleAt(layer, 0)).toBeLessThan(0.01)
    }
    // The surviving brick keeps its size.
    expect(scaleAt(layers[2], 1)).toBeGreaterThan(0.5)
  })

  it('lets a hit pulse finish on its own instead of freezing mid-pulse', () => {
    const renderer = new BrickRenderer(createTextures())
    const bricks = [createBrick(1, 0, 3)]
    renderer.setBricks(bricks)
    const body = layersOf(renderer)[2]
    const idleScale = scaleAt(body, 0)

    bricks[0].hitsLeft = 2
    renderer.sync()
    runFor(renderer, 0.12)
    // Halfway through the pulse the piece is swollen towards the camera.
    const peak = scaleAt(body, 0)
    expect(peak).toBeGreaterThan(idleScale + 0.03)

    runFor(renderer, 0.4)
    // Back to the calm breathing band, not stuck at the pulse peak.
    expect(scaleAt(body, 0)).toBeLessThan(peak - 0.02)
  })
})
