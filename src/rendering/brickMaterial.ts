import type { BrickType } from '../entities/types'

/**
 * Material families that dress the brick field: painted wooden crates, sheet
 * metal, cast concrete and hazard-striped explosive crates.
 */
export type BrickMaterial = 'wood' | 'metal' | 'concrete' | 'explosive'

/**
 * Deterministic brick-type → material mapping. Kept pure (no three.js) so the
 * choice is unit-tested headlessly and the renderer stays a thin adapter.
 */
export const brickMaterialFor = (type: BrickType): BrickMaterial => {
  switch (type) {
    case 'normal':
      return 'wood'
    case 'tough':
      return 'metal'
    case 'indestructible':
      return 'concrete'
    case 'explosive':
      return 'explosive'
  }
}
