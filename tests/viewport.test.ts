// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViewportManager, type ViewportSize } from '../src/platform/ViewportManager'

const sizedHost = (width: number, height: number): HTMLElement => {
  const element = document.createElement('div')
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true })
  return element
}

const resizeHost = (element: HTMLElement, width: number, height: number): void => {
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true })
}

const stubDevicePixelRatio = (value: number): void => {
  Object.defineProperty(globalThis, 'devicePixelRatio', { value, configurable: true })
}

/** Minimal EventTarget stand-in for window.visualViewport. */
const stubVisualViewport = (): EventTarget => {
  const target = new EventTarget()
  Object.defineProperty(globalThis.window, 'visualViewport', {
    value: target,
    configurable: true,
  })
  return target
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ViewportManager', () => {
  it('measures the host on attach and caps the pixel ratio', () => {
    stubDevicePixelRatio(3)
    const sizes: ViewportSize[] = []
    const manager = new ViewportManager(sizedHost(800, 600), (size) => sizes.push(size), {
      maxPixelRatio: 2,
    })

    manager.attach()
    expect(sizes).toEqual([{ width: 800, height: 600, pixelRatio: 2 }])
    manager.dispose()
  })

  it('re-measures on window resize and only reports actual changes', () => {
    stubDevicePixelRatio(1)
    const host = sizedHost(800, 600)
    const listener = vi.fn<(size: ViewportSize) => void>()
    const manager = new ViewportManager(host, listener)
    manager.attach()
    listener.mockClear()

    resizeHost(host, 1024, 768)
    globalThis.dispatchEvent(new Event('resize'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith({ width: 1024, height: 768, pixelRatio: 1 })

    globalThis.dispatchEvent(new Event('resize'))
    expect(listener).toHaveBeenCalledTimes(1)
    manager.dispose()
  })

  it('re-measures on orientation changes and visualViewport events', () => {
    const host = sizedHost(800, 600)
    const visualViewport = stubVisualViewport()
    const listener = vi.fn<(size: ViewportSize) => void>()
    const manager = new ViewportManager(host, listener)
    manager.attach()
    listener.mockClear()

    resizeHost(host, 600, 800)
    globalThis.dispatchEvent(new Event('orientationchange'))
    expect(listener).toHaveBeenCalledTimes(1)

    resizeHost(host, 600, 700)
    visualViewport.dispatchEvent(new Event('resize'))
    expect(listener).toHaveBeenCalledTimes(2)

    manager.dispose()
    resizeHost(host, 500, 500)
    visualViewport.dispatchEvent(new Event('scroll'))
    globalThis.dispatchEvent(new Event('resize'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('ignores a second attach and keeps working after dispose guards', () => {
    const host = sizedHost(400, 300)
    const listener = vi.fn<(size: ViewportSize) => void>()
    const manager = new ViewportManager(host, listener)

    manager.attach()
    manager.attach()
    expect(listener).toHaveBeenCalledTimes(1)
    manager.dispose()
    manager.dispose()
  })
})
