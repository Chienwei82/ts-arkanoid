/**
 * Space / Galaga arcade palette. Strings feed the renderer (converted to
 * integers via hexToInt) and the CSS theme in ui.css mirrors these values.
 */
export const PALETTE = {
  ink: '#04081a',
  paper: '#0b1230',
  paperShadow: '#060b22',
  cardboard: '#3d4a7a',

  red: '#ff3d5e',
  blue: '#35c4ff',
  green: '#4dffa6',
  yellow: '#ffe14d',
  orange: '#ff9f2e',
  purple: '#a06bff',
  pink: '#ff7ab8',
  teal: '#3fd8e0',
  crimson: '#ff2e4d',
  stone: '#8b98b8',

  skyTop: '#01020a',
  skyMid: '#0a1038',
  skyHorizon: '#2a125e',
  cloud: '#8f7bff',
  checkerRed: '#ff3d5e',

  facade: '#0b1230',
  windowLit: '#7df9ff',
  windowDark: '#131c44',
  metalTrim: '#8b98b8',
  ground: '#070d2b',

  paddle: '#35c4ff',
  ball: '#d9fbff',
  /** Ball flavours: ion cyan, solar ember, chrome and reactor magenta. */
  ballTypes: { standard: '#35e0ff', fire: '#ff8c3a', heavy: '#dfe8ff', bomb: '#ff3df0' },
  wall: '#35c4ff',
  wallAccent: '#ff3df0',
  guide: '#7df9ff',

  brickRows: ['#ff3d5e', '#ff9f2e', '#ffe14d', '#4dffa6', '#35c4ff', '#a06bff'],
  // Brick materials: hull plating keeps the per-row colours; tough bricks read
  // as shielded armour, indestructible ones as a station core and explosives
  // as unstable reactors. All kept luminous so they pop against the dark board.
  brickSpecial: { tough: '#aebadd', indestructible: '#5a6aa8', explosive: '#ff5a2e' },
  powerUp: {
    wide: '#35c4ff',
    multi: '#a06bff',
    slow: '#4dffa6',
    fast: '#ff9f2e',
    laser: '#ff2e4d',
    life: '#ff7ab8',
    powerBall: '#3fd8e0',
  },
} as const
