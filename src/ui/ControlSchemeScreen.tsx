import type { ControlScheme } from '../platform/ControlScheme'
import { ControlSchemePicker } from './ControlSchemePicker'

interface ControlSchemeScreenProps {
  readonly onSelect: (scheme: ControlScheme) => void
}

/**
 * Boot fallback shown before the scene starts when device detection cannot
 * decide between pointer and touch controls on its own. Big paper buttons make
 * it usable with either finger or mouse, and the choice is remembered.
 */
export const ControlSchemeScreen = ({ onSelect }: ControlSchemeScreenProps) => (
  <div className="shell">
    <div className="screens screens--fill">
      <div className="panel" role="dialog" aria-modal="true" aria-label="Elección de controles">
        <h1 className="panel__title">¿Cómo vas a jugar?</h1>
        <p className="panel__tag">
          Paper Breaker no ha podido detectar tu dispositivo con certeza.
        </p>
        <p className="panel__meta">
          Elige el tipo de controles. Podrás cambiarlo después desde el menú de pausa.
        </p>
        <ControlSchemePicker scheme={null} onSelect={onSelect} />
      </div>
    </div>
  </div>
)
