import { useCallback, useState } from 'react'
import { GameSession } from './bridge'
import {
  createLocalStorageControlScheme,
  resolveControlScheme,
  type ControlScheme,
} from './platform/ControlScheme'
import { collectDeviceSignals, detectDevice } from './platform/DeviceDetector'
import { createGameRenderer } from './rendering'
import { ControlSchemeScreen } from './ui/ControlSchemeScreen'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { GameShell } from './ui/GameShell'

/**
 * Composition root: the only place that knows both the engine and the three.js
 * renderer, which keeps every other module free of that coupling. It also owns
 * the boot-time control scheme: the scene starts only once the input style is
 * known — automatically when detection is confident, asking the player when it
 * is not — and the choice is persisted so the question is asked only once.
 */
const App = () => {
  const [session] = useState(() => new GameSession({ createRenderer: createGameRenderer }))
  const [storage] = useState(createLocalStorageControlScheme)
  const [scheme, setScheme] = useState<ControlScheme | null>(() =>
    resolveControlScheme(storage.load(), detectDevice(collectDeviceSignals())),
  )

  const chooseScheme = useCallback(
    (next: ControlScheme) => {
      storage.save(next)
      setScheme(next)
    },
    [storage],
  )

  return (
    <ErrorBoundary>
      {scheme === null ? (
        <ControlSchemeScreen onSelect={chooseScheme} />
      ) : (
        <GameShell session={session} scheme={scheme} onSchemeChange={chooseScheme} />
      )}
    </ErrorBoundary>
  )
}

export default App
