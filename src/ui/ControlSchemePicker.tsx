import type { ControlScheme } from '../platform/ControlScheme'
import { PaperButton } from './PaperButton'

export interface ControlSchemePickerProps {
  /** Current choice; null when nothing is selected yet (boot fallback). */
  readonly scheme: ControlScheme | null
  readonly onSelect: (scheme: ControlScheme) => void
  /** Compact variant used by the settings row inside existing panels. */
  readonly compact?: boolean
}

/** Two large, labelled options: keyboard/mouse or on-screen touch controls. */
export const ControlSchemePicker = ({
  scheme,
  onSelect,
  compact = false,
}: ControlSchemePickerProps) => (
  <div
    className={`scheme-picker${compact ? ' scheme-picker--compact' : ''}`}
    role="group"
    aria-label="Tipo de controles"
  >
    <PaperButton
      label={compact ? 'ESCRITORIO' : 'ESCRITORIO (TECLADO / RATÓN)'}
      tone={scheme === 'desktop' ? 'primary' : 'ghost'}
      pressed={scheme === 'desktop'}
      onClick={() => onSelect('desktop')}
    />
    <PaperButton
      label={compact ? 'TÁCTIL' : 'MÓVIL / TABLETA (TÁCTIL)'}
      tone={scheme === 'touch' ? 'primary' : 'ghost'}
      pressed={scheme === 'touch'}
      onClick={() => onSelect('touch')}
    />
  </div>
)
