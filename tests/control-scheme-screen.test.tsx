// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ControlScheme } from '../src/platform/ControlScheme'
import { ControlSchemeScreen } from '../src/ui/ControlSchemeScreen'

afterEach(() => {
  cleanup()
})

describe('ControlSchemeScreen', () => {
  it('asks between desktop and touch with large, labelled options', () => {
    render(<ControlSchemeScreen onSelect={() => undefined} />)

    expect(screen.getByRole('dialog', { name: 'Elección de controles' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'ESCRITORIO (TECLADO / RATÓN)' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'MÓVIL / TABLETA (TÁCTIL)' })).not.toBeNull()
  })

  it('reports the chosen scheme', () => {
    const onSelect = vi.fn<(scheme: ControlScheme) => void>()
    render(<ControlSchemeScreen onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'MÓVIL / TABLETA (TÁCTIL)' }))
    expect(onSelect).toHaveBeenCalledWith('touch')

    fireEvent.click(screen.getByRole('button', { name: 'ESCRITORIO (TECLADO / RATÓN)' }))
    expect(onSelect).toHaveBeenCalledWith('desktop')
  })
})
