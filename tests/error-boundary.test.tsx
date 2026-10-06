// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../src/ui/ErrorBoundary'

const Boom = (): never => {
  throw new Error('render failed')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary', () => {
  it('renders its children while nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>contenido</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido')).not.toBeNull()
  })

  it('replaces a crashed subtree with a reload panel', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reload = vi.fn<() => void>()
    vi.stubGlobal('location', { reload })

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).not.toBeNull()
    expect(screen.getByText('Algo se rompió')).not.toBeNull()
    expect(consoleError).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'RECARGAR' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
