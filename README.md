# Paper Breaker

Arkanoid/Breakout en 3D con **three.js**, **React** y **TypeScript estricto**, con una
dirección de arte _papercraft × voxel_ inspirada en _Paper Mario: Color Splash_ y en los
tableros de Super Mario: cielo ilustrado, nubes y colinas de papel recortado, plataformas
flotantes con damero, bloques voxel y ladrillos construidos con tres capas (casete de tinta,
marco de papel y cuerpo tintado).

- Motor de juego **sin dependencias de three.js ni React** (testeable en Node).
- **Timestep fijo** para la física y render **interpolado**.
- Ladrillos en `InstancedMesh`, confeti y proyectiles con **object pooling**: sin
  asignaciones en el bucle de render.
- Post-procesado con `EffectComposer`: **bloom** suave + pase propio de **viñeta y grano de papel**.
- Puente delgado motor↔React mediante **store externo** (`useSyncExternalStore`); el motor
  nunca conoce a React.

## Requisitos

- Node 20.19+ (probado con Node 24).
- npm 10+ (el árbol de dependencias usa _aliases_ de npm para convivir TypeScript 7 y 6).

## Stack

Versiones fijadas a la última estable publicada en npm, verificadas con `npm view <paquete> version`
y comprobando sus `peerDependencies` antes de fijarlas.

| Paquete                            | Versión                             | Rol                                     |
| ---------------------------------- | ----------------------------------- | --------------------------------------- |
| `vite`                             | 8.3.2                               | Bundler/dev server (Rolldown)           |
| `@vitejs/plugin-react`             | 6.1.2                               | Fast Refresh y transformación JSX (oxc) |
| `vitest` + `@vitest/coverage-v8`   | 5.0.3                               | Tests y cobertura (v8)                  |
| `react` / `react-dom`              | 19.3.0                              | UI (HUD y pantallas)                    |
| `three` + `@types/three`           | 0.186.1 / 0.186.0                   | Render 3D                               |
| `@typescript/native`               | `npm:typescript@7.0.2`              | **Compilador nativo (Go)** para `tsc`   |
| `typescript`                       | `npm:@typescript/typescript6@6.0.2` | API TS 6 para el linting type-aware     |
| `typescript-eslint`                | 8.71.1                              | Reglas type-aware                       |
| `eslint` / `prettier`              | 10.12.0 / 3.9.9                     | Lint y formato                          |
| `jsdom` + `@testing-library/react` | 30.1.2 / 16.3.3                     | Entorno DOM y pruebas de React          |

### TypeScript 7 nativo conviviendo con la API de TS 6

`typescript-eslint@8` exige la API del compilador (`require('typescript')`) y solo admite
`<6.1.0`; TypeScript 7 es el puerto nativo, que **no expone esa API** (`@typescript/native`
publica únicamente binarios y una API nueva en `./unstable/*`). La solución soportada por
Microsoft es el paquete de compatibilidad `@typescript/typescript6` más alias de npm:

```json
"@typescript/native": "npm:typescript@^7.0.2",   // → binario tsc (nativo)
"typescript": "npm:@typescript/typescript6@^6.0.2" // → API TS 6 + binario tsc6
```

Resultado: `npm run typecheck` usa **TS 7 nativo** (~4× más rápido que TS 6 en frío en este
proyecto: 0.7 s frente a 2.8 s) mientras `npm run lint` sigue teniendo tipos reales. Ambos
compiladores comparten los mismos `tsconfig`, y `npm run typecheck:ts6` permite comparar la
salida con el compilador clásico. Cuando `typescript-eslint` publique soporte para TS ≥ 7.1
(_issue_ #10940), bastará con quitar los alias.

Los `tsconfig` usan lo más moderno soportado por ambos compiladores: `target`/`lib` **ES2025**
y `module: "preserve"`.

## Comandos

```bash
npm install               # instala dependencias
npm run dev               # servidor de desarrollo (Vite)
npm run build             # typecheck (TS 7) + build de producción en dist/
npm run preview           # sirve el build de producción
npm test                  # Vitest (184 pruebas)
npm run test:watch        # Vitest en modo watch
npm run test:coverage     # tests + informe de cobertura con umbrales por capa
npm run typecheck         # tsc -b  → TypeScript 7 nativo
npm run typecheck:ts6     # tsc6 -b → TypeScript 6 (paridad de diagnóstico)
npm run lint              # ESLint (flat config, reglas type-aware) sin warnings
npm run lint:fix          # ESLint con autofix
npm run format            # Prettier --write
npm run check             # pipeline completo: typecheck + formato + lint + tests + build
```

`npm run dev` y `npm run preview` escuchan en todas las interfaces (`host: true`), así que además
de la URL local imprimen la **Network** URL y el juego se puede abrir desde cualquier dispositivo
de la misma LAN (útil para probar los controles táctiles en el móvil). Si en lugar de la IP usas
un nombre mDNS (`mi-portatil.local`), añádelo a `server.allowedHosts`.

## Controles

| Acción                            | Ratón / táctil                       | Teclado                      |
| --------------------------------- | ------------------------------------ | ---------------------------- |
| Mover la paleta                   | mover el puntero / arrastrar el dedo | `←` `→` o `A` `D`            |
| Lanzar la bola                    | clic o toque                         | `ESPACIO` (mantener = láser) |
| Pausa                             | botón PAUSA (táctil)                 | `ESC` o `P`                  |
| Guía de power-ups y bloques       | botón AYUDA (táctil)                 | `H`                          |
| Confirmar (menú, siguiente nivel) | botones de la UI                     | `ESPACIO` / `ENTER`          |

### Controles táctiles en pantalla

En modo táctil se superponen al canvas un **joystick virtual** (abajo a la izquierda) y los
botones **LANZAR** (lanza y, mantenido, dispara el láser), **PAUSA** y **AYUDA** (abajo a la
derecha), con multitáctil real: se puede mover el joystick y mantener un botón a la vez
(Pointer Events con `setPointerCapture` y manejo de `pointercancel`). Arrastrar un dedo por el
tablero también mueve la paleta. Los widgets son HTML/CSS sobre el canvas, nunca parte de la
escena three.js, y se ocultan en modo escritorio.

El modo se decide automáticamente con la detección de dispositivo (`DeviceDetector`: puntero
`coarse`/`hover`, `maxTouchPoints`, `userAgentData`/`userAgent` y tamaño de pantalla) y, cuando
la detección no es fiable (portátil táctil, tableta con teclado, iPadOS disfrazado de macOS…),
una pantalla de selección decide antes de arrancar la escena. La elección se guarda en
`localStorage` (`arkanoid.controls.v1`) y se puede cambiar después desde el menú o la pausa.

### Cómo probarlo en móvil

- **Chrome DevTools**: `npm run dev`, abre la URL local, `F12` → modo dispositivo (Ctrl+Shift+M),
  elige un perfil táctil (p. ej. Pixel 7) y prueba a rotar (retrato/paisaje) y con la barra de
  direcciones colapsada. La vista _responsive_ permite forzar `pointer: coarse` y tamaños de
  tableta para provocar la pantalla de selección.
- **Dispositivo real**: el dev server escucha en todas las interfaces; abre la Network URL que
  imprime Vite (o `npm run preview` para el build de producción) desde el móvil en la misma LAN.
  En Android comprueba: la escena llena la pantalla al rotar, sin scroll ni zoom accidental,
  multitáctil (joystick + botón a la vez) y que el juego se reanuda solo al volver de otra
  pestaña.

## Estructura

```
src/
  config/      gameConfig.ts (ajustes de juego y de render), palette.ts (paleta compartida)
  core/        GameLoop (timestep fijo), Game (orquestador), EventBus, states/ (State pattern)
  entities/    tipos + BrickBehavior y PowerUpEffect (Strategy) + factories (Factory)
  systems/     World, PhysicsSystem, CollisionSystem, ScoringSystem, PowerUpSystem,
               LaserSystem, comandos (Command) e input (InputManager/InputDispatcher/TouchInput)
  platform/    entorno navegador: ViewportManager (resize/orientación/visualViewport),
               DeviceDetector (con nivel de confianza) y ControlScheme (elección persistida)
  levels/      definiciones de nivel como datos + validación y cálculo de la cuadrícula
  rendering/   escena papercraft: SceneBuilder, BrickRenderer, ActorRenderer,
               ConfettiSystem, BallTrail, ExplosionWaves, ScreenShake, PostFX,
               texturas generadas por canvas y CraftGameRenderer (implementa GameRenderer)
  bridge/      GameFacade + GameSession (store externo que consume React)
  ui/          componentes React (HUD, paneles, controles táctiles) y su CSS
tests/         pruebas unitarias de física, colisiones, puntuación, estados, niveles,
               power-ups, pool, puente React y UI
```

### Flujo de dependencias

```
ui/ (React) ──► bridge/ ──► core/ ──► systems/ ──► entities/ ──► config/ + utils/
                              ▲
                              │ implementa GameRenderer
                        rendering/ (three.js)
```

`rendering/` es la única capa que importa three.js y `ui/` la única que importa React; una
regla de ESLint (`no-restricted-imports`) impide romper esa frontera por accidente y aplica
también a `platform/` (servicios del navegador: viewport, detección de dispositivo y esquema de
controles), que tampoco conoce three ni React.

## Arquitectura y patrones

- **State pattern** (`core/state`): `menu`, `playing`, `paused`, `levelComplete`, `gameOver`.
  La máquina valida las transiciones permitidas y emite `statusChanged`.
- **Observer / Event Bus tipado** (`core/EventBus`): los eventos (`brickDestroyed`, `lifeLost`,
  `powerUpCollected`, …) se tipan desde `GameEventMap`, así que nombre y payload se validan al
  compilar. El bus comunica juego → efectos → UI sin acoplarlos.
- **Entity + composición**: los actores son datos planos (`Ball`, `Paddle`, `Brick`, `PowerUp`)
  y los sistemas los procesan por lotes.
- **Strategy**: `BrickBehavior` (normal, resistente, indestructible y explosivo con cadena de
  detonaciones) y `PowerUpEffect` (ancho, multibola, lento, rápido, láser, vida) con
  `apply`/`revert` y duración opcional.
- **Factory**: `createBricks` y `createPowerUp`/`rollPowerUpType` construyen entidades a partir
  de los datos de nivel; añadir un nivel nuevo no toca lógica.
- **Object Pool** (`utils/ObjectPool`): power-ups, bolts de láser y las 600 piezas de confeti.
- **Command + input abstraction** (`systems/commands.ts`, `InputManager`, `InputDispatcher`):
  teclado, puntero, táctil y `visibilitychange` se traducen a comandos reutilizados.
- **Inyección de dependencias por constructor**: `Game` recibe `storage`, `bus`, `levels` y la
  fábrica de render (`createRenderer`). Sin singletons globales ocultos.
- **Bucle**: `GameLoop` acumula tiempo y avanza la simulación en pasos fijos
  (`PHYSICS.fixedStep = 1/120 s`) mientras el render recibe `alpha` para interpolar entre los
  dos últimos estados de simulación (evita el _stutter_ con pantallas de alta frecuencia).

## Datos de nivel

Un nivel es un objeto con una rejilla de caracteres y su afinación:

```ts
{
  id: 'level-1',
  name: 'IGNICIÓN',
  rows: [
    '.............',
    '.###########.',
    '.####!!!####.',
  ],
  palette: ['#ff5a4e', '#3f8cff', '#ffd23e', '#5fc94e'],
  ballSpeed: 34,
  powerUpDropRate: 0.22,
}
```

Leyenda: `.` vacío, `#` normal, `+` resistente (3 golpes), `X` indestructible, `!` explosivo.
`parseLevel` valida al arrancar filas de igual longitud, caracteres conocidos, al menos un
ladrillo destructible y un `powerUpDropRate` dentro de `[0, 1]`. La campaña incluye cuatro
niveles (`IGNICIÓN`, `FORTÍN`, `LABERINTO`, `NÚCLEO`).

## Efectos visuales y rendimiento

- Ladrillos: **tres `InstancedMesh`** por nivel (casete de tinta, marco de papel, cuerpo
  tintado) → un campo de ~90 ladrillos cuesta 3 _draw calls_. Sólo se reescriben las matrices
  de los ladrillos que están animándose (pulso de impacto o desintegración con giro y caída).
- Confeti: un `InstancedMesh` de 600 piezas recicladas con pool; cada rotura estalla con el
  color del ladrillo (más pequeña en las explosiones en cadena, que además lanzan una onda).
- Estela: `Points` con `BufferGeometry` de tamaño fijo (ring buffer) y blending aditivo.
- Iluminación dinámica: `PointLight` que sigue a la bola y deja un charco de luz sobre los
  ladrillos; ambiente hemisférico + direccional para el look de papel mate.
- Screen shake por _trauma_ (amplitud = trauma²) aplicado a la cámara con ruido de senos: sin
  asignaciones ni RNG en el bucle.
- Post-proceso: `RenderPass` → `UnrealBloomPass` (umbral alto, sólo altas luces) → viñeta +
  grano de papel → `OutputPass` (tone mapping ACES y conversión de color).
- Canvas responsivo: `ViewportManager` (`platform/`) mide el host con `ResizeObserver` y
  escucha `resize`/`orientationchange`/`visualViewport`; el `devicePixelRatio` queda limitado
  (`QUALITY.high.maxPixelRatio = 2`, `1.5` en el preset móvil) y la cámara se reencuadra para
  mantener el tablero con margen tipo diorama. El layout usa unidades `dvh` y safe areas para
  que la barra de direcciones de Android no recorte la escena.
- Calidad reducida en móvil (`QUALITY.low`): sin antialias ni bloom y con pixel ratio más
  ajustado. El render se detiene mientras la pestaña está oculta (`GameLoop` se suspende con
  `visibilitychange`) y el motor se auto-pausa al perder el foco.
- Transiciones: al cambiar de nivel o empezar partida el tablero entra con escala/tilt y la
  cámara retrocede brevemente; al superar un nivel cae confeti desde arriba.
- Sin números mágicos: todo el ajuste vive en `src/config/gameConfig.ts` y `palette.ts`.

## React y desmontaje

`GameSession` (`src/bridge`) es el único punto de contacto: `attach(host)` construye el motor,
suscribe los eventos del HUD a un snapshot inmutable y devuelve el `detach`. Los componentes
consumen `useSyncExternalStore`, así que React sólo se vuelve a renderizar cuando algo visible
cambia y **nunca** dentro del bucle de render. `attach` arranca el `requestAnimationFrame` sólo
cuando hay contenedor: las sesiones _headless_ avanzan paso a paso en las pruebas.

`dispose()` libera geometrías, materiales, texturas, listeners, el `ViewportManager`, los render
targets del compositor y fuerza la pérdida del contexto WebGL; el ciclo montaje/desmontaje/
remontaje de `StrictMode` está cubierto por pruebas.

## Pruebas y cobertura

```bash
npm test              # 236 pruebas en 25 archivos
npm run test:coverage # informe de cobertura + umbrales por capa
```

Cubren: colisiones (círculo-caja incluidas las recuperaciones degeneradas, rebote en paleta
según el punto de impacto, paredes, cadenas de ladrillos explosivos, recogida de power-ups,
láser), física (límites de la paleta, normalización de velocidad, bola pegada, caída de drops),
puntuación (combos, multiplicador, récord persistido, `isRecord`), transiciones de estado
(incluidos fin de partida y campaña completa), validación y factoría de niveles, efectos y
duraciones de power-ups, agotamiento de pools, comandos e input (teclado, puntero, táctil,
visibilidad y foco), persistencia tolerante a fallos, el **contrato motor↔renderer** con un
doble que graba llamadas, el bucle con un planificador de frames determinista (incluida la
suspensión con la pestaña oculta), el `ErrorBoundary` y los componentes de UI. La parte
móvil/táctil se prueba por separado: detección de dispositivo con nivel de confianza, elección
y persistencia del esquema de controles, `ViewportManager` (resize, orientación y
`visualViewport`), `TouchInput` y los controles en pantalla con multitáctil real (joystick +
botones, `pointercancel`) y su pantalla de selección.

Cobertura medida (`npm run test:coverage`):

| Capa           | Sentencias | Ramas |
| -------------- | ---------- | ----- |
| `src/utils`    | 100 %      | 97 %  |
| `src/entities` | 98.5 %     | 100 % |
| `src/levels`   | 98 %       | 97 %  |
| `src/platform` | 98 %       | 91 %  |
| `src/systems`  | 98 %       | 89 %  |
| `src/ui`       | 94 %       | 91 %  |
| `src/bridge`   | 95 %       | 67 %  |
| `src/core`     | 93 %       | 81 %  |

Los umbrales de `vitest.config.ts` son suelos por capa, medidos contra la suite actual. La capa
`src/rendering` se **informa pero no se exige**: necesita una GPU real, y se verifica con el
_smoke test_ manual descrito en la sección de producción.

## Posibles mejoras futuras

- **Compilador de React**: `@vitejs/plugin-react@6` ya expone la opción `compiler`, pero está
  marcada como `@experimental` y requiere `oxc-transform-react`; se activará cuando la
  integración se estabilice (memoización automática de los componentes de UI).
- **Audio**: motor WebAudio reaccionando a los mismos eventos del bus, con música por nivel.
- **Campaña**: más niveles, jefes, bloques móviles/rotatorios y una niebla que sube.
- **Progresión**: guardar niveles desbloqueados, récords por nivel y monedas de tablero.
- **Accesibilidad**: remapeo de teclas, escala de UI y modo daltónico para los ladrillos.
- **Rendimiento**: `BatchedMesh` si los niveles crecen; partículas simuladas en un worker.
- **Móvil**: zona de arrastre absoluta y vibración en impactos fuertes.
- **Herramientas**: editor de niveles en la UI exportando el JSON de la rejilla.
- **Tests**: doble de `WebGLRenderer` para verificar matrices y número de draw calls.

## Producción

### Checklist antes de publicar

```bash
npm ci          # instalación reproducible
npm run check   # typecheck + format + lint + tests + build
npm run preview # sirve dist/ tal cual se subirá
```

### Despliegue

- `npm run build` genera `dist/` **autocontenido** y con `base: './'`, así que funciona
  servido desde la raíz o desde cualquier subcarpeta/CDN estático (Netlify, GitHub Pages,
  S3, Nginx…).
- El bundle se divide en `assets/three-*.js` (motor 3D, cacheable entre despliegues) y
  `assets/index-*.js` (app). Las fuentes se sirven como `woff2` con `font-display: swap`.
- No hay variables de entorno ni backend: el único estado persistente es el récord en
  `localStorage` (`arkanoid.record.v1`), que falla de forma silenciosa en modo privado.

### Robustez en producción

| Escenario                                             | Comportamiento                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Navegador sin WebGL                                   | La UI sigue viva y muestra un panel explicativo con botón de recarga                                                          |
| Pérdida del contexto WebGL (GPU reset, cambio de GPU) | El motor se pausa, se evita dibujar sobre un contexto muerto y se ofrece recargar                                             |
| Excepción en la simulación o el render                | El bucle se detiene y emite `engineError`, que el HUD convierte en panel de error (sin spam en consola ni pantalla congelada) |
| Error de React                                        | `ErrorBoundary` muestra una tarjeta con recarga en lugar de una página en blanco                                              |
| Pestaña oculta o pérdida de foco                      | Pausa automática y liberación de teclas para que la bola no caiga sola                                                        |
| Frame largo (lag, cambio de GPU, snapshot)            | El acumulador limita los pasos de recuperación por frame y descarta el resto                                                  |
| `prefers-reduced-motion`                              | Sin screen shake, confeti reducido y animaciones CSS desactivadas                                                             |
| JavaScript desactivado                                | Mensaje `<noscript>` con instrucciones                                                                                        |
| Móvil                                                 | `touch-action: none`, sin selección accidental, sin menú contextual al mantener pulsado y sin retardo de doble toque          |

### Observabilidad

- En desarrollo (`import.meta.env.DEV`) los fallos de motor y render se registran en consola
  con su fase (`update`/`render`). En producción solo se muestran al usuario, sin ruido.
- **Vercel Analytics + Speed Insights**: `src/main.tsx` monta los componentes `<Analytics />`
  y `<SpeedInsights />` (de `@vercel/analytics/react` y `@vercel/speed-insights/react`; al
  ser una SPA de Vite se usan los entry points `/react`, no los `/next`). Recogen visitas y
  métricas de rendimiento (Web Vitals) cuando el juego se despliega en Vercel; en cualquier
  otro hosting los scripts no cargan datos y el juego funciona igual.

## Licencia

Distribuido bajo licencia [MIT](LICENSE) — Copyright (c) 2026 Chienwei82.
