// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameFacade } from '../src/bridge'
import type { HudState } from '../src/core/types'
import type { ControlScheme } from '../src/platform/ControlScheme'
import { TouchInput } from '../src/systems/TouchInput'
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
  audioEnabled: true,
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
    touch: new TouchInput(),
    start: () => calls.push('start'),
    togglePause: () => calls.push('togglePause'),
    toggleHelp: () => calls.push('toggleHelp'),
    isAudioEnabled: () => true,
    toggleAudio: () => calls.push('toggleAudio'),
    quitToMenu: () => calls.push('quitToMenu'),
    nextLevel: () => calls.push('nextLevel'),
    reload: () => calls.push('reload'),
    notify: () => listener?.(),
  }
}

/** Screens with fixed scheme props; tests can still track scheme changes. */
const renderScreens = (
  hud: HudState,
  session: StubFacade,
  options: { scheme?: ControlScheme; onSchemeChange?: (scheme: ControlScheme) => void } = {},
) =>
  render(
    <Screens
      hud={hud}
      session={session}
      scheme={options.scheme ?? 'desktop'}
      onSchemeChange={options.onSchemeChange ?? (() => undefined)}
    />,
  )

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
    renderScreens(MENU_HUD, stub)

    expect(screen.getByText('Paper Breaker')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'JUGAR' }))
    expect(stub.calls).toContain('start')
  })

  it('renders nothing while playing', () => {
    const stub = createStub(() => MENU_HUD)
    const { container } = renderScreens({ ...MENU_HUD, status: 'playing' }, stub)
    expect(container.querySelector('.panel')).toBeNull()
  })

  it('offers resume and quit while paused', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens({ ...MENU_HUD, status: 'paused' }, stub)

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUAR' }))
    fireEvent.click(screen.getByRole('button', { name: 'SALIR AL MENÚ' }))
    expect(stub.calls).toEqual(['togglePause', 'quitToMenu'])
  })

  it('celebrates a record on game over', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens(
      { ...MENU_HUD, status: 'gameOver', score: 900, record: 900, isRecord: true },
      stub,
    )

    expect(screen.getByText('¡Nuevo récord!')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
    expect(stub.calls).toContain('start')
  })

  it('advances to the next level and closes the campaign', () => {
    const stub = createStub(() => MENU_HUD)
    const { unmount } = renderScreens({ ...MENU_HUD, status: 'levelComplete' }, stub)
    fireEvent.click(screen.getByRole('button', { name: 'SIGUIENTE NIVEL' }))
    expect(stub.calls).toContain('nextLevel')
    unmount()

    renderScreens({ ...MENU_HUD, status: 'levelComplete', isFinalLevel: true }, stub)
    expect(screen.getByRole('button', { name: 'VOLVER AL MENÚ' })).not.toBeNull()
  })

  it('offers a discreet control-scheme change in the menu and the pause panel', () => {
    const stub = createStub(() => MENU_HUD)
    const onSchemeChange = vi.fn<(scheme: ControlScheme) => void>()
    const { unmount } = renderScreens(MENU_HUD, stub, { scheme: 'desktop', onSchemeChange })

    fireEvent.click(screen.getByRole('button', { name: 'TÁCTIL' }))
    expect(onSchemeChange).toHaveBeenCalledWith('touch')
    unmount()

    renderScreens({ ...MENU_HUD, status: 'paused' }, stub, { scheme: 'touch', onSchemeChange })
    fireEvent.click(screen.getByRole('button', { name: 'ESCRITORIO' }))
    expect(onSchemeChange).toHaveBeenCalledWith('desktop')
  })

  it('toggles the procedural sound from the menu and the pause panel', () => {
    const stub = createStub(() => MENU_HUD)
    const { unmount } = renderScreens(MENU_HUD, stub)
    fireEvent.click(screen.getByRole('button', { name: 'SONIDO: ON' }))
    expect(stub.calls).toEqual(['toggleAudio'])
    unmount()

    renderScreens({ ...MENU_HUD, status: 'paused', audioEnabled: false }, stub)
    expect(screen.getByRole('button', { name: 'SONIDO: OFF' })).not.toBeNull()
  })
})

describe('HelpScreen', () => {
  it('replaces every other panel with the guide', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens({ ...MENU_HUD, helpVisible: true }, stub)

    expect(screen.getByText('Guía de juego')).not.toBeNull()
    expect(screen.queryByText('Paper Breaker')).toBeNull()
  })

  it('explains every power-up and brick type', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens({ ...MENU_HUD, helpVisible: true }, stub)

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
    renderScreens({ ...MENU_HUD, helpVisible: true }, stub)

    fireEvent.click(screen.getByRole('button', { name: 'JUGAR' }))
    expect(stub.calls).toEqual(['toggleHelp', 'start'])
  })

  it('closes the guide with no start button outside the menu', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens({ ...MENU_HUD, status: 'paused', helpVisible: true }, stub)

    expect(screen.queryByRole('button', { name: 'JUGAR' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'CERRAR' }))
    expect(stub.calls).toEqual(['toggleHelp'])
  })
})

describe('GameShell', () => {
  it('mounts and detaches the engine around the canvas host', () => {
    let hud: HudState = MENU_HUD
    const stub = createStub(() => hud)
    const shell = (scheme: ControlScheme) => (
      <GameShell session={stub} scheme={scheme} onSchemeChange={() => undefined} />
    )

    const { unmount } = render(shell('desktop'))
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
    const shell = () => (
      <GameShell session={stub} scheme="desktop" onSchemeChange={() => undefined} />
    )
    const { unmount } = render(shell())
    unmount()
    const second = render(shell())

    expect(stub.calls).toEqual(['attach:host', 'detach', 'attach:host'])
    second.unmount()
    expect(stub.calls.at(-1)).toBe('detach')
  })

  it('shows the touch controls only in touch mode during a live run', () => {
    let hud: HudState = { ...MENU_HUD, status: 'playing' }
    const stub = createStub(() => hud)
    const shell = (scheme: ControlScheme) => (
      <GameShell session={stub} scheme={scheme} onSchemeChange={() => undefined} />
    )

    const touch = render(shell('touch'))
    expect(screen.getByRole('group', { name: 'Controles táctiles' })).not.toBeNull()
    touch.unmount()

    const desktop = render(shell('desktop'))
    expect(screen.queryByRole('group', { name: 'Controles táctiles' })).toBeNull()
    desktop.unmount()

    hud = { ...MENU_HUD, status: 'playing', helpVisible: true }
    const hidden = render(shell('touch'))
    expect(screen.queryByRole('group', { name: 'Controles táctiles' })).toBeNull()
    hidden.unmount()
  })
})

describe('module wiring', () => {
  it('renders the HUD inside the shell without an engine', () => {
    const stub = createStub(() => MENU_HUD)
    render(<GameShell session={stub} scheme="desktop" onSchemeChange={() => undefined} />)
    expect(screen.getAllByText('004200').length).toBeGreaterThan(0)
  })

  it('replaces every panel with the error screen and offers a reload', () => {
    const stub = createStub(() => MENU_HUD)
    renderScreens({ ...MENU_HUD, error: { kind: 'context', message: 'Contexto perdido' } }, stub)

    expect(screen.getByText('Contexto perdido')).not.toBeNull()
    expect(screen.queryByText('Paper Breaker')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'RECARGAR' }))
    expect(stub.calls).toEqual(['reload'])
  })
})
