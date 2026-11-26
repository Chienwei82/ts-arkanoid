import { Color, Vector2, type Camera, type Scene, type Texture, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RENDER } from '../config/gameConfig'
import type { WarpSample } from './warp'

/** A warp channel below this reads as "off" for pass-skipping purposes. */
const WARP_EPSILON = 0.003

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Vignette plus signal grain. The grade pass reinforces the arcade cabinet:
 * darkened deckled edges, faint scanlines and a whisper of static, all applied
 * before tone mapping.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float vignette;
  uniform float grain;
  uniform float scanlines;
  uniform vec2 resolution;
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec4 colour = texture2D(tDiffuse, vUv);
    float radius = length(vUv - 0.5) * 1.41421356;
    float vig = smoothstep(1.0, 0.35, radius);
    colour.rgb *= mix(1.0 - vignette, 1.0, vig);
    float scan = 1.0 - scanlines * (0.5 + 0.5 * sin(vUv.y * resolution.y * 3.14159));
    colour.rgb *= scan;
    colour.rgb += (hash(vUv * resolution + time) - 0.5) * grain;
    gl_FragColor = colour;
  }
`

interface GradeUniforms {
  tDiffuse: { value: Texture | null }
  vignette: { value: number }
  grain: { value: number }
  scanlines: { value: number }
  resolution: { value: Vector2 }
  time: { value: number }
}

/**
 * Hyperspace jump: a radial multi-sample smear drags the lights out into
 * streaks while a chromatic split and a thin radiating speed-line overlay
 * sell the acceleration, finished with a white flash on jump take-off and
 * arrival. Every channel is 0..1 and comes from `rendering/warp.ts`.
 */
const WARP_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float warp;
  uniform float streaks;
  uniform float aberration;
  uniform float flash;
  uniform float time;
  uniform vec2 aspect;
  uniform vec3 tint;
  varying vec2 vUv;

  const int SAMPLES = 12;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 dir = (vUv - 0.5) * aspect;
    float dist = length(dir);
    vec2 radial = dist > 0.0001 ? dir / dist : vec2(0.0);
    vec3 colour = texture2D(tDiffuse, vUv).rgb;

    // Radial smear: every sample pulls towards the centre, so stars and neon
    // stretch outwards into hyperspace streaks. warp = 0 leaves the frame as is.
    vec3 smeared = vec3(0.0);
    float weightSum = 0.0;
    for (int i = 0; i < SAMPLES; i += 1) {
      float f = float(i) / float(SAMPLES - 1);
      float weight = 1.0 - f * 0.55;
      vec2 uv = vUv - radial * pow(f + 0.08, 1.7) * warp * dist * 0.55 / aspect;
      smeared += texture2D(tDiffuse, uv).rgb * weight;
      weightSum += weight;
    }
    smeared /= weightSum;
    colour = mix(colour, smeared, clamp(warp * 1.8, 0.0, 1.0));

    // Chromatic split widens towards the rim as the jump accelerates.
    float split = aberration * dist * 0.035;
    vec3 shifted = vec3(
      texture2D(tDiffuse, vUv - radial * split / aspect).r,
      colour.g,
      texture2D(tDiffuse, vUv + radial * split / aspect).b
    );
    colour = mix(colour, shifted, clamp(aberration * 1.4, 0.0, 1.0));

    // Speed lines radiating from the centre and kept off the playfield, so
    // the board stays readable; every line owns its phase and travel speed.
    if (streaks > 0.001) {
      float rim = smoothstep(0.08, 0.45, dist);
      float angle = atan(dir.y, dir.x);
      float sector = floor(angle * 40.0);
      float phase = hash(vec2(sector, 7.0)) * 6.28318;
      float gate = smoothstep(0.28, 0.6, hash(vec2(sector, 13.0)));
      float ray = pow(0.5 + 0.5 * sin(angle * 160.0 + phase), 9.0);
      float travel = pow(0.5 + 0.5 * sin(dist * 60.0 - time * 34.0 + phase), 3.0);
      colour += tint * streaks * ray * travel * gate * rim * 0.9;
    }

    // Jump flash: a white wash biased towards the centre, gone in a blink.
    colour += vec3(1.0) * flash * (0.45 + 0.55 * (1.0 - smoothstep(0.0, 0.85, dist)));

    gl_FragColor = vec4(colour, 1.0);
  }
`

/** Post-processing chain: render, optional bloom, warp, grade, output. */
export class PostFX {
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass | null
  private readonly grade: ShaderPass
  private readonly warp: ShaderPass
  private uniforms: GradeUniforms

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, bloomEnabled = true) {
    this.uniforms = {
      tDiffuse: { value: null },
      vignette: { value: RENDER.vignette },
      grain: { value: RENDER.grain },
      scanlines: { value: RENDER.scanlines },
      resolution: { value: new Vector2(1, 1) },
      time: { value: 0 },
    }

    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    // Bloom is the expensive pass; the reduced-quality preset drops it.
    this.bloom = bloomEnabled
      ? new UnrealBloomPass(
          new Vector2(1, 1),
          RENDER.bloom.strength,
          RENDER.bloom.radius,
          RENDER.bloom.threshold,
        )
      : null
    if (this.bloom !== null) this.composer.addPass(this.bloom)

    // The jump sits between bloom and the grade: streaks smear the lights
    // that have already bloomed, then the cabinet finish closes the chain.
    this.warp = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        warp: { value: 0 },
        streaks: { value: 0 },
        aberration: { value: 0 },
        flash: { value: 0 },
        time: { value: 0 },
        aspect: { value: new Vector2(1, 1) },
        tint: { value: new Color(0xffffff) },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: WARP_FRAGMENT_SHADER,
    })
    this.warp.enabled = false
    this.composer.addPass(this.warp)

    this.grade = new ShaderPass({
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    })
    this.composer.addPass(this.grade)

    // ShaderPass clones the uniforms object it receives, so any runtime change
    // must target the live copy the material reads — otherwise the vignette
    // pulse and the grain drift would silently no-op.
    this.uniforms = this.grade.uniforms as unknown as GradeUniforms

    // OutputPass owns tone mapping + colour space conversion for the whole chain.
    this.composer.addPass(new OutputPass())
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio)
    ;(this.warp.uniforms.aspect.value as Vector2).set(Math.max(width / height, 0.001), 1)
  }

  /** Ajusta la intensidad del bloom en tiempo real (más espectáculo en celebraciones). */
  setBloom(strength: number): void {
    if (this.bloom !== null) this.bloom.strength = strength
  }

  /** Ajusta la intensidad de la viñeta (más cerrada en momentos de tensión). */
  setVignette(amount: number): void {
    this.uniforms.vignette.value = amount
  }

  /**
   * Drives the hyperspace pass with a frame of the jump timeline; `null`
   * disables the pass entirely, so idle frames cost nothing.
   */
  setWarp(sample: WarpSample | null): void {
    const uniforms = this.warp.uniforms
    if (sample === null) {
      if (this.warp.enabled) {
        this.warp.enabled = false
        uniforms.warp.value = 0
        uniforms.streaks.value = 0
        uniforms.aberration.value = 0
        uniforms.flash.value = 0
      }
      return
    }
    uniforms.warp.value = sample.warp
    uniforms.streaks.value = sample.streaks
    uniforms.aberration.value = sample.aberration
    uniforms.flash.value = sample.flash
    this.warp.enabled =
      sample.warp > WARP_EPSILON ||
      sample.streaks > WARP_EPSILON ||
      sample.aberration > WARP_EPSILON ||
      sample.flash > WARP_EPSILON
  }

  /** Retints the speed lines with the accent of the sector being reached. */
  setWarpTint(colour: Color): void {
    ;(this.warp.uniforms.tint.value as Color).copy(colour)
  }

  render(dt: number): void {
    this.uniforms.time.value += dt
    this.warp.uniforms.time.value += dt
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
    this.bloom?.dispose()
    this.grade.dispose()
    this.warp.dispose()
  }
}
