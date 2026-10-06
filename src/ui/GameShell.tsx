import { useEffect, useRef } from 'react'
import type { GameFacade } from '../bridge'
import { Hud } from './Hud'
import { Screens } from './Screens'
import { useHudState } from './hooks'
import './ui.css'

interface GameShellProps {
  readonly session: GameFacade
}

/**
 * Layout host: the canvas lives in its own layer (the engine owns that DOM) and
 * the HUD/panels float above it. `attach` is the only lifecycle call, so React
 * StrictMode's mount/unmount/mount cycle builds and disposes the engine twice
 * without leaking either time.
 */
export const GameShell = ({ session }: GameShellProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const hud = useHudState(session)

  useEffect(() => session.attach(hostRef.current), [session])

  return (
    <div className="shell">
      <div className="shell__stage" ref={hostRef} role="img" aria-label="Tablero de juego" />
      <div className="shell__overlay">
        <Hud hud={hud} />
        <Screens hud={hud} session={session} />
      </div>
    </div>
  )
}
