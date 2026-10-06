/** Minimal 2D vector math shared by gameplay code (three.js-free by design). */

export interface Vec2 {
  x: number
  y: number
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y })

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const DEG2RAD = Math.PI / 180

export const setVec = (target: Vec2, x: number, y: number): Vec2 => {
  target.x = x
  target.y = y
  return target
}

export const copyVec = (target: Vec2, source: Vec2): Vec2 => setVec(target, source.x, source.y)

export const vecDistance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Converts '#rrggbb' to the integer form three.js and events use. */
export const hexToInt = (hex: string): number => Number.parseInt(hex.slice(1), 16)
