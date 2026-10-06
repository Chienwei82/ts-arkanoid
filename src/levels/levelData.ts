import type { LevelDefinition } from './types'

/**
 * Level definitions are pure data: grids of characters (see LEVEL_CHARS) so
 * that adding a level never touches gameplay logic.
 */
export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 'level-1',
    name: 'IGNICIÓN',
    rows: [
      '.............',
      '.###########.',
      '.###########.',
      '.####!!!####.',
      '.###.###.###.',
      '..###...###..',
    ],
    palette: ['#ff5a4e', '#3f8cff', '#ffd23e', '#5fc94e'],
    ballSpeed: 34,
    powerUpDropRate: 0.22,
  },
  {
    id: 'level-2',
    name: 'FORTÍN',
    rows: [
      '..#########..',
      'X###+####+##X',
      '.####...####.',
      '.####!!!####.',
      '.###+#######.',
      '.####...####.',
      '..###...###..',
    ],
    palette: ['#ff9f2e', '#ff7ab8', '#3fd8e0', '#a06bff'],
    ballSpeed: 37,
    powerUpDropRate: 0.2,
  },
  {
    id: 'level-3',
    name: 'LABERINTO',
    rows: [
      '!#!#!#!#!#!#!',
      '.###+###X###.',
      '#!!#######!!#',
      '.###+++++###.',
      '.###.....###.',
      '..#########..',
    ],
    palette: ['#5fc94e', '#3f8cff', '#ffd23e', '#ff5a4e'],
    ballSpeed: 40,
    powerUpDropRate: 0.18,
  },
  {
    id: 'level-4',
    name: 'NÚCLEO',
    rows: [
      'XX#########XX',
      '#!!!#!!!#!!!#',
      '.#+#+#+#+#+#.',
      '.#+###X###+#.',
      '.####!!!####.',
      'X###++###++#X',
      '..###...###..',
    ],
    palette: ['#e83b4f', '#ff9f2e', '#a06bff', '#3f8cff'],
    ballSpeed: 43,
    powerUpDropRate: 0.2,
  },
]
