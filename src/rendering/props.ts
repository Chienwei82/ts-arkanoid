import { IcosahedronGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Merged low-poly props. Each prop is a single geometry so all of its copies can
 * be instanced in one draw call, and merging happens once at start-up.
 *
 * Kept apart from SceneBuilder so the merge can be unit-tested headlessly.
 */

const mergeParts = (parts: BufferGeometry[]): BufferGeometry => {
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}

/** Fluffy paper cloud: four overlapping spheres. */
export const createCloudGeometry = (): BufferGeometry => {
  const puffs: readonly (readonly [number, number, number, number])[] = [
    [0, 0, 0, 1.35],
    [1.5, -0.2, 0.2, 0.95],
    [-1.55, -0.28, -0.15, 0.85],
    [0.5, 0.72, 0.3, 0.75],
  ]
  const parts = puffs.map(([x, y, z, radius]) => {
    const part = new IcosahedronGeometry(radius, 1)
    part.translate(x, y, z)
    return part
  })
  return mergeParts(parts)
}

/** Rounded hill silhouette: squashed domes, Mario-board style. */
export const createHillGeometry = (): BufferGeometry => {
  const domes: readonly (readonly [number, number, number, number])[] = [
    [0, 0, 0, 1],
    [1.5, -0.25, 0, 0.62],
    [-1.6, -0.3, 0, 0.55],
  ]
  const parts = domes.map(([x, y, z, radius]) => {
    const part = new IcosahedronGeometry(radius, 1)
    part.scale(1, 0.62, 1)
    part.translate(x, y, z)
    return part
  })
  return mergeParts(parts)
}
