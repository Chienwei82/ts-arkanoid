export interface PaperButtonProps {
  readonly label: string
  readonly onClick: () => void
  readonly tone?: 'primary' | 'ghost'
  readonly disabled?: boolean
  /** Exposed as aria-pressed for toggle-style buttons; omit for plain ones. */
  readonly pressed?: boolean
}

/** Neon-cabinet button: it glows brighter and dips when pressed. */
export const PaperButton = ({
  label,
  onClick,
  tone = 'primary',
  disabled = false,
  pressed,
}: PaperButtonProps) => (
  <button
    type="button"
    className={`btn btn--${tone}`}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={pressed}
  >
    {label}
  </button>
)
