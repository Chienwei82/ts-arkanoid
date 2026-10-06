import { SCORING } from '../config/gameConfig'
import type { HudState } from '../core/types'
import { POWER_UP_GLYPH, POWER_UP_LABEL, formatScore, formatSeconds } from './format'

interface HudProps {
  readonly hud: HudState
}

/** Paper HUD: score, record, level chip, hearts and running power-up cards. */
export const Hud = ({ hud }: HudProps) => (
  <header className="hud">
    <section className="hud__stack">
      <span className="hud__label">Puntos</span>
      <strong className="hud__value" key={hud.score} aria-live="polite" aria-atomic="true">
        {formatScore(hud.score)}
      </strong>
      {hud.combo > 1 && (
        <span className="hud__combo" key={hud.combo}>
          combo {hud.combo} · ×{hud.multiplier}
        </span>
      )}
    </section>

    <section className="hud__stack hud__stack--centre">
      <span className="hud__label">
        Nivel {hud.levelIndex + 1} / {hud.levelTotal}
      </span>
      <strong className="hud__level">{hud.levelName}</strong>
    </section>

    <section className="hud__stack hud__stack--end">
      <span className="hud__label">Récord</span>
      <strong className="hud__value hud__value--small" key={hud.record}>
        {formatScore(hud.record)}
      </strong>
      <ul className="lives" aria-label={`${hud.lives} vidas`}>
        {/* One heart per configured slot, so the bonus life has one to light up. */}
        {Array.from({ length: SCORING.maxLives }, (_, index) => (
          <li
            key={index}
            className={index < hud.lives ? 'lives__heart' : 'lives__heart lives__heart--empty'}
            aria-hidden="true"
          >
            ♥
          </li>
        ))}
      </ul>
    </section>

    {hud.powerUps.length > 0 && (
      <ul className="chips">
        {hud.powerUps.map((powerUp) => (
          <li
            key={powerUp.type}
            className="chip"
            data-type={powerUp.type}
            title={POWER_UP_LABEL[powerUp.type]}
          >
            <span className="chip__glyph" aria-hidden="true">
              {POWER_UP_GLYPH[powerUp.type]}
            </span>
            <span className="chip__time">{formatSeconds(powerUp.remaining)}</span>
          </li>
        ))}
      </ul>
    )}
  </header>
)
