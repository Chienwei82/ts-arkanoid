import React from 'react'
import type { GameFacade } from '../bridge'
import type { HudState } from '../core/types'
import type { GenreId } from '../core/audio'
import { GENRE_IDS } from '../core/audio'
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
  'Ratón, dedo o ← → / A D para pilotar la nave',
  'Clic, toque o ESPACIO para lanzar',
  'ESC o P para pausar',
  'H para abrir o cerrar la guía de módulos y cascos',
]

const GENRE_LABELS: Record<GenreId, string> = {
  electronic: 'Electrónica',
  pop: 'Pop',
  techno: 'Techno',
  dance: 'Dance',
  classic: 'Clásica',
}

/**
 * Music menu popover: toggle on/off plus genre grid. Opens when the SONIDO
 * button is clicked, closes with Escape, a click outside or by selecting a
 * genre. Fully keyboard-navigable (tab/arrows, Enter/Space to activate).
 */
const MusicMenu = ({ hud, session }: { readonly hud: HudState; readonly session: GameFacade }) => {
  const [open, setOpen] = React.useState(false)
  const [focusIdx, setFocusIdx] = React.useState(0)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  // Close on click outside or Escape key.
  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const toggleAudio = () => {
    session.toggleAudio()
    setOpen(false)
  }

  const selectGenre = (genreId: GenreId) => {
    session.setAudioGenre(genreId)
    setOpen(false)
  }

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusIdx((i) => (i + 1) % GENRE_IDS.length)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusIdx((i) => (i + GENRE_IDS.length - 1) % GENRE_IDS.length)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectGenre(GENRE_IDS[focusIdx])
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--ghost music-menu__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        onKeyDown={keyDown}
      >
        {hud.audioEnabled ? 'SONIDO: ON' : 'SONIDO: OFF'}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="music-menu__popover"
          role="menu"
          aria-label="Música"
          onKeyDown={keyDown}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className={`music-menu__item${hud.audioEnabled ? ' music-menu__item--on' : ''}`}
            aria-checked={hud.audioEnabled}
            onClick={toggleAudio}
          >
            {hud.audioEnabled ? 'Desactivar música' : 'Activar música'}
          </button>
          {GENRE_IDS.map((genreId) => {
            const selected = hud.audioGenre === genreId
            return (
              <button
                key={genreId}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`music-menu__item${selected ? ' music-menu__item--selected' : ''}`}
                onClick={() => selectGenre(genreId)}
              >
                {GENRE_LABELS[genreId]}
                {selected ? ' · seleccionado' : ''}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

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

/** Full-screen neon panels for every non-playing game state and the guide. */
export const Screens = ({ hud, session, scheme, onSchemeChange }: ScreensProps) => {
  if (hud.error !== null) return <EngineErrorScreen hud={hud} session={session} />
  if (hud.helpVisible) return <HelpScreen hud={hud} session={session} />
  if (hud.status === 'playing') return null

  return (
    <div className="screens">
      <div className="panel" role="dialog" aria-modal="true">
        {hud.status === 'menu' && (
          <>
            <h1 className="panel__title">Star Breaker</h1>
            <p className="panel__tag">Arkanoid orbital caza-invasores</p>
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
            <MusicMenu hud={hud} session={session} />
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
            <MusicMenu hud={hud} session={session} />
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
