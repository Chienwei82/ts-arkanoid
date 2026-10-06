import { describe, expect, it } from 'vitest'
import type { BrickType } from '../src/entities/types'
import { brickMaterialFor } from '../src/rendering/brickMaterial'

const ALL_TYPES: readonly BrickType[] = ['normal', 'tough', 'indestructible', 'explosive']

describe('brick material mapping', () => {
  it('maps each brick type to its material family', () => {
    expect(brickMaterialFor('normal')).toBe('wood')
    expect(brickMaterialFor('tough')).toBe('metal')
    expect(brickMaterialFor('indestructible')).toBe('concrete')
    expect(brickMaterialFor('explosive')).toBe('explosive')
  })

  it('gives every brick type a distinct material', () => {
    const materials = ALL_TYPES.map((type) => brickMaterialFor(type))
    expect(new Set(materials).size).toBe(ALL_TYPES.length)
  })
})
