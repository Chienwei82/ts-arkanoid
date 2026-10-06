/**
 * Device classification used for the control scheme and rendering quality.
 * Detection runs over an injected signal snapshot so it is pure and testable,
 * and ambiguous hardware degrades to low confidence instead of guessing
 * silently — the UI then asks the player instead of choosing wrong.
 */

export type DeviceKind = 'desktop' | 'mobile' | 'tablet'
export type DetectionConfidence = 'high' | 'low'

export interface DeviceInfo {
  readonly kind: DeviceKind
  readonly confidence: DetectionConfidence
  /** True when the device is operated through a touchscreen. */
  readonly touch: boolean
}

/** Snapshot of the ambient signals detection reads; injectable for tests. */
export interface DeviceSignals {
  readonly coarsePointer: boolean
  readonly hoverNone: boolean
  readonly maxTouchPoints: number
  /** `navigator.userAgentData?.mobile`, null where unsupported. */
  readonly uaDataMobile: boolean | null
  readonly userAgent: string
  readonly platform: string
  readonly screenWidth: number
  readonly screenHeight: number
}

interface UADataLike {
  readonly mobile?: boolean
}

interface UANavigator extends Navigator {
  readonly userAgentData?: UADataLike
}

/** Shortest screen side (CSS px) at which a touch device counts as a tablet. */
const TABLET_MIN_SIDE = 600

const UA_MOBILE = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|webOS/i
const UA_TABLET = /iPad|Tablet|PlayBook|Silk|Kindle/i

const matchMedia = (query: string): boolean => {
  try {
    return globalThis.matchMedia?.(query).matches ?? false
  } catch {
    // Broken matchMedia implementations must not break start-up.
    return false
  }
}

export const collectDeviceSignals = (): DeviceSignals => {
  const nav = globalThis.navigator as UANavigator | undefined
  const screen = globalThis.screen
  return {
    coarsePointer: matchMedia('(pointer: coarse)'),
    hoverNone: matchMedia('(hover: none)'),
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    uaDataMobile: nav?.userAgentData?.mobile ?? null,
    userAgent: nav?.userAgent ?? '',
    platform: nav?.platform ?? '',
    screenWidth: screen?.width ?? 0,
    screenHeight: screen?.height ?? 0,
  }
}

export const detectDevice = (signals: DeviceSignals): DeviceInfo => {
  const { coarsePointer, hoverNone, maxTouchPoints, uaDataMobile, userAgent, platform } = signals
  const touch = maxTouchPoints > 0 || coarsePointer
  const tabletScreen = Math.min(signals.screenWidth, signals.screenHeight) >= TABLET_MIN_SIDE

  // iPadOS 13+ masquerades as macOS while keeping multi-touch.
  if (/Mac/i.test(`${userAgent} ${platform}`) && maxTouchPoints > 1) {
    return { kind: 'tablet', confidence: 'high', touch: true }
  }

  if (uaDataMobile === true) {
    return { kind: tabletScreen ? 'tablet' : 'mobile', confidence: 'high', touch: true }
  }
  if (UA_MOBILE.test(userAgent)) return { kind: 'mobile', confidence: 'high', touch: true }
  if (UA_TABLET.test(userAgent) || (/Android/i.test(userAgent) && !UA_MOBILE.test(userAgent))) {
    return { kind: 'tablet', confidence: 'high', touch: true }
  }

  const hasSignals = coarsePointer || hoverNone || maxTouchPoints > 0 || userAgent !== ''
  if (!hasSignals) {
    // Nothing to go on (headless hosts, locked-down WebViews): ask the player.
    return { kind: 'desktop', confidence: 'low', touch: false }
  }

  // Pointer heuristics for browsers whose UA carries no device hint.
  const touchFirst = coarsePointer && hoverNone
  if (touchFirst && maxTouchPoints > 0) {
    return { kind: tabletScreen ? 'tablet' : 'mobile', confidence: 'high', touch: true }
  }
  const pointerFirst = !coarsePointer && !hoverNone
  if (pointerFirst && !touch) return { kind: 'desktop', confidence: 'high', touch: false }

  // Ambiguous hardware: touch laptops, tablets with a mouse or keyboard, or
  // conflicting signals. Guess towards the input style but stay low confidence.
  return {
    kind: pointerFirst || !touch ? 'desktop' : tabletScreen ? 'tablet' : 'mobile',
    confidence: 'low',
    touch,
  }
}
