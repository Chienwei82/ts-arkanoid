export interface PaperButtonProps {
  readonly label: string
  readonly onClick: () => void
  readonly tone?: 'primary' | 'ghost'
  readonly disabled?: boolean
}

/** Card-stock button: it visibly presses into the board when clicked. */
export const PaperButton = ({
  label,
  onClick,
  tone = 'primary',
  disabled = false,
}: PaperButtonProps) => (
  <button type="button" className={`btn btn--${tone}`} onClick={onClick} disabled={disabled}>
    {label}
  </button>
)
