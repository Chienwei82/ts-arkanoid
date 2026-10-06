import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'
import {
  createAcUnitGeometry,
  createAntennaGeometry,
  createCloudGeometry,
  createServicePipeGeometry,
  createWaterTankGeometry,
} from '../src/rendering/props'

/** A merged prop must be one drawable: positions, normals and UVs, all present. */
const expectDrawable = (geometry: BufferGeometry): void => {
  const position = geometry.getAttribute('position')
  expect(position.count).toBeGreaterThan(0)
  expect(geometry.getAttribute('normal')).toBeDefined()
  expect(geometry.getAttribute('uv')).toBeDefined()
  geometry.dispose()
}

describe('paper prop geometry', () => {
  it('merges the cloud puffs into one geometry with normals', () => {
    const cloud = createCloudGeometry()
    const position = cloud.getAttribute('position')

    expect(position.count).toBeGreaterThan(100)
    expect(cloud.getAttribute('normal')).toBeDefined()
    expect(cloud.getAttribute('uv')).toBeDefined()
    cloud.dispose()
  })

  it('merges every building prop into one drawable geometry', () => {
    const builders = [
      createWaterTankGeometry,
      createAntennaGeometry,
      createAcUnitGeometry,
      createServicePipeGeometry,
    ]
    for (const build of builders) expectDrawable(build())
  })

  it('keeps the rooftop props taller than wide', () => {
    for (const build of [createWaterTankGeometry, createAntennaGeometry]) {
      const geometry = build()
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      expect(box).not.toBeNull()
      if (box === null) continue
      expect(box.max.y - box.min.y).toBeGreaterThan(box.max.x - box.min.x)
      geometry.dispose()
    }
  })
})
