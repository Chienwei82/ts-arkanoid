import {
  AdditiveBlending,
  BackSide,
  FrontSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Texture,
} from 'three'
import { PALETTE } from '../config/palette'
import { hexToInt } from '../utils/math'

/**
 * Material vocabulary of the papercraft look: flat ink silhouettes, matte paper
 * and additive glow. Everything is unlit where the paper should stay graphic
 * (ink, glow) and lambert-lit where volumes must read (frames, bodies).
 */

const INK = hexToInt(PALETTE.ink)

/** Unlit ink silhouette: the "cut edge" peeking out behind every paper piece. */
export const createInkMaterial = (): MeshBasicMaterial =>
  new MeshBasicMaterial({ color: INK, side: FrontSide })

/** Ink hull rendered from the inside; the cheap outline for rounded actors. */
export const createOutlineMaterial = (): MeshBasicMaterial =>
  new MeshBasicMaterial({ color: INK, side: BackSide })

/** Matte white paper, optionally carrying the fibre texture. */
export const createPaperMaterial = (map: Texture | null): MeshLambertMaterial =>
  new MeshLambertMaterial({ color: hexToInt(PALETTE.paper), map, flatShading: true })

/** Paper whose colour comes from the instance/vertex colour (tinted bodies). */
export const createTintablePaperMaterial = (map: Texture | null): MeshLambertMaterial =>
  new MeshLambertMaterial({ color: 0xffffff, map, flatShading: true })

/** Additive sprite used by the ball trail and the sun disc. */
export const createGlowMaterial = (map: Texture): MeshBasicMaterial =>
  new MeshBasicMaterial({ map, transparent: true, blending: AdditiveBlending, depthWrite: false })
