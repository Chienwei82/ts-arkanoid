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
 * Material vocabulary of the space-arcade look: bright cartoony hulls, lit
 * alloy trims and additive neon glow. Gameplay pieces (bricks, cards) stay
 * unlit so their colours survive any lighting; structure stays lambert-lit
 * for volume.
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

/**
 * Vivid unlit body: bright canvas textures are multiplied by the instance
 * colour, so bricks and power-up cards pop against the dark board even when
 * the scene lights move.
 */
export const createVividBodyMaterial = (map: Texture | null): MeshBasicMaterial =>
  new MeshBasicMaterial({ color: 0xffffff, map })

/**
 * Paper frame around each brick: unlit, white base so the per-instance colour
 * (the brick's own hue, lifted towards white) defines the rim.
 */
export const createFrameMaterial = (map: Texture | null): MeshBasicMaterial =>
  new MeshBasicMaterial({ color: 0xffffff, map })

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

/**
 * Brushed starship hull: lit alloy with a neon-friendly sheen. Metalness is kept
 * low on purpose: without an environment map a metallic material absorbs almost
 * every light and the props read as flat black squares.
 */
export const createHullMaterial = (colour: number, map: Texture | null): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: colour,
    map,
    metalness: 0.12,
    roughness: 0.55,
    flatShading: true,
  })

/**
 * Translucent glass plate for the playfield and its inner glow. Additive and
 * depth-write free, so it only adds light over the sky behind the board and
 * never hides what is behind it.
 */
export const createGlassMaterial = (
  map: Texture | null,
  colour: number,
  opacity: number,
): MeshBasicMaterial =>
  new MeshBasicMaterial({
    color: colour,
    map,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  })
