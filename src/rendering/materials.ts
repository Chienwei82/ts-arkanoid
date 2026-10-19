import {
  AdditiveBlending,
  BackSide,
  FrontSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Texture,
} from 'three'
import { PALETTE } from '../config/palette'
import { hexToInt } from '../utils/math'

/**
 * Material vocabulary of the space-arcade look: dark hull silhouettes, lit
 * alloy panels and additive neon glow. Everything is unlit where the HUD-like
 * graphic should stay flat (ink, glow) and lambert-lit where volumes must
 * read (frames, bodies).
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

/** Additive sprite used by the ball trail, engine glow and the planet disc. */
export const createGlowMaterial = (map: Texture): MeshBasicMaterial =>
  new MeshBasicMaterial({ map, transparent: true, blending: AdditiveBlending, depthWrite: false })

/** Neon edge: unlit additive strip for rails, pylons and energy conduits. */
export const createNeonMaterial = (colour: number, opacity = 0.9): MeshBasicMaterial =>
  new MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  })

/** Brushed starship hull: lit alloy with a neon-friendly sheen. */
export const createHullMaterial = (colour: number, map: Texture | null): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: colour,
    map,
    metalness: 0.55,
    roughness: 0.38,
    flatShading: true,
  })
