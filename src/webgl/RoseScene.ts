import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { NAHW_DEMO_TOPICS, NahwDemoTopic } from '../data/nahwTopics';

export type RosePhase = 'sprouting' | 'blooming' | 'exploding' | 'blackout' | 'path';

interface PetalData {
  mesh: THREE.Mesh;
  layer: number;
  budPos: THREE.Vector3;
  budRot: THREE.Euler;
  budScale: THREE.Vector3;
  bloomPos: THREE.Vector3;
  bloomRot: THREE.Euler;
  bloomScale: THREE.Vector3;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  scatterPos: THREE.Vector3;
  scatterRot: THREE.Euler;
  turbulenceSeed: number;
}

interface PathPetal {
  mesh: THREE.Mesh;
  topic: NahwDemoTopic;
  t: number;
}

/**
 * Builds one botanical rose-petal surface: a rounded obovate outline (no
 * sharp point at the tip — real rose petals end in a soft curved edge, not
 * a cone), a transverse cupped bowl, a gently reflexed rim, and a soft
 * central vein — with a base-to-tip vertex-color gradient baked in.
 * `asymmetry` biases the outline and ruffle phase per call so no two
 * petals from the same layer are identical stamped clones.
 */
function createRealisticPetalGeometry(
  width: number,
  length: number,
  cupping: number,
  reflexCurl: number,
  baseColor: THREE.Color,
  tipColor: THREE.Color,
  asymmetry: number = 0
): THREE.BufferGeometry {
  const segmentsU = 26;
  const segmentsV = 30;
  const geom = new THREE.PlaneGeometry(width, length, segmentsU, segmentsV);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ruffleSeed = asymmetry * 7.3;

  for (let i = 0; i < pos.count; i++) {
    const rawU = Math.max(-1.0, Math.min(1.0, pos.getX(i) / (width * 0.5)));
    const rawV = (pos.getY(i) + length * 0.5) / length;
    const v = Math.max(0.0, Math.min(1.0, rawV));

    const skewedU = rawU + asymmetry * 0.1 * Math.sin(v * Math.PI);

    // Rounded obovate outline: narrow claw at the base (v=0), a full-width
    // belly through the middle, then a rounded dome cap at the tip (v=1) —
    // NOT a taper back down to a point, which is what produces a kite/
    // diamond silhouette. The dome follows a circular arc (sqrt profile)
    // so the tip visually rounds off instead of coming to a cone point.
    const baseRamp = THREE.MathUtils.smoothstep(v, 0.0, 0.16);
    const capT = THREE.MathUtils.clamp((v - 0.66) / (1.0 - 0.66), 0, 1);
    const domeProfile = Math.sqrt(Math.max(0.0, 1.0 - capT * capT));
    const profile = baseRamp * domeProfile;

    const edgeWave =
      Math.sin(v * 13.0 + ruffleSeed) * Math.cos(rawU * 2.6 + ruffleSeed * 0.5) * (0.035 * Math.abs(rawU));

    const newX = skewedU * (width * 0.5) * profile + edgeWave;
    const newY = pos.getY(i) + length * 0.5;

    const cupBowl = -Math.cos(rawU * Math.PI * 0.5) * cupping * Math.sin(v * Math.PI);
    const reflex = Math.pow(v, 2.4) * reflexCurl;
    const centralVein = -Math.exp(-rawU * rawU * 12.0) * 0.04 * v;
    const newZ = cupBowl + reflex + centralVein;

    pos.setXYZ(i, newX, newY, newZ);

    const c = new THREE.Color().lerpColors(baseColor, tipColor, Math.pow(v, 0.85));
    const edgeDarken = 1.0 - Math.abs(rawU) * 0.1;
    colors[i * 3] = c.r * edgeDarken;
    colors[i * 3 + 1] = c.g * edgeDarken;
    colors[i * 3 + 2] = c.b * edgeDarken;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Procedural Mughal-arch colonnade panel: a sandstone wall slab with a
 * rounded ogee archway cut through it, extruded to a slab depth — the
 * repeating unit that lines the courtyard walkway (reference: the AI
 * garden images' arch colonnade flanking a reflecting pool).
 */
function createArchPanelGeometry(width: number, height: number): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-width / 2, 0);
  outer.lineTo(width / 2, 0);
  outer.lineTo(width / 2, height);
  outer.lineTo(-width / 2, height);
  outer.lineTo(-width / 2, 0);

  const archWidth = width * 0.6;
  const springHeight = height * 0.5;
  const apexHeight = height * 0.92;

  const hole = new THREE.Path();
  hole.moveTo(-archWidth / 2, 0);
  hole.lineTo(-archWidth / 2, springHeight);
  hole.quadraticCurveTo(-archWidth / 2, apexHeight, 0, apexHeight);
  hole.quadraticCurveTo(archWidth / 2, apexHeight, archWidth / 2, springHeight);
  hole.lineTo(archWidth / 2, 0);
  hole.lineTo(-archWidth / 2, 0);
  outer.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(outer, { depth: 0.45, bevelEnabled: false, curveSegments: 20 });
  geom.center();
  return geom;
}

export class RoseScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private clock: THREE.Clock;
  private animFrameId: number | null = null;
  private isDisposed: boolean = false;

  private windStrength: number = 0;

  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private roseBloomLight!: THREE.PointLight;
  private godrayMesh!: THREE.Mesh;

  // Mughal courtyard: reflecting pool + sandstone arch colonnade + rose
  // hedges lining the walkway, matching the reference AI garden images.
  private courtyardGroup: THREE.Group = new THREE.Group();
  private reflectorPool!: Reflector;

  private earthGroup: THREE.Group = new THREE.Group();
  private stemGroup: THREE.Group = new THREE.Group();
  private stemMesh!: THREE.Mesh;
  private leavesGroup: THREE.Group = new THREE.Group();
  private sepalsGroup: THREE.Group = new THREE.Group();
  private flowerGroup: THREE.Group = new THREE.Group();
  private fallenPetalsGroup: THREE.Group = new THREE.Group();
  private petals: PetalData[] = [];
  private floatingDust!: THREE.Points;
  private starfield!: THREE.Points;
  private starfieldMat!: THREE.PointsMaterial;

  private stormMesh!: THREE.InstancedMesh;
  private stormCount = 220;
  private stormData: {
    active: boolean;
    spawnDelay: number;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    rot: THREE.Euler;
    rotVel: THREE.Euler;
    scale: number;
    seed: number;
  }[] = [];
  private readonly dummy = new THREE.Object3D();

  public readonly flowerHeight = 2.15;

  // Final scene: real rose petals laid along a winding ground path — the
  // reader scrubs (drag/scroll) along the trail; the nearest petal to the
  // current position enlarges and glows, tapping it opens that topic.
  private pathGroup: THREE.Group = new THREE.Group();
  private pathCurve!: THREE.CatmullRomCurve3;
  private pathPetals: PathPetal[] = [];
  private pathT: number = 0;
  private pathTargetT: number = 0;
  private pathFocusIndex: number = -1;
  private pathRaycaster = new THREE.Raycaster();
  public onPathFocusChange?: (index: number) => void;

  public currentPhase: RosePhase = 'sprouting';
  private sequenceTime: number = 0;
  public onPhaseChange?: (phase: RosePhase) => void;
  public onExplode?: () => void;
  public onBlackout?: () => void;

  private mouseTarget = new THREE.Vector2(0, 0);
  private mouseCurrent = new THREE.Vector2(0, 0);

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0704, 0.028);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    this.camera.position.set(0, this.flowerHeight + 1.4, 6.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0704, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.38, 0.4, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.setupLighting();
    this.createMughalCourtyard();
    this.createGodrayBeam();
    this.createSoilAndFallenPetals();
    this.createBotanicalStemAndLeaves();
    this.createBotanicalRosePetals();
    this.createPetalStorm();
    this.createAtmosphericGlowDust();
    this.createStarfield();
    this.createTopicPath();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });

    this.animate();
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x1e1208, 0.65);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffdca8, 3.0);
    this.keyLight.position.set(0.6, 8.0, 4.0);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xff7a3d, 1.8);
    this.rimLight.position.set(-3.5, 3.5, -3.2);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0x2a1810, 0.9);
    this.fillLight.position.set(-2.5, -0.5, 2.5);
    this.scene.add(this.fillLight);

    this.roseBloomLight = new THREE.PointLight(0xff5a2e, 1.8, 4.0);
    this.roseBloomLight.position.set(0, this.flowerHeight, 0);
    this.scene.add(this.roseBloomLight);
  }

  /**
   * Mughal garden courtyard matching the AI reference images: a long
   * reflecting pool down the central axis, flanked by sandstone arch
   * colonnades receding into a soft haze, rose hedges lining the walkway,
   * and a distant domed pavilion closing the vista.
   */
  private createMughalCourtyard() {
    this.courtyardGroup = new THREE.Group();
    const sandstone = new THREE.MeshStandardMaterial({ color: 0xcbaa78, roughness: 0.82, metalness: 0.03 });

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xa8895e, roughness: 0.88 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 55), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -18);
    this.courtyardGroup.add(floor);

    // Reflecting pool: a real mirror surface, matching the reference photos.
    const poolGeom = new THREE.PlaneGeometry(3.6, 38);
    this.reflectorPool = new Reflector(poolGeom, {
      color: 0x8fa89f,
      textureWidth: 512,
      textureHeight: 512,
      clipBias: 0.003,
    });
    this.reflectorPool.rotation.x = -Math.PI / 2;
    this.reflectorPool.position.set(0, 0.01, -19);
    this.courtyardGroup.add(this.reflectorPool);

    const poolEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.65 });
    const poolEdge = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 38.3), poolEdgeMat);
    poolEdge.position.set(0, -0.05, -19);
    this.courtyardGroup.add(poolEdge);

    // Arch colonnade flanking the walkway, receding softly into fog.
    const archGeom = createArchPanelGeometry(2.7, 4.6);
    const archCount = 6;
    const spacing = 5.8;
    for (let i = 0; i < archCount; i++) {
      const z = -2.5 - i * spacing;
      const left = new THREE.Mesh(archGeom, sandstone);
      left.position.set(-5.6, 2.3, z);
      left.rotation.y = Math.PI / 2;
      this.courtyardGroup.add(left);

      const right = new THREE.Mesh(archGeom, sandstone);
      right.position.set(5.6, 2.3, z);
      right.rotation.y = -Math.PI / 2;
      this.courtyardGroup.add(right);
    }

    // Rose hedges lining the outer walkway edges, with small red blooms.
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x203a1c, roughness: 0.85 });
    const hedgeBloomGeom = createRealisticPetalGeometry(
      0.16,
      0.2,
      0.4,
      0.15,
      new THREE.Color(0xff8a3d),
      new THREE.Color(0x9c1420)
    );
    const hedgeBloomMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.5,
      emissive: new THREE.Color(0x4a0d12),
      emissiveIntensity: 0.15,
    });
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 14; i++) {
        const z = -1 - i * 2.4 + (Math.random() - 0.5);
        const x = side * (2.3 + Math.random() * 0.5);
        const hedgeGeo = new THREE.SphereGeometry(0.5 + Math.random() * 0.2, 10, 8);
        const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
        hedge.position.set(x, 0.3, z);
        hedge.scale.y = 0.75;
        this.courtyardGroup.add(hedge);

        const bloomCount = 3 + Math.floor(Math.random() * 3);
        for (let b = 0; b < bloomCount; b++) {
          const bloom = new THREE.Mesh(hedgeBloomGeom, hedgeBloomMat);
          bloom.position.set(
            x + (Math.random() - 0.5) * 0.65,
            0.45 + Math.random() * 0.35,
            z + (Math.random() - 0.5) * 0.65
          );
          bloom.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          this.courtyardGroup.add(bloom);
        }
      }
    }

    // Distant soft tree canopy above the colonnade, for depth in the haze.
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x33512c, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const z = -4 - i * 4.2;
      const s = 1.8 + Math.random() * 1.3;
      const left = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), canopyMat);
      left.position.set(-8 - Math.random() * 2, 5.5 + Math.random() * 1.3, z);
      this.courtyardGroup.add(left);
      const right = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), canopyMat);
      right.position.set(8 + Math.random() * 2, 5.5 + Math.random() * 1.3, z);
      this.courtyardGroup.add(right);
    }

    // Far domed pavilion silhouette closing the vista.
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xe8d2a0, roughness: 0.78 });
    const domeBase = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 0.5), domeMat);
    domeBase.position.set(0, 1.6, -38);
    this.courtyardGroup.add(domeBase);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.set(0, 3.2, -38);
    this.courtyardGroup.add(dome);

    this.scene.add(this.courtyardGroup);
  }

  /**
   * Soft volumetric godray: a wide, gently-fading cone of light with radial
   * (not just vertical) falloff so its silhouette reads as a diffuse beam
   * rather than a hard-edged geometric cone.
   */
  private createGodrayBeam() {
    const geom = new THREE.CylinderGeometry(0.45, 2.6, 11.0, 48, 8, true);
    geom.translate(0, this.flowerHeight + 2.2, 0);

    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform float uTime;
      uniform float uIntensity;
      void main() {
        // Vertical fade (soft top & bottom)
        float vertFade = pow(sin(vUv.y * 3.14159), 1.15);
        // Radial fade around the beam's circumference — this is what turns
        // a hard cylinder silhouette into a soft diffuse beam edge.
        float radialFade = pow(sin(vUv.x * 3.14159), 0.65);
        float rim = pow(1.0 - abs(dot(vNormal, vViewDir)), 1.6);
        float shimmer = 0.88 + 0.12 * sin(uTime * 1.3 + vUv.y * 6.0);
        vec3 beamColor = mix(vec3(1.0, 0.9, 0.68), vec3(1.0, 0.78, 0.5), vUv.y);
        float alpha = vertFade * radialFade * (0.14 + 0.24 * rim) * uIntensity * shimmer;
        gl_FragColor = vec4(beamColor, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.godrayMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.godrayMesh);
  }

  private createSoilAndFallenPetals() {
    const earthGeom = new THREE.CylinderGeometry(1.0, 1.3, 0.45, 24);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.95 });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthMesh.position.y = -0.22;
    this.earthGroup.add(earthMesh);
    this.scene.add(this.earthGroup);

    this.fallenPetalsGroup = new THREE.Group();
    const fallenPetalGeom = createRealisticPetalGeometry(
      0.48,
      0.62,
      0.24,
      0.12,
      new THREE.Color(0xff8a3d),
      new THREE.Color(0x8c0f1f)
    );
    const fallenPetalMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.02,
      emissive: new THREE.Color(0x2a0806),
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });

    const numFallen = 20;
    for (let i = 0; i < numFallen; i++) {
      const mesh = new THREE.Mesh(fallenPetalGeom, fallenPetalMat);
      const angle = (i / numFallen) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 0.45 + Math.pow(Math.random(), 0.7) * 1.35;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.exp(-radius * 0.8) * 0.35 + 0.02,
        Math.sin(angle) * radius
      );
      mesh.rotation.set(Math.PI * 0.5 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
      const scale = 0.7 + Math.random() * 0.45;
      mesh.scale.set(scale, scale, scale);
      this.fallenPetalsGroup.add(mesh);
    }
    this.scene.add(this.fallenPetalsGroup);
  }

  private createBotanicalStemAndLeaves() {
    this.stemGroup = new THREE.Group();
    const h = this.flowerHeight;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.07, h * 0.24, 0.04),
      new THREE.Vector3(-0.06, h * 0.55, -0.03),
      new THREE.Vector3(0.03, h * 0.8, 0.02),
      new THREE.Vector3(0, h, 0),
    ]);

    const stemGeom = new THREE.TubeGeometry(curve, 36, 0.038, 12, false);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1c3a1b, roughness: 0.6, metalness: 0.08 });
    this.stemMesh = new THREE.Mesh(stemGeom, stemMat);
    this.stemMesh.scale.set(1, 0.01, 1);
    this.stemGroup.add(this.stemMesh);

    const thornGeom = new THREE.ConeGeometry(0.022, 0.068, 8);
    thornGeom.translate(0, 0.034, 0);
    thornGeom.rotateZ(-Math.PI * 0.45);
    const thornMat = new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.5, metalness: 0.12 });
    [0.22, 0.35, 0.48, 0.62, 0.74, 0.85].forEach((t, idx) => {
      const p = curve.getPointAt(t);
      const thorn = new THREE.Mesh(thornGeom, thornMat);
      thorn.position.copy(p);
      thorn.rotation.y = idx * 1.3;
      this.stemGroup.add(thorn);
    });

    this.leavesGroup = new THREE.Group();
    const leafletGeom = createRealisticPetalGeometry(
      0.22,
      0.42,
      0.2,
      0.05,
      new THREE.Color(0x2c5a29),
      new THREE.Color(0x143312)
    );
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.06, side: THREE.DoubleSide });

    const addLeafCluster = (t: number, rotY: number, rotZ: number) => {
      const branch = new THREE.Group();
      branch.position.copy(curve.getPointAt(t));
      branch.rotation.y = rotY;
      branch.rotation.z = rotZ;

      const center = new THREE.Mesh(leafletGeom, leafMat);
      center.position.set(0, 0.2, 0);
      branch.add(center);

      const left = new THREE.Mesh(leafletGeom, leafMat);
      left.position.set(-0.1, 0.11, 0);
      left.rotation.z = -0.55;
      left.scale.set(0.8, 0.8, 0.8);
      branch.add(left);

      const right = new THREE.Mesh(leafletGeom, leafMat);
      right.position.set(0.1, 0.11, 0);
      right.rotation.z = 0.55;
      right.scale.set(0.8, 0.8, 0.8);
      branch.add(right);

      this.leavesGroup.add(branch);
    };

    addLeafCluster(0.42, 0.8, -0.45);
    addLeafCluster(0.68, -1.9, 0.4);
    this.stemGroup.add(this.leavesGroup);
    this.scene.add(this.stemGroup);

    const sepalGeom = createRealisticPetalGeometry(
      0.2,
      0.72,
      0.18,
      0.15,
      new THREE.Color(0x2c5a29),
      new THREE.Color(0x14330f)
    );
    const sepalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const sepal = new THREE.Mesh(sepalGeom, sepalMat);
      sepal.position.set(0, h, 0);
      sepal.rotation.y = angle;
      sepal.rotation.x = 0.12;
      this.sepalsGroup.add(sepal);
    }
    this.scene.add(this.sepalsGroup);
  }

  /**
   * Dense, real botanical rose head: seven architectural whorls (~150
   * individually-built, rounded petals) at golden-angle phyllotaxis, warm
   * golden-orange at the heart fading to deep true red at the guard petals
   * — matching the reference photo's single glowing rose.
   */
  private createBotanicalRosePetals() {
    this.flowerGroup = new THREE.Group();
    this.flowerGroup.position.set(0, this.flowerHeight, 0);
    this.flowerGroup.scale.setScalar(1.15);
    this.scene.add(this.flowerGroup);

    const warmBase = new THREE.Color(0xffb04a);
    const midRed = new THREE.Color(0xe6202f);
    const deepRed = new THREE.Color(0x7a0e18);

    const layerConfigs = [
      { count: 5, width: 0.3, length: 0.48, cupping: 0.56, reflex: 0.04, dist: 0.03, budAngle: 0.1, bloomAngle: 0.32, yOff: 0.02, tip: midRed },
      { count: 7, width: 0.42, length: 0.64, cupping: 0.52, reflex: 0.1, dist: 0.07, budAngle: 0.15, bloomAngle: 0.6, yOff: -0.01, tip: midRed },
      { count: 10, width: 0.58, length: 0.82, cupping: 0.46, reflex: 0.17, dist: 0.14, budAngle: 0.19, bloomAngle: 0.88, yOff: -0.05, tip: midRed },
      { count: 14, width: 0.76, length: 1.0, cupping: 0.4, reflex: 0.26, dist: 0.21, budAngle: 0.23, bloomAngle: 1.15, yOff: -0.09, tip: deepRed },
      { count: 18, width: 0.92, length: 1.16, cupping: 0.34, reflex: 0.36, dist: 0.29, budAngle: 0.27, bloomAngle: 1.42, yOff: -0.13, tip: deepRed },
      { count: 22, width: 1.06, length: 1.3, cupping: 0.28, reflex: 0.45, dist: 0.38, budAngle: 0.3, bloomAngle: 1.68, yOff: -0.17, tip: deepRed },
      { count: 26, width: 1.18, length: 1.42, cupping: 0.22, reflex: 0.52, dist: 0.47, budAngle: 0.33, bloomAngle: 1.9, yOff: -0.21, tip: deepRed },
    ];

    const goldenAngle = 137.5 * (Math.PI / 180);
    let totalPetalIndex = 0;

    layerConfigs.forEach((layerConf) => {
      for (let i = 0; i < layerConf.count; i++) {
        const seed = Math.random() - 0.5;
        const jitter = () => 0.92 + Math.random() * 0.16;

        const geom = createRealisticPetalGeometry(
          layerConf.width * jitter(),
          layerConf.length * jitter(),
          layerConf.cupping * jitter(),
          layerConf.reflex * jitter(),
          warmBase,
          layerConf.tip,
          seed
        );
        const mat = new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.32,
          metalness: 0.02,
          clearcoat: 0.55,
          clearcoatRoughness: 0.26,
          sheen: 0.6,
          sheenColor: new THREE.Color(0xffb37a),
          sheenRoughness: 0.6,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(0x8c1010),
          emissiveIntensity: 0.09,
        });

        const mesh = new THREE.Mesh(geom, mat);
        const theta = totalPetalIndex * goldenAngle;
        totalPetalIndex++;

        const budX = Math.cos(theta) * (layerConf.dist * 0.22);
        const budZ = Math.sin(theta) * (layerConf.dist * 0.22);
        const budPos = new THREE.Vector3(budX, layerConf.yOff, budZ);
        const budRot = new THREE.Euler(layerConf.budAngle, theta, 0, 'YXZ');
        const budScale = new THREE.Vector3(0.48, 0.58, 0.48);

        const bloomX = Math.cos(theta) * layerConf.dist;
        const bloomZ = Math.sin(theta) * layerConf.dist;
        const bloomPos = new THREE.Vector3(bloomX, layerConf.yOff, bloomZ);
        const bloomRot = new THREE.Euler(layerConf.bloomAngle, theta, (Math.random() - 0.5) * 0.15, 'YXZ');
        const bloomScale = new THREE.Vector3(1.0, 1.0, 1.0);

        const burstSpeed = 2.0 + Math.random() * 2.8;
        const burstAngle = theta + (Math.random() - 0.5) * 0.4;
        const upwardSpeed = 0.8 + Math.random() * 2.2;
        const velocity = new THREE.Vector3(
          Math.cos(burstAngle) * burstSpeed,
          upwardSpeed,
          Math.sin(burstAngle) * burstSpeed
        );
        const rotVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.0
        );

        mesh.position.copy(budPos);
        mesh.rotation.copy(budRot);
        mesh.scale.copy(budScale);
        this.flowerGroup.add(mesh);

        this.petals.push({
          mesh,
          layer: layerConfigs.indexOf(layerConf),
          budPos,
          budRot,
          budScale,
          bloomPos,
          bloomRot,
          bloomScale,
          velocity,
          rotVelocity,
          scatterPos: new THREE.Vector3(),
          scatterRot: new THREE.Euler(),
          turbulenceSeed: Math.random() * 100,
        });
      }
    });
  }

  /** Dense wind-blown petal storm: instanced, spawned in waves from
   * off-screen left during the exploding phase. */
  private createPetalStorm() {
    const stormGeom = createRealisticPetalGeometry(
      0.42,
      0.58,
      0.28,
      0.14,
      new THREE.Color(0xffa04a),
      new THREE.Color(0x9c1420)
    );
    const stormMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x7a0e14),
      emissiveIntensity: 0.07,
    });

    this.stormMesh = new THREE.InstancedMesh(stormGeom, stormMat, this.stormCount);
    this.stormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh.count = 0;
    this.scene.add(this.stormMesh);

    for (let i = 0; i < this.stormCount; i++) {
      this.stormData.push({
        active: false,
        spawnDelay: Math.random() * 3.2,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Euler(),
        scale: 0.45 + Math.random() * 0.9,
        seed: Math.random() * 100,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.stormMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private createAtmosphericGlowDust() {
    const count = 320;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 0.6) * 3.2;
      const angle = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.random() * 6.5;
      pos[i * 3 + 2] = Math.sin(angle) * radius - 3;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffdca8,
      size: 0.035,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.floatingDust = new THREE.Points(geom, mat);
    this.scene.add(this.floatingDust);
  }

  private createStarfield() {
    const count = 600;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.lerp(-0.15, 1, Math.random()));
      const radius = 20 + Math.random() * 10;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      pos[i * 3 + 1] = Math.cos(phi) * radius + 2;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius - 10;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starfieldMat = new THREE.PointsMaterial({
      color: 0xf5e4c8,
      size: 0.05,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.starfield = new THREE.Points(geom, this.starfieldMat);
    this.scene.add(this.starfield);
  }

  /**
   * Final scene: real rose petals laid flat along a gently winding ground
   * path — one per Nahw topic — matching the reference photo's trail of
   * scattered petals leading forward. The reader scrubs along the trail;
   * the nearest petal enlarges and glows, and tapping the focused petal
   * opens that topic.
   */
  private createTopicPath() {
    this.pathGroup = new THREE.Group();
    this.pathGroup.visible = false;

    const n = NAHW_DEMO_TOPICS.length;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = Math.sin(t * Math.PI * 1.8) * 1.3;
      const z = -t * (n - 1) * 1.7;
      points.push(new THREE.Vector3(x, 0.02, z));
    }
    this.pathCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);

    const petalGeom = createRealisticPetalGeometry(
      0.62,
      0.8,
      0.22,
      0.12,
      new THREE.Color(0xffa04a),
      new THREE.Color(0x9c1420)
    );

    NAHW_DEMO_TOPICS.forEach((topic, i) => {
      const t = i / (n - 1);
      const p = this.pathCurve.getPointAt(t);
      const tangent = this.pathCurve.getTangentAt(t);

      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.55,
        clearcoatRoughness: 0.26,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x8c1010),
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(petalGeom, mat);
      mesh.position.copy(p);
      mesh.rotation.x = -Math.PI / 2.2;
      mesh.rotation.z = Math.atan2(tangent.x, tangent.z);
      this.pathGroup.add(mesh);

      this.pathPetals.push({ mesh, topic, t });
    });

    this.scene.add(this.pathGroup);
  }

  private onResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  };

  private onMouseMove = (e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.mouseTarget.set(x * 0.3, y * 0.15);
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = (touch.clientX / window.innerWidth) * 2 - 1;
      const y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.mouseTarget.set(x * 0.3, y * 0.15);
    }
  };

  public replay() {
    this.sequenceTime = 0;
    this.currentPhase = 'sprouting';
    this.onPhaseChange?.('sprouting');

    this.stemMesh.scale.set(1, 0.01, 1);
    this.stemGroup.position.set(0, 0, 0);
    this.flowerGroup.position.set(0, this.flowerHeight, 0);
    this.sepalsGroup.position.set(0, 0, 0);
    this.stemGroup.visible = true;
    this.sepalsGroup.visible = true;
    this.flowerGroup.visible = true;
    this.earthGroup.visible = true;
    this.fallenPetalsGroup.visible = true;
    this.courtyardGroup.visible = true;
    this.godrayMesh.visible = true;
    this.floatingDust.visible = true;
    this.stormMesh.visible = true;

    this.keyLight.intensity = 3.0;
    this.rimLight.intensity = 1.8;
    this.ambientLight.intensity = 0.65;
    this.roseBloomLight.intensity = 1.8;
    if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
      this.godrayMesh.material.uniforms.uIntensity.value = 1.0;
    }
    this.starfieldMat.opacity = 0;
    this.windStrength = 0;
    this.stormMesh.count = 0;
    for (const s of this.stormData) {
      s.active = false;
      s.spawnDelay = Math.random() * 3.2;
    }

    for (const p of this.petals) {
      p.mesh.visible = true;
      p.mesh.position.copy(p.budPos);
      p.mesh.rotation.copy(p.budRot);
      p.mesh.scale.copy(p.budScale);
      p.scatterPos.copy(p.bloomPos);
      p.scatterRot.copy(p.bloomRot);
    }

    this.pathGroup.visible = false;
    this.pathT = 0;
    this.pathTargetT = 0;
    this.pathFocusIndex = -1;
  }

  /** Called once the reader taps through the couplet blackout screen. */
  public enterTopicPath() {
    this.currentPhase = 'path';
    this.onPhaseChange?.('path');

    this.courtyardGroup.visible = false;
    this.earthGroup.visible = false;
    this.stemGroup.visible = false;
    this.sepalsGroup.visible = false;
    this.flowerGroup.visible = false;
    this.fallenPetalsGroup.visible = false;
    this.godrayMesh.visible = false;
    this.floatingDust.visible = false;
    this.stormMesh.visible = false;

    this.pathGroup.visible = true;
    this.pathT = 0;
    this.pathTargetT = 0;
    this.pathFocusIndex = -1;

    this.ambientLight.intensity = 0.4;
    this.keyLight.intensity = 1.6;
    this.rimLight.intensity = 0.8;
  }

  /** Scrub the topic path by a normalized delta in roughly [-1, 1] range. */
  public scrubTopicPath(delta: number) {
    this.pathTargetT = THREE.MathUtils.clamp(this.pathTargetT + delta, 0, 1);
  }

  public getFocusedTopicIndex(): number {
    return this.pathFocusIndex;
  }

  /** Raycast a screen-space NDC point against the path petals; returns the
   * topic only if the hit petal is currently focused (nearest to pathT). */
  public raycastPath(ndcX: number, ndcY: number): NahwDemoTopic | null {
    if (!this.pathGroup.visible) return null;
    this.pathRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const meshes = this.pathPetals.map((p) => p.mesh);
    const hits = this.pathRaycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const hitIndex = meshes.indexOf(hits[0].object as THREE.Mesh);
    if (hitIndex === this.pathFocusIndex) {
      return this.pathPetals[hitIndex].topic;
    }
    return null;
  }

  private updatePetalStorm(delta: number, gustEnvelope: number) {
    let activeCount = 0;
    for (let i = 0; i < this.stormCount; i++) {
      const s = this.stormData[i];

      if (!s.active) {
        s.spawnDelay -= delta;
        if (s.spawnDelay <= 0) {
          s.active = true;
          s.pos.set(
            -8 - Math.random() * 3.5,
            this.flowerHeight + (Math.random() - 0.5) * 3.6,
            THREE.MathUtils.lerp(-2.0, 3.2, Math.random())
          );
          s.vel.set(3.0 + Math.random() * 4.2, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 0.9);
          s.rotVel.set((Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 4.4);
          s.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        }
      }

      if (s.active) {
        const turb = this.sequenceTime * 1.7 + s.seed;
        s.pos.x += (s.vel.x + this.windStrength * 1.5) * delta;
        s.pos.y += (s.vel.y + Math.sin(turb) * 0.35) * delta;
        s.pos.z += (s.vel.z + Math.cos(turb * 0.8) * 0.28) * delta;
        s.rot.x += s.rotVel.x * delta;
        s.rot.y += s.rotVel.y * delta;
        s.rot.z += s.rotVel.z * delta;

        this.dummy.position.copy(s.pos);
        this.dummy.rotation.copy(s.rot);
        this.dummy.scale.setScalar(s.scale * gustEnvelope);
        this.dummy.updateMatrix();
        this.stormMesh.setMatrixAt(i, this.dummy.matrix);
        activeCount = i + 1;

        if (s.pos.x > 9.5) {
          s.active = false;
          s.spawnDelay = Math.random() * 0.4;
        }
      }
    }
    this.stormMesh.count = activeCount;
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private updateTopicPath(delta: number) {
    // Smoothly ease toward the scrub target (critically-damped lerp) so the
    // path glides instead of snapping.
    this.pathT = THREE.MathUtils.lerp(this.pathT, this.pathTargetT, 1 - Math.pow(0.0005, delta));

    const p = this.pathCurve.getPointAt(this.pathT);
    const lookAheadT = Math.min(1, this.pathT + 0.06);
    const look = this.pathCurve.getPointAt(lookAheadT);

    this.camera.position.lerp(new THREE.Vector3(p.x, p.y + 1.7, p.z + 3.4), 1 - Math.pow(0.0008, delta));
    this.camera.lookAt(look.x, look.y + 0.3, look.z);

    let nearestIdx = -1;
    let nearestDist = Infinity;
    this.pathPetals.forEach((pp, idx) => {
      const d = Math.abs(pp.t - this.pathT);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    if (nearestIdx !== this.pathFocusIndex) {
      this.pathFocusIndex = nearestIdx;
      this.onPathFocusChange?.(nearestIdx);
    }

    this.pathPetals.forEach((pp, idx) => {
      const isFocused = idx === this.pathFocusIndex;
      const targetScale = isFocused ? 1.5 : 0.85;
      const targetY = isFocused ? 0.18 : 0.02;
      const targetEmissive = isFocused ? 0.42 : 0.08;
      pp.mesh.scale.setScalar(THREE.MathUtils.lerp(pp.mesh.scale.x, targetScale, 1 - Math.pow(0.001, delta)));
      pp.mesh.position.y = THREE.MathUtils.lerp(pp.mesh.position.y, targetY, 1 - Math.pow(0.001, delta));
      const mat = pp.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, 1 - Math.pow(0.001, delta));
    });
  }

  private animate = () => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.sequenceTime += delta;

    if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
      this.godrayMesh.material.uniforms.uTime.value = this.sequenceTime;
    }

    if (this.currentPhase === 'path') {
      this.updateTopicPath(delta);
      this.composer.render();
      return;
    }

    // Smooth mouse-parallax camera drift (critically damped, frame-rate
    // independent) for a steady, non-jittery cinematic feel.
    this.mouseCurrent.lerp(this.mouseTarget, 1 - Math.pow(0.0001, delta));
    this.camera.position.x = this.mouseCurrent.x * 0.9;
    this.camera.position.y = this.flowerHeight + 1.4 + this.mouseCurrent.y * 0.5;
    this.camera.position.z = 6.5;
    this.camera.lookAt(0, this.flowerHeight - 0.1, -1.5);

    // Stage 1: SPROUTING (0s -> 3.6s)
    if (this.sequenceTime < 3.6) {
      if (this.currentPhase !== 'sprouting') {
        this.currentPhase = 'sprouting';
        this.onPhaseChange?.('sprouting');
      }
      const sproutP = THREE.MathUtils.smoothstep(this.sequenceTime, 0.2, 3.4);
      this.stemMesh.scale.y = Math.max(0.01, sproutP);
      this.leavesGroup.scale.set(sproutP, sproutP, sproutP);
      const headY = sproutP * this.flowerHeight;
      this.flowerGroup.position.y = headY;
      this.sepalsGroup.position.y = headY;
      this.flowerGroup.rotation.z = Math.sin(this.sequenceTime * 1.6) * 0.02;
      this.flowerGroup.rotation.y = this.sequenceTime * 0.06;
      this.roseBloomLight.intensity = 1.0 * sproutP;
    }
    // Stage 2: BLOOMING (3.6s -> 8.2s)
    else if (this.sequenceTime < 8.2) {
      if (this.currentPhase !== 'blooming') {
        this.currentPhase = 'blooming';
        this.onPhaseChange?.('blooming');
      }
      this.stemMesh.scale.y = 1.0;
      this.leavesGroup.scale.set(1, 1, 1);
      this.flowerGroup.position.y = this.flowerHeight;
      this.sepalsGroup.position.y = this.flowerHeight;

      const bloomT = THREE.MathUtils.smoothstep(this.sequenceTime, 3.6, 7.9);
      for (const p of this.petals) {
        const layerDelay = (6 - p.layer) * 0.09;
        const petalProgress = THREE.MathUtils.clamp((bloomT - layerDelay) / 0.62, 0, 1);
        const smoothP = THREE.MathUtils.smoothstep(petalProgress, 0, 1);
        p.mesh.position.lerpVectors(p.budPos, p.bloomPos, smoothP);
        p.mesh.rotation.x = THREE.MathUtils.lerp(p.budRot.x, p.bloomRot.x, smoothP);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.budRot.y, p.bloomRot.y, smoothP);
        p.mesh.rotation.z = THREE.MathUtils.lerp(p.budRot.z, p.bloomRot.z, smoothP);
        p.mesh.scale.lerpVectors(p.budScale, p.bloomScale, smoothP);
      }
      for (let i = 0; i < this.sepalsGroup.children.length; i++) {
        this.sepalsGroup.children[i].rotation.x = THREE.MathUtils.lerp(0.12, 1.4, bloomT);
      }
      this.flowerGroup.rotation.y += 0.0018;
      this.roseBloomLight.intensity = 1.8 + Math.sin(this.sequenceTime * 2.4) * 0.22;
    }
    // Stage 3: EXPLODING & PETAL STORM (8.2s -> 13.5s)
    else if (this.sequenceTime < 13.5) {
      if (this.currentPhase !== 'exploding') {
        this.currentPhase = 'exploding';
        this.onPhaseChange?.('exploding');
        this.onExplode?.();
        for (const p of this.petals) {
          const worldPos = new THREE.Vector3();
          p.mesh.getWorldPosition(worldPos);
          p.scatterPos.copy(worldPos);
          p.scatterRot.copy(p.mesh.rotation);
        }
      }

      const explodeT = this.sequenceTime - 8.2;
      this.stemGroup.position.y = -explodeT * 1.1;
      this.sepalsGroup.position.y = this.flowerHeight - explodeT * 1.1;

      const gustEnvelope = Math.sin(THREE.MathUtils.clamp(explodeT / 5.1, 0, 1) * Math.PI);
      this.windStrength = gustEnvelope * 3.6;

      for (const p of this.petals) {
        p.velocity.x *= 0.985;
        p.velocity.z *= 0.985;
        p.velocity.y -= delta * 0.3;
        p.velocity.x += this.windStrength * delta;

        const turbTime = this.sequenceTime * 1.5 + p.turbulenceSeed;
        const swirlX = Math.sin(turbTime) * 0.015;
        const swirlZ = Math.cos(turbTime * 0.9) * 0.015;
        p.scatterPos.x += p.velocity.x * delta + swirlX;
        p.scatterPos.y += p.velocity.y * delta;
        p.scatterPos.z += p.velocity.z * delta + swirlZ;
        p.scatterRot.x += p.rotVelocity.x * delta;
        p.scatterRot.y += p.rotVelocity.y * delta;
        p.scatterRot.z += p.rotVelocity.z * delta;

        const localPos = p.scatterPos.clone().sub(this.flowerGroup.position);
        p.mesh.position.copy(localPos.divideScalar(this.flowerGroup.scale.x));
        p.mesh.rotation.copy(p.scatterRot);
      }

      this.updatePetalStorm(delta, gustEnvelope);

      const dimFactor = THREE.MathUtils.clamp((explodeT - 1.5) / 3.6, 0, 1);
      this.keyLight.intensity = THREE.MathUtils.lerp(3.0, 0.1, dimFactor);
      this.rimLight.intensity = THREE.MathUtils.lerp(1.8, 0.1, dimFactor);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.65, 0.05, dimFactor);
      this.roseBloomLight.intensity = THREE.MathUtils.lerp(1.8, 0.1, dimFactor);
      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.03, dimFactor);
      }
      this.starfieldMat.opacity = dimFactor * 0.55;
    }
    // Stage 4: BLACKOUT — screen goes fully dark, only the couplet follows
    else {
      if (this.currentPhase !== 'blackout') {
        this.currentPhase = 'blackout';
        this.onPhaseChange?.('blackout');
        this.onBlackout?.();
      }
      this.keyLight.intensity = 0;
      this.rimLight.intensity = 0;
      this.ambientLight.intensity = 0.02;
      this.roseBloomLight.intensity = 0;
      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = 0;
      }
      this.starfieldMat.opacity = 0;
      this.windStrength *= 0.9;
      this.updatePetalStorm(delta, 0.1);
    }

    const dustPos = this.floatingDust.geometry.attributes.position;
    for (let i = 0; i < dustPos.count; i++) {
      let y = dustPos.getY(i) + delta * 0.09;
      if (y > 6.5) y = 0.1;
      dustPos.setY(i, y);
    }
    dustPos.needsUpdate = true;

    this.composer.render();
  };

  public destroy() {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('touchmove', this.onTouchMove);

    this.reflectorPool.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
