import type { GameFacade } from '../bridge'
import type { HudState } from '../core/types'
import { BRICK_HELP, POWER_UP_HELP } from './help'
import { PaperButton } from './PaperButton'

interface HelpScreenProps {
  readonly hud: HudState
  readonly session: GameFacade
}

/** Full-screen arcade guide: what every module and hull does, plus H hint. */
export const HelpScreen = ({ hud, session }: HelpScreenProps) => {
  const play = (): void => {
    session.toggleHelp()
    session.start()
  }
  return (
    <div className="screens">
      <div className="panel panel--wide" role="dialog" aria-modal="true" aria-label="Guía de juego">
        <h2 className="panel__title">Guía de vuelo</h2>
        <p className="panel__tag">Módulos y cascos de Star Breaker</p>

        <section className="help__section">
          <h3 className="help__heading">Módulos</h3>
          <ul className="help__grid">
            {POWER_UP_HELP.map((entry) => (
              <li key={entry.type} className="help-card">
                <span className="chip chip--help" data-type={entry.type}>
                  <span className="chip__glyph" aria-hidden="true">
                    {entry.glyph}
                  </span>
                  {entry.name}
                </span>
                <p className="help-card__detail">{entry.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="help__section">
          <h3 className="help__heading">Cascos</h3>
          <ul className="help__grid">
            {BRICK_HELP.map((entry) => (
              <li key={entry.type} className="help-card">
                <span className="help-card__name">
                  <span className={`help-swatch help-swatch--${entry.type}`} aria-hidden="true" />
                  {entry.name}
                </span>
                <p className="help-card__detail">{entry.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="help__hint">Pulsa H para mostrar u ocultar esta guía.</p>
        <div className="panel__actions">
          {hud.status === 'menu' && <PaperButton label="JUGAR" onClick={play} />}
          <PaperButton
            label="CERRAR"
            tone={hud.status === 'menu' ? 'ghost' : 'primary'}
            onClick={() => session.toggleHelp()}
          />
        </div>
      </div>
    </div>
  )
}
