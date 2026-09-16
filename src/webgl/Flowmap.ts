import * as THREE from 'three';

const flowmapVertexShader = `
precision highp float;
attribute vec2 uv;
attribute vec3 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const flowmapFragmentShader = `
precision highp float;
uniform sampler2D tMap;
uniform float uFalloff;
uniform float uAlpha;
uniform float uDissipation;
uniform float uDeltaMult;
uniform float uOffset;
uniform float uAspect;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform vec2 uMouse2;
uniform vec2 uVelocity2;
uniform vec2 uPulsePos;
uniform float uPulseRadius;
uniform float uPulseStrength;
uniform sampler2D tNoise;
uniform float uTime;
varying vec2 vUv;

vec4 getStamp(vec2 velocity, vec2 mouse, float falloffScale, float alphaScale) {
  vec2 cursor = vUv - mouse;
  cursor.x *= uAspect;
  velocity *= 55.0;
  float speed = length(velocity);
  float mag = 1.0 - pow(1.0 - min(1.0, speed), 2.5);
  vec4 stamp = vec4(velocity, mag, 1.0);
  float d = length(cursor);
  float falloff = smoothstep(uFalloff * falloffScale, 0.0, d) * uAlpha * alphaScale;
  return stamp * falloff;
}

void main() {
  vec2 uv = vUv;
  uv.y += uOffset;

  // Fluid self-advection: curl the velocity field backwards along itself
  vec4 prevData = texture2D(tMap, uv);
  vec2 advectUv = uv - prevData.rg * 0.0038 * uDeltaMult;
  advectUv = clamp(advectUv, 0.001, 0.999);
  vec4 data = texture2D(tMap, advectUv);

  // Dissipation
  float friction = (1.0 / uDissipation) - 1.0;
  float dissipation = 1.0 / (1.0 + (uDeltaMult * friction));
  data *= dissipation;

  // Organic fluid micro-turbulence from noise texture
  vec2 noiseUv = (vUv * vec2(uAspect, 1.0)) * 0.4 + vec2(0.012, 0.015) * uTime;
  float noise = 0.2 + 0.8 * smoothstep(0.25, 0.9, texture2D(tNoise, noiseUv).g);

  vec2 noiseUv2 = (vUv * vec2(uAspect, 1.0)) * 0.85 + vec2(-0.009, 0.011) * uTime;
  float noise2 = 0.3 + 0.7 * smoothstep(0.3, 0.95, texture2D(tNoise, noiseUv2).g);

  // Primary cursor fluid stamp
  vec4 stamp1 = getStamp(uVelocity, uMouse, 1.0, 1.35);
  data += stamp1 * noise2 * uDeltaMult;

  // Secondary cursor fluid stamp (idle / delayed spring)
  vec4 stamp2 = getStamp(uVelocity2, uMouse2, 1.4, 0.8);
  stamp2.a = stamp2.b;
  data += stamp2 * noise * uDeltaMult * 0.75;

  // Concentric shockwave ripple pulse on click / tap
  if (uPulseStrength > 0.001) {
    vec2 pDist = vUv - uPulsePos;
    pDist.x *= uAspect;
    float dist = length(pDist);
    float ring = smoothstep(0.06, 0.0, abs(dist - uPulseRadius));
    vec2 ringVel = normalize(pDist + vec2(1e-5)) * ring * uPulseStrength * 0.4;
    data.rg += ringVel * uDeltaMult;
    data.b = min(1.0, data.b + ring * uPulseStrength * 0.85 * uDeltaMult);
    data.a = min(1.0, data.a + ring * uPulseStrength * uDeltaMult);
  }

  data = min(data, vec4(1.0));
  data.rgb = max(data.rgb, vec3(-1.0));

  gl_FragColor = data;
}
`;

export interface FlowmapOptions {
  size?: number;
  falloff?: number;
  alpha?: number;
  dissipation?: number;
  tNoise?: THREE.IUniform<THREE.Texture | null>;
  uTime?: THREE.IUniform<number>;
}

export class Flowmap {
  public uniform: { value: THREE.Texture | null } = { value: null };
  public aspect = 1;
  public mouse = new THREE.Vector2(0.5, 0.5);
  public velocity = new THREE.Vector2(0, 0);
  public mouse2 = new THREE.Vector2(0.5, 0.5);
  public velocity2 = new THREE.Vector2(0, 0);

  private renderer: THREE.WebGLRenderer;
  private camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
  private mask: {
    read: THREE.WebGLRenderTarget;
    write: THREE.WebGLRenderTarget;
    swap: () => void;
  };

  private pulsePos = new THREE.Vector2(0.5, 0.5);
  private pulseRadius = 0;
  private pulseStrength = 0;

  constructor(renderer: THREE.WebGLRenderer, options: FlowmapOptions = {}) {
    this.renderer = renderer;
    const size = options.size || 512;
    const falloff = options.falloff ?? 0.42;
    const alpha = options.alpha ?? 1.25;
    const dissipation = options.dissipation ?? 0.965;
    const tNoise = options.tNoise || { value: null };
    const uTime = options.uTime || { value: 0 };

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();

    const rtParams: THREE.RenderTargetOptions = {
      type: /(iPad|iPhone|iPod)/g.test(navigator.userAgent)
        ? THREE.HalfFloatType
        : THREE.FloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };

    const rt1 = new THREE.WebGLRenderTarget(size, size, rtParams);
    const rt2 = new THREE.WebGLRenderTarget(size, size, rtParams);

    const self = this;
    this.mask = {
      read: rt1,
      write: rt2,
      swap: () => {
        const temp = self.mask.read;
        self.mask.read = self.mask.write;
        self.mask.write = temp;
        self.uniform.value = self.mask.read.texture;
      },
    };
    this.uniform.value = this.mask.read.texture;

    // Fullscreen quad
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
        3
      )
    );
    geom.setAttribute(
      'uv',
      new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2)
    );

    const mat = new THREE.RawShaderMaterial({
      vertexShader: flowmapVertexShader,
      fragmentShader: flowmapFragmentShader,
      uniforms: {
        tMap: this.uniform,
        uFalloff: { value: falloff * 0.5 },
        uAlpha: { value: alpha },
        uDissipation: { value: dissipation },
        uDeltaMult: { value: 1.0 },
        uOffset: { value: 0 },
        uAspect: { value: 1.0 },
        uMouse: { value: this.mouse },
        uVelocity: { value: this.velocity },
        uMouse2: { value: this.mouse2 },
        uVelocity2: { value: this.velocity2 },
        uPulsePos: { value: this.pulsePos },
        uPulseRadius: { value: 0 },
        uPulseStrength: { value: 0 },
        tNoise: tNoise,
        uTime: uTime,
      },
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.mesh);
  }

  public triggerPulse(x: number, y: number, strength: number = 1.0) {
    this.pulsePos.set(x, y);
    this.pulseRadius = 0.01;
    this.pulseStrength = strength;
  }

  public setFalloff(val: number) {
    this.mesh.material.uniforms.uFalloff.value = val * 0.5;
  }

  public setDissipation(val: number) {
    this.mesh.material.uniforms.uDissipation.value = val;
  }

  public setAlpha(val: number) {
    this.mesh.material.uniforms.uAlpha.value = val;
  }

  public update(deltaSeconds: number = 0.016, offset: number = 0) {
    const deltaClamped = Math.min(deltaSeconds * 1000, 32) / 16;
    this.mesh.material.uniforms.uDeltaMult.value = deltaClamped;
    this.mesh.material.uniforms.uAspect.value = this.aspect;
    this.mesh.material.uniforms.uOffset.value = offset;

    // Animate shockwave ripple expansion
    if (this.pulseStrength > 0.001) {
      this.pulseRadius += deltaSeconds * 0.75;
      this.pulseStrength = Math.max(0, this.pulseStrength - deltaSeconds * 1.6);
      this.mesh.material.uniforms.uPulseRadius.value = this.pulseRadius;
      this.mesh.material.uniforms.uPulseStrength.value = this.pulseStrength;
    } else {
      this.mesh.material.uniforms.uPulseStrength.value = 0;
    }

    const currentRT = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.mask.write);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(currentRT);
    this.mask.swap();
  }

  public destroy() {
    this.mask.read.dispose();
    this.mask.write.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
