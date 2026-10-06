import { Vector2, type Camera, type Scene, type Texture, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RENDER } from '../config/gameConfig'

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Vignette plus paper grain. Chromatic aberration belongs to a neon look, so the
 * grade pass reinforces the craft material instead: darkened deckled edges and a
 * faint printed-texture noise, both applied before tone mapping.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float vignette;
  uniform float grain;
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
    colour.rgb += (hash(vUv * resolution + time) - 0.5) * grain;
    gl_FragColor = colour;
  }
`

interface GradeUniforms {
  tDiffuse: { value: Texture | null }
  vignette: { value: number }
  grain: { value: number }
  resolution: { value: Vector2 }
  time: { value: number }
}

/** Post-processing chain: render, bloom, grade, output. */
export class PostFX {
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly grade: ShaderPass
  private readonly uniforms: GradeUniforms

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    this.uniforms = {
      tDiffuse: { value: null },
      vignette: { value: RENDER.vignette },
      grain: { value: RENDER.grain },
      resolution: { value: new Vector2(1, 1) },
      time: { value: 0 },
    }

    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      RENDER.bloom.strength,
      RENDER.bloom.radius,
      RENDER.bloom.threshold,
    )
    this.composer.addPass(this.bloom)

    this.grade = new ShaderPass({
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    })
    this.composer.addPass(this.grade)

    // OutputPass owns tone mapping + colour space conversion for the whole chain.
    this.composer.addPass(new OutputPass())
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio)
  }

  render(dt: number): void {
    this.uniforms.time.value += dt
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
    this.bloom.dispose()
    this.grade.dispose()
  }
}
