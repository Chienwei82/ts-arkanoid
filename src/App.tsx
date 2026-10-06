import { useCallback, useState } from 'react'
import { AudioDirector } from './audio'
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
 * One audio system for the whole app: its AudioContext has to survive React
 * StrictMode's double mount and every engine attach/detach, so it lives at
 * module scope (the same reason the tetris project builds it in its entry
 * point) instead of inside a `useState` initializer.
 */
const audio = new AudioDirector()

/**
 * Composition root: the only place that knows both the engine and the three.js
 * renderer, which keeps every other module free of that coupling. It also owns
 * the boot-time control scheme: the scene starts only once the input style is
 * known — automatically when detection is confident, asking the player when it
 * is not — and the choice is persisted so the question is asked only once.
 */
const App = () => {
  const [session] = useState(() => new GameSession({ createRenderer: createGameRenderer, audio }))
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
