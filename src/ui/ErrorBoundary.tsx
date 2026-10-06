import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PaperButton } from './PaperButton'

interface ErrorBoundaryProps {
  readonly children: ReactNode
}

interface ErrorBoundaryState {
  readonly failed: boolean
}

/**
 * Last line of defence: without it any render failure leaves the visitors with a
 * blank page and no way out. The fallback offers a reload instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui]', error, info.componentStack)
  }

  private readonly reload = (): void => {
    globalThis.location?.reload()
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="shell shell--fallback">
        <div className="panel" role="alert">
          <h1 className="panel__title">Algo se rompió</h1>
          <p className="panel__meta">
            La interfaz encontró un error inesperado. Recarga la página para volver a jugar.
          </p>
          <PaperButton label="RECARGAR" onClick={this.reload} />
        </div>
      </div>
    )
  }
}
