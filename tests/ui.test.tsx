// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GameFacade } from '../src/bridge'
import type { HudState } from '../src/core/types'
import { Hud } from '../src/ui/Hud'
import { Screens } from '../src/ui/Screens'
import { GameShell } from '../src/ui/GameShell'

const MENU_HUD: HudState = {
  status: 'menu',
  score: 0,
  lives: 3,
  combo: 0,
  multiplier: 1,
  record: 4200,
  levelIndex: 0,
  levelName: 'IGNICIÓN',
  levelTotal: 4,
  powerUps: [],
  isRecord: false,
  isFinalLevel: false,
  helpVisible: false,
  error: null,
}

interface StubFacade extends GameFacade {
  readonly calls: string[]
  readonly notify: () => void
}

/** Facade double: records commands instead of touching the engine. */
const createStub = (read: () => HudState): StubFacade => {
  const calls: string[] = []
  let listener: (() => void) | null = null
  return {
    calls,
    attach: (container) => {
      calls.push(container === null ? 'attach:null' : 'attach:host')
      return () => calls.push('detach')
    },
    getSnapshot: read,
    subscribe: (next) => {
      listener = next
      return () => {
        listener = null
      }
    },
    start: () => calls.push('start'),
    togglePause: () => calls.push('togglePause'),
    toggleHelp: () => calls.push('toggleHelp'),
    quitToMenu: () => calls.push('quitToMenu'),
    nextLevel: () => calls.push('nextLevel'),
    reload: () => calls.push('reload'),
    notify: () => listener?.(),
  }
}

afterEach(() => {
  cleanup()
})

describe('Hud', () => {
  it('renders score, record, level, hearts and power-up chips', () => {
    const hud: HudState = {
      ...MENU_HUD,
      status: 'playing',
      score: 1320,
      combo: 6,
      multiplier: 2,
      lives: 2,
      powerUps: [
        { type: 'laser', remaining: 4.2 },
        { type: 'wide', remaining: 9.7 },
      ],
    }

    render(<Hud hud={hud} />)

    expect(screen.getByText('001320')).not.toBeNull()
    expect(screen.getByText('004200')).not.toBeNull()
    expect(screen.getByText('IGNICIÓN')).not.toBeNull()
    expect(screen.getByText('Nivel 1 / 4')).not.toBeNull()
    expect(screen.getByText('combo 6 · ×2')).not.toBeNull()
    expect(screen.getByText('5s')).not.toBeNull()
    expect(screen.getByText('10s')).not.toBeNull()
    expect(screen.getAllByText('♥')).toHaveLength(6)
  })
})

describe('Screens', () => {
  it('starts a run from the menu panel', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={MENU_HUD} session={stub} />)

    expect(screen.getByText('Paper Breaker')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'JUGAR' }))
    expect(stub.calls).toContain('start')
  })

  it('renders nothing while playing', () => {
    const stub = createStub(() => MENU_HUD)
    const { container } = render(
      <Screens hud={{ ...MENU_HUD, status: 'playing' }} session={stub} />,
    )
    expect(container.querySelector('.panel')).toBeNull()
  })

  it('offers resume and quit while paused', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={{ ...MENU_HUD, status: 'paused' }} session={stub} />)

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }))
    fireEvent.click(screen.getByRole('button', { name: 'SALIR AL MENÚ' }))
    expect(stub.calls).toEqual(['togglePause', 'quitToMenu'])
  })

  it('celebrates a record on game over', () => {
    const stub = createStub(() => MENU_HUD)
    render(
      <Screens
        hud={{ ...MENU_HUD, status: 'gameOver', score: 900, record: 900, isRecord: true }}
        session={stub}
      />,
    )

    expect(screen.getByText('¡Nuevo récord!')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
    expect(stub.calls).toContain('start')
  })

  it('advances to the next level and closes the campaign', () => {
    const stub = createStub(() => MENU_HUD)
    const { unmount } = render(
      <Screens hud={{ ...MENU_HUD, status: 'levelComplete' }} session={stub} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'SIGUIENTE NIVEL' }))
    expect(stub.calls).toContain('nextLevel')
    unmount()

    render(
      <Screens hud={{ ...MENU_HUD, status: 'levelComplete', isFinalLevel: true }} session={stub} />,
    )
    expect(screen.getByRole('button', { name: 'VOLVER AL MENÚ' })).not.toBeNull()
  })
})

describe('HelpScreen', () => {
  it('replaces every other panel with the guide', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={{ ...MENU_HUD, helpVisible: true }} session={stub} />)

    expect(screen.getByText('Guía de juego')).not.toBeNull()
    expect(screen.queryByText('Paper Breaker')).toBeNull()
  })

  it('explains every power-up and brick type', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={{ ...MENU_HUD, helpVisible: true }} session={stub} />)

    for (const name of [
      'Paleta ancha',
      'Multibola',
      'Bola lenta',
      'Bola rápida',
      'Láser',
      'Vida extra',
    ]) {
      expect(screen.getByText(name)).not.toBeNull()
    }
    for (const name of ['Normal', 'Resistente', 'Explosivo', 'Indestructible']) {
      expect(screen.getByText(name)).not.toBeNull()
    }
    expect(screen.getByText('Pulsa H para mostrar u ocultar esta guía.')).not.toBeNull()
  })

  it('starts the run and closes the guide from the menu', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={{ ...MENU_HUD, helpVisible: true }} session={stub} />)

    fireEvent.click(screen.getByRole('button', { name: 'JUGAR' }))
    expect(stub.calls).toEqual(['toggleHelp', 'start'])
  })

  it('closes the guide with no start button outside the menu', () => {
    const stub = createStub(() => MENU_HUD)
    render(<Screens hud={{ ...MENU_HUD, status: 'paused', helpVisible: true }} session={stub} />)

    expect(screen.queryByRole('button', { name: 'JUGAR' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'CERRAR' }))
    expect(stub.calls).toEqual(['toggleHelp'])
  })
})

describe('GameShell', () => {
  it('mounts and detaches the engine around the canvas host', () => {
    let hud: HudState = MENU_HUD
    const stub = createStub(() => hud)

    const { unmount } = render(<GameShell session={stub} />)
    expect(stub.calls).toEqual(['attach:host'])

    hud = { ...MENU_HUD, status: 'playing', score: 50, lives: 3 }
    act(() => {
      stub.notify()
    })
    expect(screen.getByText('000050')).not.toBeNull()

    unmount()
    expect(stub.calls).toEqual(['attach:host', 'detach'])
  })

  it('rebuilds the engine on every StrictMode remount', () => {
    const stub = createStub(() => MENU_HUD)
    const { unmount } = render(<GameShell session={stub} />)
    unmount()
    const second = render(<GameShell session={stub} />)

    expect(stub.calls).toEqual(['attach:host', 'detach', 'attach:host'])
    second.unmount()
    expect(stub.calls.at(-1)).toBe('detach')
  })
})

describe('module wiring', () => {
  it('renders the HUD inside the shell without an engine', () => {
    const stub = createStub(() => MENU_HUD)
    render(<GameShell session={stub} />)
    expect(screen.getAllByText('004200').length).toBeGreaterThan(0)
  })

  it('replaces every panel with the error screen and offers a reload', () => {
    const stub = createStub(() => MENU_HUD)
    render(
      <Screens
        hud={{ ...MENU_HUD, error: { kind: 'context', message: 'Contexto perdido' } }}
        session={stub}
      />,
    )

    expect(screen.getByText('Contexto perdido')).not.toBeNull()
    expect(screen.queryByText('Paper Breaker')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'RECARGAR' }))
    expect(stub.calls).toEqual(['reload'])
  })
})
