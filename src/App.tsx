import { useState } from 'react'
import { GameSession } from './bridge'
import { createGameRenderer } from './rendering'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { GameShell } from './ui/GameShell'

/**
 * Composition root: the only place that knows both the engine and the three.js
 * renderer, which keeps every other module free of that coupling.
 */
const App = () => {
  const [session] = useState(() => new GameSession({ createRenderer: createGameRenderer }))
  return (
    <ErrorBoundary>
      <GameShell session={session} />
    </ErrorBoundary>
  )
}

export default App
