import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  type BufferGeometry,
} from 'three'
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

/** Rooftop water tank: a ribbed cylinder on stubby legs, capped with a cone. */
export const createWaterTankGeometry = (): BufferGeometry => {
  const body = new CylinderGeometry(2.1, 2.1, 4.2, 14)
  body.translate(0, 3.1, 0)
  const roof = new ConeGeometry(2.35, 1.5, 14)
  roof.translate(0, 5.95, 0)
  const legs: BufferGeometry[] = []
  const spots: readonly (readonly [number, number])[] = [
    [1.4, 1.4],
    [-1.4, 1.4],
    [1.4, -1.4],
    [-1.4, -1.4],
  ]
  for (const [x, z] of spots) {
    const leg = new BoxGeometry(0.5, 1, 0.5)
    leg.translate(x, 0.5, z)
    legs.push(leg)
  }
  return mergeParts([body, roof, ...legs])
}

/** Aerial: mast, cross arm and a shallow dish on a small base. */
export const createAntennaGeometry = (): BufferGeometry => {
  const base = new BoxGeometry(1.6, 0.5, 1.6)
  base.translate(0, 0.25, 0)
  const mast = new CylinderGeometry(0.16, 0.16, 7, 8)
  mast.translate(0, 3.5, 0)
  const arm = new BoxGeometry(3, 0.22, 0.22)
  arm.translate(0, 6, 0)
  const dish = new ConeGeometry(1.2, 0.8, 12)
  dish.rotateX(Math.PI / 2)
  dish.translate(0.2, 6.8, 0.4)
  return mergeParts([base, mast, arm, dish])
}

/** Wall/roof air-conditioning unit: a box with a round fan grille. */
export const createAcUnitGeometry = (): BufferGeometry => {
  const box = new BoxGeometry(2.6, 1.6, 1.4)
  const fan = new CylinderGeometry(0.62, 0.62, 0.24, 14)
  fan.rotateX(Math.PI / 2)
  fan.translate(0, 0, 0.72)
  return mergeParts([box, fan])
}

/** Service pipe: a vertical run with an elbow and a bolted flange. */
export const createServicePipeGeometry = (): BufferGeometry => {
  const run = new CylinderGeometry(0.35, 0.35, 8, 10)
  run.translate(0, 4, 0)
  const elbow = new CylinderGeometry(0.35, 0.35, 1.4, 10)
  elbow.rotateX(Math.PI / 2)
  elbow.translate(0, 8, 0.7)
  const flange = new BoxGeometry(1.1, 0.5, 1.1)
  flange.translate(0, 0.25, 0)
  return mergeParts([run, elbow, flange])
}
