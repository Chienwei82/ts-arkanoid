// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  collectDeviceSignals,
  detectDevice,
  type DeviceSignals,
} from '../src/platform/DeviceDetector'

const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

const base: DeviceSignals = {
  coarsePointer: false,
  hoverNone: false,
  maxTouchPoints: 0,
  uaDataMobile: null,
  userAgent: DESKTOP_UA,
  platform: 'Linux x86_64',
  screenWidth: 1920,
  screenHeight: 1080,
}

const signals = (overrides: Partial<DeviceSignals> = {}): DeviceSignals => ({
  ...base,
  ...overrides,
})

const PHONE = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36',
  coarsePointer: true,
  hoverNone: true,
  maxTouchPoints: 5,
  screenWidth: 412,
  screenHeight: 915,
}

describe('detectDevice', () => {
  it('classifies a mouse-and-keyboard desktop with high confidence', () => {
    expect(detectDevice(signals())).toEqual({ kind: 'desktop', confidence: 'high', touch: false })
  })

  it('classifies an Android phone from its user agent', () => {
    expect(detectDevice(signals(PHONE))).toEqual({
      kind: 'mobile',
      confidence: 'high',
      touch: true,
    })
  })

  it('classifies an iPad and an Android tablet as tablets', () => {
    const ipad = detectDevice(
      signals({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0) Safari/605',
        coarsePointer: true,
        hoverNone: true,
        maxTouchPoints: 5,
        screenWidth: 820,
        screenHeight: 1180,
      }),
    )
    expect(ipad).toEqual({ kind: 'tablet', confidence: 'high', touch: true })

    const androidTablet = detectDevice(
      signals({
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/120 Safari/537.36',
        coarsePointer: true,
        hoverNone: true,
        maxTouchPoints: 5,
        screenWidth: 800,
        screenHeight: 1280,
      }),
    )
    expect(androidTablet).toEqual({ kind: 'tablet', confidence: 'high', touch: true })
  })

  it('detects iPadOS reporting itself as macOS through multi-touch', () => {
    const info = detectDevice(
      signals({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    )
    expect(info).toEqual({ kind: 'tablet', confidence: 'high', touch: true })
  })

  it('trusts userAgentData mobile hints over a desktop-looking UA', () => {
    const info = detectDevice(
      signals({
        uaDataMobile: true,
        userAgent: DESKTOP_UA,
        coarsePointer: true,
        hoverNone: true,
        screenWidth: 412,
        screenHeight: 915,
      }),
    )
    expect(info).toEqual({ kind: 'mobile', confidence: 'high', touch: true })
  })

  it('splits hint-less touch devices by screen size', () => {
    const phone = detectDevice(
      signals({
        userAgent: 'CustomBrowser/2.0',
        coarsePointer: true,
        hoverNone: true,
        maxTouchPoints: 5,
        screenWidth: 360,
        screenHeight: 800,
      }),
    )
    expect(phone.kind).toBe('mobile')

    const tablet = detectDevice(
      signals({
        userAgent: 'CustomBrowser/2.0',
        coarsePointer: true,
        hoverNone: true,
        maxTouchPoints: 5,
        screenWidth: 1280,
        screenHeight: 800,
      }),
    )
    expect(tablet.kind).toBe('tablet')
  })

  it('flags touch laptops as ambiguous desktops', () => {
    const info = detectDevice(signals({ maxTouchPoints: 10 }))
    expect(info).toEqual({ kind: 'desktop', confidence: 'low', touch: true })
  })

  it('flags tablets using a mouse or keyboard as ambiguous', () => {
    const info = detectDevice(
      signals({
        maxTouchPoints: 5,
        screenWidth: 1024,
        screenHeight: 768,
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      }),
    )
    expect(info.confidence).toBe('low')
    expect(info.touch).toBe(true)
  })

  it('degrades to low confidence when nothing can be sensed', () => {
    const info = detectDevice(
      signals({ userAgent: '', platform: '', screenWidth: 0, screenHeight: 0 }),
    )
    expect(info).toEqual({ kind: 'desktop', confidence: 'low', touch: false })
  })

  it('treats a coarse pointer without touch points as ambiguous', () => {
    const info = detectDevice(signals({ coarsePointer: true }))
    expect(info.confidence).toBe('low')
  })
})

describe('collectDeviceSignals', () => {
  it('returns a complete signal snapshot without throwing', () => {
    const snapshot = collectDeviceSignals()
    expect(typeof snapshot.coarsePointer).toBe('boolean')
    expect(typeof snapshot.hoverNone).toBe('boolean')
    expect(typeof snapshot.maxTouchPoints).toBe('number')
    expect(typeof snapshot.userAgent).toBe('string')
  })
})
