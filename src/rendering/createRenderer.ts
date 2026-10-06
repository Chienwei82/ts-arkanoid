import { QUALITY, type QualityConfig } from '../config/gameConfig'
import type { RendererFactory } from '../core/renderer'
import { collectDeviceSignals, detectDevice, type DeviceInfo } from '../platform/DeviceDetector'
import { CraftGameRenderer } from './CraftGameRenderer'

/**
 * Rendering quality policy: phones render with the reduced preset (no
 * antialias/bloom, tighter pixel ratio) while tablets and desktops get the full
 * papercraft treatment.
 */
export const selectQuality = (device: DeviceInfo): QualityConfig =>
  device.kind === 'mobile' ? QUALITY.low : QUALITY.high

/**
 * Renderer factory handed to the engine at start-up. Keeping it here means the
 * core only ever sees the GameRenderer interface.
 */
export const createGameRenderer: RendererFactory = (container, bus) =>
  new CraftGameRenderer(container, bus, selectQuality(detectDevice(collectDeviceSignals())))
