import type { GameFacade } from '../bridge'
import type { HudState } from '../core/types'
import type { ControlScheme } from '../platform/ControlScheme'
import { ControlSchemePicker } from './ControlSchemePicker'
import { HelpScreen } from './HelpScreen'
import { PaperButton } from './PaperButton'
import { formatScore } from './format'

interface ScreensProps {
  readonly hud: HudState
  readonly session: GameFacade
  readonly scheme: ControlScheme
  readonly onSchemeChange: (scheme: ControlScheme) => void
}

interface ErrorScreenProps {
  readonly hud: HudState
  readonly session: GameFacade
}

const CONTROLS: readonly string[] = [
  'Ratón, dedo o ← → / A D para mover la paleta',
  'Clic, toque o ESPACIO para lanzar',
  'ESC o P para pausar',
  'H para abrir o cerrar la guía de power-ups y bloques',
]

/** Full-screen paper panel for a fatal engine/renderer failure. */
export const EngineErrorScreen = ({ hud, session }: ErrorScreenProps) => {
  if (hud.error === null) return null
  return (
    <div className="screens">
      <div className="panel" role="alert">
        <h2 className="panel__title">Ups…</h2>
        <p className="panel__meta">{hud.error.message}</p>
        <div className="panel__actions">
          <PaperButton label="RECARGAR" onClick={() => session.reload()} />
        </div>
      </div>
    </div>
  )
}

/** Full-screen paper panels for every non-playing game state and the guide. */
export const Screens = ({ hud, session, scheme, onSchemeChange }: ScreensProps) => {
  if (hud.error !== null) return <EngineErrorScreen hud={hud} session={session} />
  if (hud.helpVisible) return <HelpScreen hud={hud} session={session} />
  if (hud.status === 'playing') return null

  return (
    <div className="screens">
      <div className="panel" role="dialog" aria-modal="true">
        {hud.status === 'menu' && (
          <>
            <h1 className="panel__title">Paper Breaker</h1>
            <p className="panel__tag">Arkanoid voxel recortado en papel</p>
            <p className="panel__meta">
              Récord <strong>{formatScore(hud.record)}</strong> · {hud.levelTotal} niveles
            </p>
            <PaperButton label="JUGAR" onClick={() => session.start()} />
            <ul className="panel__controls">
              {CONTROLS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="panel__settings">
              <span className="panel__settings-label">Controles</span>
              <ControlSchemePicker scheme={scheme} onSelect={onSchemeChange} compact />
            </div>
          </>
        )}

        {hud.status === 'paused' && (
          <>
            <h2 className="panel__title">Pausa</h2>
            <p className="panel__meta">
              Puntos <strong>{formatScore(hud.score)}</strong>
            </p>
            <div className="panel__actions">
              <PaperButton label="CONTINUAR" onClick={() => session.togglePause()} />
              <PaperButton
                label="SALIR AL MENÚ"
                tone="ghost"
                onClick={() => session.quitToMenu()}
              />
            </div>
            <div className="panel__settings">
              <span className="panel__settings-label">Controles</span>
              <ControlSchemePicker scheme={scheme} onSelect={onSchemeChange} compact />
            </div>
          </>
        )}

        {hud.status === 'levelComplete' && (
          <>
            <h2 className="panel__title">
              {hud.isFinalLevel ? '¡Campaña completada!' : '¡Nivel superado!'}
            </h2>
            <p className="panel__meta">
              {hud.levelName} · Puntos <strong>{formatScore(hud.score)}</strong>
            </p>
            <div className="panel__actions">
              <PaperButton
                label={hud.isFinalLevel ? 'VOLVER AL MENÚ' : 'SIGUIENTE NIVEL'}
                onClick={() => session.nextLevel()}
              />
            </div>
          </>
        )}

        {hud.status === 'gameOver' && (
          <>
            <h2 className="panel__title">Fin de la partida</h2>
            {hud.isRecord && <p className="panel__badge">¡Nuevo récord!</p>}
            <p className="panel__meta">
              Puntos <strong>{formatScore(hud.score)}</strong> · Récord{' '}
              <strong>{formatScore(hud.record)}</strong>
            </p>
            <div className="panel__actions">
              <PaperButton label="REINTENTAR" onClick={() => session.start()} />
              <PaperButton label="MENÚ" tone="ghost" onClick={() => session.quitToMenu()} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
