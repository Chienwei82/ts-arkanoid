import { describe, expect, it } from 'vitest'
import { createCloudGeometry, createHillGeometry } from '../src/rendering/props'

/**
 * Guard for the only rendering assumption that needs no GPU: merging the paper
 * prop geometries into a single drawable must actually produce attributes.
 */
describe('paper prop geometry', () => {
  it('merges the cloud puffs into one geometry with normals', () => {
    const cloud = createCloudGeometry()
    const position = cloud.getAttribute('position')

    expect(position.count).toBeGreaterThan(100)
    expect(cloud.getAttribute('normal')).toBeDefined()
    expect(cloud.getAttribute('uv')).toBeDefined()
    cloud.dispose()
  })

  it('builds squashed hill domes around their local origin', () => {
    const hill = createHillGeometry()
    hill.computeBoundingBox()

    const box = hill.boundingBox
    expect(box).not.toBeNull()
    if (box === null) return
    expect(box.max.y).toBeGreaterThan(box.min.y)
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y)
    hill.dispose()
  })
})
