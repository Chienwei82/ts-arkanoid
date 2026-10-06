import { clamp, type Vec2 } from './math'

/** Circle vs axis-aligned box (brick/paddle/pickup) intersection test. */
export const circleIntersectsBox = (
  circle: Vec2,
  radius: number,
  box: Vec2,
  halfWidth: number,
  halfHeight: number,
): boolean => {
  const dx = circle.x - box.x
  const dy = circle.y - box.y
  const nearestX = clamp(dx, -halfWidth, halfWidth)
  const nearestY = clamp(dy, -halfHeight, halfHeight)
  const offsetX = dx - nearestX
  const offsetY = dy - nearestY
  return offsetX * offsetX + offsetY * offsetY <= radius * radius
}

/** Reflects velocity across a unit normal, ignoring separating contacts. */
export const reflectVelocity = (velocity: Vec2, normalX: number, normalY: number): void => {
  const normalSpeed = velocity.x * normalX + velocity.y * normalY
  if (normalSpeed >= 0) return
  velocity.x -= 2 * normalSpeed * normalX
  velocity.y -= 2 * normalSpeed * normalY
}

/**
 * Pushes the circle out of the box along the shallowest axis and reflects its
 * velocity. Returns false when there is no overlap.
 */
export const resolveCircleBox = (
  circle: Vec2,
  radius: number,
  box: Vec2,
  halfWidth: number,
  halfHeight: number,
  velocity: Vec2,
): boolean => {
  const dx = circle.x - box.x
  const dy = circle.y - box.y
  const nearestX = clamp(dx, -halfWidth, halfWidth)
  const nearestY = clamp(dy, -halfHeight, halfHeight)
  const offsetX = dx - nearestX
  const offsetY = dy - nearestY
  const distanceSq = offsetX * offsetX + offsetY * offsetY

  if (distanceSq > radius * radius) return false

  if (distanceSq > 1e-12) {
    // Corner contact: separate along the contact normal.
    const distance = Math.sqrt(distanceSq)
    const normalX = offsetX / distance
    const normalY = offsetY / distance
    const penetration = radius - distance
    circle.x += normalX * penetration
    circle.y += normalY * penetration
    reflectVelocity(velocity, normalX, normalY)
    return true
  }

  // Center inside the box: escape through the axis of least penetration.
  const overlapX = halfWidth + radius - Math.abs(dx)
  const overlapY = halfHeight + radius - Math.abs(dy)
  if (overlapX < overlapY) {
    const normalX = dx >= 0 ? 1 : -1
    circle.x += normalX * overlapX
    reflectVelocity(velocity, normalX, 0)
  } else {
    const normalY = dy >= 0 ? 1 : -1
    circle.y += normalY * overlapY
    reflectVelocity(velocity, 0, normalY)
  }
  return true
}

export const boxesOverlap = (
  a: Vec2,
  aHalfWidth: number,
  aHalfHeight: number,
  b: Vec2,
  bHalfWidth: number,
  bHalfHeight: number,
): boolean =>
  Math.abs(a.x - b.x) <= aHalfWidth + bHalfWidth && Math.abs(a.y - b.y) <= aHalfHeight + bHalfHeight
