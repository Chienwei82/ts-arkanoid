import { useEffect, useRef } from 'react'
import type { GameFacade } from '../bridge'
import type { ControlScheme } from '../platform/ControlScheme'
import { Hud } from './Hud'
import { Screens } from './Screens'
import { TouchControls } from './TouchControls'
import { useHudState } from './hooks'
import './ui.css'

interface GameShellProps {
  readonly session: GameFacade
  readonly scheme: ControlScheme
  readonly onSchemeChange: (scheme: ControlScheme) => void
}

/**
 * Layout host: the canvas lives in its own layer (the engine owns that DOM) and
 * the HUD/panels float above it. `attach` is the only lifecycle call, so React
 * StrictMode's mount/unmount/mount cycle builds and disposes the engine twice
 * without leaking either time. Touch controls render over the canvas in touch
 * mode and only while a run is live, so they never fight the panels.
 */
export const GameShell = ({ session, scheme, onSchemeChange }: GameShellProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const hud = useHudState(session)

  useEffect(() => session.attach(hostRef.current), [session])

  const touchActive =
    scheme === 'touch' && hud.status === 'playing' && !hud.helpVisible && hud.error === null

  return (
    <div className="shell">
      <div className="shell__stage" ref={hostRef} role="img" aria-label="Tablero de juego" />
      <div className="shell__overlay">
        <Hud hud={hud} />
        <Screens hud={hud} session={session} scheme={scheme} onSchemeChange={onSchemeChange} />
      </div>
      {touchActive && <TouchControls touch={session.touch} />}
    </div>
  )
}
