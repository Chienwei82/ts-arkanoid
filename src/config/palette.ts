/**
 * Papercraft / voxel-Mario palette. Strings feed the renderer (converted to
 * integers via hexToInt) and the CSS theme in ui.css mirrors these values.
 */
export const PALETTE = {
  ink: '#3a2417',
  paper: '#fffaf0',
  paperShadow: '#efd9b8',
  cardboard: '#e0a05c',

  red: '#ff5a4e',
  blue: '#3f8cff',
  green: '#5fc94e',
  yellow: '#ffd23e',
  orange: '#ff9f2e',
  purple: '#a06bff',
  pink: '#ff7ab8',
  teal: '#3fd8e0',
  crimson: '#e83b4f',
  stone: '#9aa7b5',

  skyTop: '#5fb8ff',
  skyMid: '#b8e4ff',
  skyHorizon: '#ffe9c2',
  hillBack: '#7fd36a',
  hillFront: '#4fb44a',
  cloud: '#ffffff',
  checkerRed: '#ff5a4e',

  paddle: '#ff5a4e',
  ball: '#fff6d8',
  wall: '#fffaf0',
  wallAccent: '#ff5a4e',
  guide: '#ffffff',

  brickRows: ['#ff5a4e', '#ff9f2e', '#ffd23e', '#5fc94e', '#3f8cff', '#a06bff'],
  brickSpecial: { tough: '#e0a05c', indestructible: '#9aa7b5', explosive: '#e83b4f' },
  powerUp: {
    wide: '#3f8cff',
    multi: '#a06bff',
    slow: '#5fc94e',
    fast: '#ff9f2e',
    laser: '#e83b4f',
    life: '#ff7ab8',
  },
} as const
