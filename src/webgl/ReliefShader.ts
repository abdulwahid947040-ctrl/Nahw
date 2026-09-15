export const reliefVertexShader = `
precision highp float;

uniform sampler2D tFlow;
uniform sampler2D tMaskNoise;
uniform float uTime;
uniform float uAspect;
uniform float uScreenScroll;
uniform float uScrollSpeed;
uniform float uFastScroll;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vEye;
varying float vExtrude;
varying vec2 vScreenUv;

void main() {
  vUv = uv;
  vPos = position;
  vNormal = normalize(normalMatrix * normal);

  vec4 pos = vec4(position, 1.0);
  vec4 ndc = projectionMatrix * modelViewMatrix * pos;
  vec2 uvScreen = (ndc.xy / ndc.w + 1.0) * 0.5;
  vScreenUv = uvScreen;

  // Fluid flow sampling for true 3D physical relief extrusion
  vec4 flow = texture2D(tFlow, uvScreen);
  float extrude = mix(flow.b, flow.a, 0.55);
  vExtrude = extrude;

  // Physically extrude the sculpted relief where swept by fluid!
  pos.z += extrude * 1.5 * uOpacity;
  pos.xy *= 1.001;

  vec4 mvPos = modelViewMatrix * pos;
  vEye = mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
`;

export const reliefFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D tMaskNoise;
uniform sampler2D tFlow;
uniform sampler2D tBake1;
uniform sampler2D tBake2;
uniform sampler2D tPlaster;
uniform float uScreenScroll;
uniform float uTextureStrength;
uniform float uGradientStrength;
uniform float uOpacity;
uniform float uBrightnessFactor;
uniform float uBrightnessOffset;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vEye;
varying float vExtrude;
varying vec2 vScreenUv;

vec4 decodeSRGB(in vec4 value) {
  return vec4(
    mix(
      pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055),
      value.rgb * 12.92,
      vec3(lessThanEqual(value.rgb, vec3(0.0031308)))
    ),
    value.a
  );
}

void main() {
  vec2 uvScreen = gl_FragCoord.xy / uResolution;
  vec4 flow = texture2D(tFlow, uvScreen) * 2.0;
  float extrude = mix(flow.b, flow.a, 0.55);

  // Screen-space wave gradient for wet surface normals
  vec2 eps = 2.0 / uResolution;
  vec4 flowR = texture2D(tFlow, uvScreen + vec2(eps.x, 0.0));
  vec4 flowL = texture2D(tFlow, uvScreen - vec2(eps.x, 0.0));
  vec4 flowT = texture2D(tFlow, uvScreen + vec2(0.0, eps.y));
  vec4 flowB = texture2D(tFlow, uvScreen - vec2(0.0, eps.y));
  vec2 flowGrad = vec2(flowR.b - flowL.b, flowT.b - flowB.b);
  float fluidSlope = length(flowGrad);

  // 1. Unpack multi-level baked relief height maps (level0..level5)
  vec3 bake1 = decodeSRGB(texture2D(tBake1, vUv)).rgb;
  vec3 bake2 = decodeSRGB(texture2D(tBake2, vUv)).rgb;

  float level0 = bake2.b;
  float level1 = bake2.g;
  float level2 = bake2.r;
  float level3 = bake1.b;
  float level4 = bake1.g;
  float level5 = bake1.r;

  // Baseline 3D sculpture depth - prominent, clean, and crisp even without fluid
  float baseSculpture = max(level0, max(level1 * 0.95, max(level2 * 0.9, max(level3 * 0.85, level4 * 0.75))));
  if (baseSculpture < 0.02) {
    baseSculpture = (level0 + level1 + level2 + level3 + level4 + level5) * 0.45;
  }
  if (baseSculpture < 0.01) {
    baseSculpture = 0.52; // neutral plaster default
  }

  // Fluid extrusion gently lifts and sharpens the carved features
  float o = baseSculpture;
  o = mix(o, max(o, level1), smoothstep(0.0, 0.22, extrude));
  o = mix(o, max(o, level2), smoothstep(0.2, 0.44, extrude));
  o = mix(o, max(o, level3), smoothstep(0.4, 0.66, extrude));
  o = mix(o, max(o, level4), smoothstep(0.6, 0.88, extrude));
  o = mix(o, max(o, level5), smoothstep(0.8, 1.00, extrude));

  // 2. True geometric surface normal in eye space from screen-space derivatives
  vec3 dFdxPos = dFdx(vEye);
  vec3 dFdyPos = dFdy(vEye);
  vec3 geomNormal = normalize(cross(dFdxPos, dFdyPos));

  // Dark cinematic chiaroscuro lighting on the 3D relief with deep pink ambient environment
  vec3 keyLightDir  = normalize(vec3(0.42, 0.72, 0.85));
  vec3 fillLightDir = normalize(vec3(-0.48, 0.15, 0.65));
  vec3 viewDir      = normalize(-vEye);

  float keyDiffuse  = max(0.0, dot(geomNormal, keyLightDir));
  float fillDiffuse = max(0.0, dot(geomNormal, fillLightDir));

  // Deep, dark cinematic stone tone curve with dark rose undertones (rich shadows & high contrast)
  vec3 deepCrevice = vec3(0.04, 0.02, 0.04);
  vec3 midStone    = vec3(0.22, 0.10, 0.17);
  vec3 litStone    = vec3(0.56, 0.30, 0.42);

  // Dark cinematic ambient pink environment color
  vec3 ambientPink = vec3(0.26, 0.07, 0.16);

  // Blend stone tone based on sculptural relief depth 'o' and diffuse shading
  float lightTerm = 0.16 + keyDiffuse * 0.72 + fillDiffuse * 0.22;
  float ao = smoothstep(0.04, 0.68, o);
  vec3 stoneColor = mix(deepCrevice, midStone, smoothstep(0.06, 0.45, o));
  stoneColor = mix(stoneColor, litStone, smoothstep(0.40, 0.90, o));
  stoneColor *= lightTerm * (0.35 + ao * 0.65);
  stoneColor += ambientPink * (0.28 + 0.38 * fillDiffuse);

  // Tactile limestone plaster micro-texture
  vec2 uvPlaster = vPos.xy * 0.15;
  float plaster = texture2D(tPlaster, uvPlaster).g;
  stoneColor = mix(stoneColor, stoneColor * (0.76 + plaster * 0.42), uTextureStrength);

  // Soft architectural vignette from center
  float vignette = mix(1.0, 0.68, length(uvScreen - vec2(0.5, 0.5)));
  stoneColor *= vignette;

  // --- THE FLUID OVERLAY: PURE LIGHTNESS THEME (Does NOT affect base stone material) ---
  // Perturb surface normal strictly for fluid water reflections & caustics
  vec3 waterNormal = normalize(geomNormal + vec3(flowGrad * 3.6, 0.0));

  float fluidIntensity = smoothstep(0.015, 0.65, flow.b);
  float fluidVelocity = length(flow.rg);

  // 1. Crisp Blinn-Phong specular glints on wave crests (clear water catching light)
  vec3 halfDir = normalize(keyLightDir + viewDir);
  float specKey = pow(max(0.0, dot(waterNormal, halfDir)), 36.0);
  
  vec3 halfDirFill = normalize(fillLightDir + viewDir);
  float specFill = pow(max(0.0, dot(waterNormal, halfDirFill)), 20.0) * 0.45;

  // 2. Delicate caustic light ripples tracing fluid currents
  vec2 causticUv = uvScreen * 34.0 + flow.rg * 4.5 + vec2(uTime * 0.025);
  float caustic = sin(causticUv.x + sin(causticUv.y * 1.5)) * 0.5 + 0.5;
  caustic = pow(caustic, 4.5); // sharp, silky crest of pure light

  // 3. Glancing water surface Fresnel lightness
  float fresnel = 1.0 - max(0.0, dot(waterNormal, viewDir));
  fresnel = pow(fresnel, 3.6);

  // 4. Subtle, calm fluid wave refraction - touch responds smoothly without enormous blinding glow
  float waterLightness = 0.0;
  waterLightness += (specKey * 0.18 + specFill * 0.10) * fluidIntensity;
  waterLightness += caustic * fluidIntensity * 0.05;
  waterLightness += fluidSlope * 0.25 * fluidIntensity;
  waterLightness += fresnel * fluidIntensity * 0.12;

  vec3 fluidLight = vec3(waterLightness);

  // Overlap subtle liquid wave onto stone: deep, dark, comfortable for reading
  vec3 finalColor = stoneColor + fluidLight;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;
