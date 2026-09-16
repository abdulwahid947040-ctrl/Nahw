import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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

interface CarouselPetal {
  mesh: THREE.Mesh;
  topic: NahwDemoTopic;
  angle: number;
}

/**
 * Builds one botanical rose-petal surface: a scalloped obovate outline,
 * a transverse cupped bowl, a reflexed (curled-back) tip, and a soft central
 * vein — then bakes a base-to-tip vertex-color gradient so every petal reads
 * as true, richly-colored velvet instead of a flat fill. `asymmetry` biases
 * the outline and ruffle phase per call so no two petals from the same
 * layer are identical stamped clones.
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
  const segmentsU = 20;
  const segmentsV = 24;
  const geom = new THREE.PlaneGeometry(width, length, segmentsU, segmentsV);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ruffleSeed = asymmetry * 7.3;

  for (let i = 0; i < pos.count; i++) {
    const rawU = Math.max(-1.0, Math.min(1.0, pos.getX(i) / (width * 0.5)));
    const rawV = (pos.getY(i) + length * 0.5) / length;
    const v = Math.max(0.0, Math.min(1.0, rawV));

    const skewedU = rawU + asymmetry * 0.12 * Math.sin(v * Math.PI);
    const sinBase = Math.max(0.0, Math.sin(v * Math.PI * 0.5));
    const baseTaper = Math.pow(sinBase, 0.7);
    const tipCurve = Math.max(0.0, Math.sin((1.0 - v) * Math.PI * 0.5));
    const profile = baseTaper * (0.3 + 0.7 * tipCurve);

    const apexNotch = v > 0.85 ? Math.abs(skewedU) * 0.15 * ((v - 0.85) / 0.15) : 0;
    const edgeWave =
      Math.sin(v * 15.0 + ruffleSeed) * Math.cos(rawU * 3.0 + ruffleSeed * 0.5) * (0.045 * Math.abs(rawU));

    const newX = skewedU * (width * 0.5) * profile + edgeWave;
    const newY = pos.getY(i) + length * 0.5 - apexNotch;

    const cupBowl = -Math.cos(rawU * Math.PI * 0.5) * cupping * Math.sin(v * Math.PI);
    const reflex = Math.pow(v, 2.6) * reflexCurl;
    const centralVein = -Math.exp(-rawU * rawU * 12.0) * 0.045 * v;
    const sideVeins =
      -Math.exp(-(Math.abs(rawU) - 0.45) * (Math.abs(rawU) - 0.45) * 30.0) * 0.02 * v;
    const newZ = cupBowl + reflex + centralVein + sideVeins;

    pos.setXYZ(i, newX, newY, newZ);

    const c = new THREE.Color().lerpColors(baseColor, tipColor, Math.pow(v, 0.85));
    const edgeDarken = 1.0 - Math.abs(rawU) * 0.12;
    colors[i * 3] = c.r * edgeDarken;
    colors[i * 3 + 1] = c.g * edgeDarken;
    colors[i * 3 + 2] = c.b * edgeDarken;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
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

  // Cinematic Lighting — warm golden key + true-red rim, minimal color noise
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private roseBloomLight!: THREE.PointLight;
  private godrayMesh!: THREE.Mesh;

  // Minimal dark-stage environment (unseen.co-inspired): a softly lit floor
  // disc and a distant atmospheric glow, not literal garden foliage.
  private stageGroup: THREE.Group = new THREE.Group();
  private stageFloorMat!: THREE.MeshStandardMaterial;

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
  private stormCount = 260;
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

  public readonly flowerHeight = 3.15;

  // Final scene: a real 3D carousel of large petals, one per Nahw topic,
  // arranged in a ring the reader rotates (drag or arrows) to navigate.
  private carouselGroup: THREE.Group = new THREE.Group();
  private carouselPetals: CarouselPetal[] = [];
  private carouselIndex: number = 0;
  private carouselRotation: number = 0;
  private carouselDragOffset: number = 0;
  private carouselDragging: boolean = false;
  private readonly carouselRadius = 3.4;
  private carouselRaycaster = new THREE.Raycaster();
  public onCarouselFocusChange?: (index: number) => void;
  private lastFocusIndex: number = -1;

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
    this.scene.fog = new THREE.FogExp2(0x030203, 0.032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    this.camera.position.set(0, this.flowerHeight - 0.2, 7.0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x030203, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    // Restrained highlight-only glow — only genuine bright spots bloom.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.4, 0.8);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.setupLighting();
    this.createStage();
    this.createGodrayBeam();
    this.createSoilAndFallenPetals();
    this.createBotanicalStemAndLeaves();
    this.createBotanicalRosePetals();
    this.createPetalStorm();
    this.createAtmosphericGlowDust();
    this.createStarfield();
    this.createTopicCarousel();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });

    this.animate();
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x140a08, 0.5);
    this.scene.add(this.ambientLight);

    // Warm golden overhead key — the single dominant light source, like the
    // reference photography's shaft of light.
    this.keyLight = new THREE.DirectionalLight(0xffdca8, 3.4);
    this.keyLight.position.set(0.6, 7.5, 3.0);
    this.scene.add(this.keyLight);

    // Subtle warm rim (amber, not magenta) for a true-red rose, not pink.
    this.rimLight = new THREE.DirectionalLight(0xff7a3d, 2.2);
    this.rimLight.position.set(-3.5, 3.5, -3.2);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0x201014, 0.9);
    this.fillLight.position.set(-2.5, -0.5, 2.5);
    this.scene.add(this.fillLight);

    this.roseBloomLight = new THREE.PointLight(0xff5a2e, 2.0, 4.2);
    this.roseBloomLight.position.set(0, this.flowerHeight, 0);
    this.scene.add(this.roseBloomLight);
  }

  /**
   * Minimal dark stage in the spirit of unseen.co: a near-black void with a
   * softly-lit floor disc (subtle sheen, not a mirror) directly beneath the
   * rose, and nothing else competing for attention — the rose itself is the
   * only "set piece".
   */
  private createStage() {
    this.stageGroup = new THREE.Group();

    const floorGeom = new THREE.CircleGeometry(9, 64);
    this.stageFloorMat = new THREE.MeshStandardMaterial({
      color: 0x08070a,
      roughness: 0.35,
      metalness: 0.55,
    });
    const floor = new THREE.Mesh(floorGeom, this.stageFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    this.stageGroup.add(floor);

    // Very soft radial glow disc under the light beam, grounding the rose
    // without any literal architecture or foliage.
    const glowGeom = new THREE.CircleGeometry(2.4, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x3a2010,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.01;
    this.stageGroup.add(glow);

    this.scene.add(this.stageGroup);
  }

  private createGodrayBeam() {
    const geom = new THREE.CylinderGeometry(0.22, 1.35, 10.0, 32, 1, true);
    geom.translate(0, this.flowerHeight + 1.9, 0);

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
        float vertFade = pow(sin(vUv.y * 3.14159), 1.3);
        float rim = pow(1.0 - abs(dot(vNormal, vViewDir)), 1.5);
        float shimmer = 0.85 + 0.15 * sin(uTime * 1.5 + vUv.y * 8.0);
        vec3 beamColor = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.7, 0.42), vUv.y);
        float alpha = vertFade * (0.16 + 0.22 * rim) * uIntensity * shimmer;
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
    const earthGeom = new THREE.CylinderGeometry(1.1, 1.4, 0.5, 32);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x0e0a08, roughness: 0.95, flatShading: true });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthMesh.position.y = -0.25;
    this.earthGroup.add(earthMesh);
    this.scene.add(this.earthGroup);

    this.fallenPetalsGroup = new THREE.Group();
    const fallenPetalGeom = createRealisticPetalGeometry(
      0.5,
      0.68,
      0.25,
      0.1,
      new THREE.Color(0xff8a3d),
      new THREE.Color(0x8c0f1f)
    );
    const fallenPetalMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      clearcoat: 0.4,
      metalness: 0.02,
      emissive: new THREE.Color(0x2a0806),
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide,
    });

    const numFallen = 22;
    for (let i = 0; i < numFallen; i++) {
      const mesh = new THREE.Mesh(fallenPetalGeom, fallenPetalMat);
      const angle = (i / numFallen) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 0.5 + Math.pow(Math.random(), 0.7) * 1.5;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.exp(-radius * 0.8) * 0.4 + 0.03,
        Math.sin(angle) * radius
      );
      mesh.rotation.set(Math.PI * 0.5 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
      const scale = 0.7 + Math.random() * 0.5;
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
      new THREE.Vector3(0.1, h * 0.24, 0.06),
      new THREE.Vector3(-0.08, h * 0.55, -0.04),
      new THREE.Vector3(0.04, h * 0.8, 0.03),
      new THREE.Vector3(0, h, 0),
    ]);

    const stemGeom = new THREE.TubeGeometry(curve, 36, 0.05, 12, false);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1c3a1b, roughness: 0.6, metalness: 0.1 });
    this.stemMesh = new THREE.Mesh(stemGeom, stemMat);
    this.stemMesh.scale.set(1, 0.01, 1);
    this.stemGroup.add(this.stemMesh);

    const thornGeom = new THREE.ConeGeometry(0.03, 0.09, 8);
    thornGeom.translate(0, 0.045, 0);
    thornGeom.rotateZ(-Math.PI * 0.45);
    const thornMat = new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.5, metalness: 0.15 });
    [0.22, 0.35, 0.48, 0.62, 0.74, 0.85].forEach((t, idx) => {
      const p = curve.getPointAt(t);
      const thorn = new THREE.Mesh(thornGeom, thornMat);
      thorn.position.copy(p);
      thorn.rotation.y = idx * 1.3;
      this.stemGroup.add(thorn);
    });

    this.leavesGroup = new THREE.Group();
    const leafletGeom = createRealisticPetalGeometry(
      0.28,
      0.55,
      0.2,
      0.05,
      new THREE.Color(0x2c5a29),
      new THREE.Color(0x143312)
    );
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide });

    const addLeafCluster = (t: number, rotY: number, rotZ: number) => {
      const branch = new THREE.Group();
      branch.position.copy(curve.getPointAt(t));
      branch.rotation.y = rotY;
      branch.rotation.z = rotZ;

      const center = new THREE.Mesh(leafletGeom, leafMat);
      center.position.set(0, 0.27, 0);
      branch.add(center);

      const left = new THREE.Mesh(leafletGeom, leafMat);
      left.position.set(-0.13, 0.15, 0);
      left.rotation.z = -0.55;
      left.scale.set(0.8, 0.8, 0.8);
      branch.add(left);

      const right = new THREE.Mesh(leafletGeom, leafMat);
      right.position.set(0.13, 0.15, 0);
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
      0.25,
      0.95,
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
   * individually-built petals) at golden-angle phyllotaxis. Colors run from
   * a warm golden-orange base (where the godray catches the inner petals)
   * to a deep true red toward the outer guard petals — a genuine red rose,
   * not pink or magenta.
   */
  private createBotanicalRosePetals() {
    this.flowerGroup = new THREE.Group();
    this.flowerGroup.position.set(0, this.flowerHeight, 0);
    this.flowerGroup.scale.setScalar(1.45);
    this.scene.add(this.flowerGroup);

    const warmBase = new THREE.Color(0xffb04a);
    const midRed = new THREE.Color(0xe6202f);
    const deepRed = new THREE.Color(0x7a0e18);

    const layerConfigs = [
      { count: 5, width: 0.34, length: 0.58, cupping: 0.58, reflex: 0.03, dist: 0.03, budAngle: 0.1, bloomAngle: 0.35, yOff: 0.02, tip: midRed },
      { count: 7, width: 0.5, length: 0.78, cupping: 0.54, reflex: 0.1, dist: 0.08, budAngle: 0.16, bloomAngle: 0.65, yOff: -0.01, tip: midRed },
      { count: 10, width: 0.7, length: 1.0, cupping: 0.48, reflex: 0.18, dist: 0.16, budAngle: 0.2, bloomAngle: 0.95, yOff: -0.06, tip: midRed },
      { count: 14, width: 0.92, length: 1.22, cupping: 0.42, reflex: 0.28, dist: 0.25, budAngle: 0.24, bloomAngle: 1.25, yOff: -0.11, tip: deepRed },
      { count: 18, width: 1.12, length: 1.42, cupping: 0.36, reflex: 0.4, dist: 0.35, budAngle: 0.28, bloomAngle: 1.55, yOff: -0.16, tip: deepRed },
      { count: 22, width: 1.3, length: 1.6, cupping: 0.3, reflex: 0.5, dist: 0.46, budAngle: 0.32, bloomAngle: 1.85, yOff: -0.21, tip: deepRed },
      { count: 26, width: 1.46, length: 1.75, cupping: 0.24, reflex: 0.58, dist: 0.58, budAngle: 0.36, bloomAngle: 2.1, yOff: -0.26, tip: deepRed },
    ];

    const goldenAngle = 137.5 * (Math.PI / 180);
    let totalPetalIndex = 0;

    layerConfigs.forEach((layerConf) => {
      for (let i = 0; i < layerConf.count; i++) {
        const seed = Math.random() - 0.5;
        const jitter = () => 0.9 + Math.random() * 0.2;

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
          roughness: 0.34,
          metalness: 0.02,
          clearcoat: 0.55,
          clearcoatRoughness: 0.28,
          sheen: 0.7,
          sheenColor: new THREE.Color(0xffb37a),
          sheenRoughness: 0.6,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(0x8c1010),
          emissiveIntensity: 0.1,
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

        const burstSpeed = 2.2 + Math.random() * 3.2;
        const burstAngle = theta + (Math.random() - 0.5) * 0.4;
        const upwardSpeed = 0.9 + Math.random() * 2.6;
        const velocity = new THREE.Vector3(
          Math.cos(burstAngle) * burstSpeed,
          upwardSpeed,
          Math.sin(burstAngle) * burstSpeed
        );
        const rotVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 4.6,
          (Math.random() - 0.5) * 4.6,
          (Math.random() - 0.5) * 4.6
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

  /**
   * Dense wind-blown petal storm: instanced, spawned in waves from off-screen
   * left during the exploding phase so hundreds of petals sweep across and
   * fill the frame close to the camera.
   */
  private createPetalStorm() {
    const stormGeom = createRealisticPetalGeometry(
      0.5,
      0.68,
      0.3,
      0.15,
      new THREE.Color(0xffa04a),
      new THREE.Color(0x9c1420)
    );
    const stormMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x7a0e14),
      emissiveIntensity: 0.08,
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
        scale: 0.5 + Math.random() * 1.1,
        seed: Math.random() * 100,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.stormMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private createAtmosphericGlowDust() {
    const count = 380;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 0.6) * 3.5;
      const angle = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.random() * 7.5;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffdca8,
      size: 0.04,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    this.floatingDust = new THREE.Points(geom, mat);
    this.scene.add(this.floatingDust);
  }

  private createStarfield() {
    const count = 700;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.lerp(-0.15, 1, Math.random()));
      const radius = 22 + Math.random() * 10;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      pos[i * 3 + 1] = Math.cos(phi) * radius + 3;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starfieldMat = new THREE.PointsMaterial({
      color: 0xf5e4c8,
      size: 0.055,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.starfield = new THREE.Points(geom, this.starfieldMat);
    this.scene.add(this.starfield);
  }

  /**
   * Final scene: a real 3D carousel — one large petal per Nahw topic,
   * arranged in a ring. The reader drags or uses arrows to rotate the ring;
   * the front-facing petal enlarges, lifts, and glows, and tapping it opens
   * that topic. This replaces any flat card-grid UI with an actual navigable
   * WebGL arrangement, matching "petals arranged in a way you navigate
   * through to see topics."
   */
  private createTopicCarousel() {
    this.carouselGroup = new THREE.Group();
    this.carouselGroup.visible = false;
    this.carouselGroup.position.set(0, this.flowerHeight - 0.4, 0);

    const n = NAHW_DEMO_TOPICS.length;
    const anglePerItem = (Math.PI * 2) / n;

    NAHW_DEMO_TOPICS.forEach((topic, i) => {
      const angle = i * anglePerItem;
      const geom = createRealisticPetalGeometry(
        1.1,
        1.5,
        0.3,
        0.2,
        new THREE.Color(0xffb04a),
        new THREE.Color(0x9c1420),
        (Math.random() - 0.5)
      );
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x8c1010),
        emissiveIntensity: 0.1,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(Math.sin(angle) * this.carouselRadius, 0, Math.cos(angle) * this.carouselRadius);
      mesh.rotation.y = angle;
      mesh.rotation.x = -0.25;
      this.carouselGroup.add(mesh);

      this.carouselPetals.push({ mesh, topic, angle });
    });

    this.scene.add(this.carouselGroup);
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
    this.mouseTarget.set(x * 0.35, y * 0.2);
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = (touch.clientX / window.innerWidth) * 2 - 1;
      const y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.mouseTarget.set(x * 0.35, y * 0.2);
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
    this.stageGroup.visible = true;
    this.godrayMesh.visible = true;
    this.floatingDust.visible = true;
    this.stormMesh.visible = true;

    this.keyLight.intensity = 3.4;
    this.rimLight.intensity = 2.2;
    this.ambientLight.intensity = 0.5;
    this.roseBloomLight.intensity = 2.0;
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

    this.carouselGroup.visible = false;
    this.carouselIndex = 0;
    this.carouselRotation = 0;
    this.carouselDragOffset = 0;
    this.lastFocusIndex = -1;
  }

  /** Called once the reader taps through the couplet blackout screen. */
  public enterTopicCarousel() {
    this.currentPhase = 'path';
    this.onPhaseChange?.('path');

    this.stageGroup.visible = false;
    this.earthGroup.visible = false;
    this.stemGroup.visible = false;
    this.sepalsGroup.visible = false;
    this.flowerGroup.visible = false;
    this.fallenPetalsGroup.visible = false;
    this.godrayMesh.visible = false;
    this.floatingDust.visible = false;
    this.stormMesh.visible = false;

    this.carouselGroup.visible = true;
    this.camera.position.set(0, this.flowerHeight - 0.4, 6.2);
  }

  /** Rotate the carousel by one topic in either direction. */
  public navigateCarousel(direction: 1 | -1) {
    this.carouselIndex += direction;
  }

  /** Live drag: deltaX in normalized screen units (-1..1 per full drag). */
  public dragCarousel(deltaRadians: number) {
    this.carouselDragging = true;
    this.carouselDragOffset += deltaRadians;
  }

  /** Snap to the nearest topic once the reader releases a drag. */
  public releaseCarouselDrag() {
    const anglePerItem = (Math.PI * 2) / this.carouselPetals.length;
    const steps = Math.round(this.carouselDragOffset / anglePerItem);
    this.carouselIndex -= steps;
    this.carouselDragOffset = 0;
    this.carouselDragging = false;
  }

  /** Raycast a screen-space NDC click against the carousel; returns the
   * topic only if the hit petal is currently front-and-focused. */
  public raycastCarousel(ndcX: number, ndcY: number): NahwDemoTopic | null {
    if (!this.carouselGroup.visible) return null;
    this.carouselRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const meshes = this.carouselPetals.map((p) => p.mesh);
    const hits = this.carouselRaycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const hitIndex = meshes.indexOf(hits[0].object as THREE.Mesh);
    if (hitIndex === this.lastFocusIndex) {
      return this.carouselPetals[hitIndex].topic;
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
            -9 - Math.random() * 4,
            this.flowerHeight + (Math.random() - 0.5) * 4.5,
            THREE.MathUtils.lerp(-2.5, 4.0, Math.random())
          );
          s.vel.set(3.5 + Math.random() * 5.0, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.0);
          s.rotVel.set((Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0);
          s.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        }
      }

      if (s.active) {
        const turb = this.sequenceTime * 1.8 + s.seed;
        s.pos.x += (s.vel.x + this.windStrength * 1.6) * delta;
        s.pos.y += (s.vel.y + Math.sin(turb) * 0.4) * delta;
        s.pos.z += (s.vel.z + Math.cos(turb * 0.8) * 0.3) * delta;
        s.rot.x += s.rotVel.x * delta;
        s.rot.y += s.rotVel.y * delta;
        s.rot.z += s.rotVel.z * delta;

        this.dummy.position.copy(s.pos);
        this.dummy.rotation.copy(s.rot);
        this.dummy.scale.setScalar(s.scale * gustEnvelope);
        this.dummy.updateMatrix();
        this.stormMesh.setMatrixAt(i, this.dummy.matrix);
        activeCount = i + 1;

        if (s.pos.x > 11) {
          s.active = false;
          s.spawnDelay = Math.random() * 0.4;
        }
      }
    }
    this.stormMesh.count = activeCount;
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private updateCarousel(delta: number) {
    const n = this.carouselPetals.length;
    const anglePerItem = (Math.PI * 2) / n;

    if (this.carouselDragging) {
      this.carouselRotation = -this.carouselIndex * anglePerItem + this.carouselDragOffset;
    } else {
      const target = -this.carouselIndex * anglePerItem;
      this.carouselRotation = THREE.MathUtils.lerp(this.carouselRotation, target, 1 - Math.pow(0.001, delta));
    }
    this.carouselGroup.rotation.y = this.carouselRotation;

    let focusIdx = -1;
    let minDist = Infinity;
    this.carouselPetals.forEach((cp, idx) => {
      const worldAngle = cp.angle + this.carouselRotation;
      let dist = worldAngle % (Math.PI * 2);
      if (dist > Math.PI) dist -= Math.PI * 2;
      if (dist < -Math.PI) dist += Math.PI * 2;
      const absDist = Math.abs(dist);
      if (absDist < minDist) {
        minDist = absDist;
        focusIdx = idx;
      }

      const frontFactor = Math.max(0, 1 - absDist / (anglePerItem * 1.4));
      const smoothFront = frontFactor * frontFactor * (3 - 2 * frontFactor);
      const scale = THREE.MathUtils.lerp(0.5, 1.4, smoothFront);
      cp.mesh.scale.setScalar(scale);
      cp.mesh.position.y = THREE.MathUtils.lerp(-0.3, 0.15, smoothFront);
      cp.mesh.rotation.x = THREE.MathUtils.lerp(-0.35, -0.05, smoothFront);
      const mat = cp.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(0.06, 0.42, smoothFront);
    });

    if (focusIdx !== this.lastFocusIndex) {
      this.lastFocusIndex = focusIdx;
      this.onCarouselFocusChange?.(focusIdx);
    }
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
      this.mouseCurrent.lerp(this.mouseTarget, 0.04);
      this.camera.position.x = this.mouseCurrent.x * 0.8;
      this.camera.position.y = this.flowerHeight - 0.4 + this.mouseCurrent.y * 0.4;
      this.camera.lookAt(0, this.flowerHeight - 0.4, 0);
      this.updateCarousel(delta);
      this.composer.render();
      return;
    }

    const orbitAngle = this.sequenceTime * 0.04;
    const orbitRadius = 7.0 - Math.min(this.sequenceTime * 0.035, 1.6);
    this.mouseCurrent.lerp(this.mouseTarget, 0.04);
    this.camera.position.x = Math.sin(orbitAngle) * orbitRadius + this.mouseCurrent.x * 1.1;
    this.camera.position.z = Math.cos(orbitAngle) * orbitRadius;
    this.camera.position.y = this.flowerHeight - 0.2 + this.mouseCurrent.y * 0.8;
    this.camera.lookAt(0, this.flowerHeight - 0.3, 0);

    // Stage 1: SPROUTING (0s -> 3.4s)
    if (this.sequenceTime < 3.4) {
      if (this.currentPhase !== 'sprouting') {
        this.currentPhase = 'sprouting';
        this.onPhaseChange?.('sprouting');
      }
      const sproutP = THREE.MathUtils.smoothstep(this.sequenceTime, 0.2, 3.2);
      this.stemMesh.scale.y = Math.max(0.01, sproutP);
      this.leavesGroup.scale.set(sproutP, sproutP, sproutP);
      const headY = sproutP * this.flowerHeight;
      this.flowerGroup.position.y = headY;
      this.sepalsGroup.position.y = headY;
      this.flowerGroup.rotation.z = Math.sin(this.sequenceTime * 2.2) * 0.03;
      this.flowerGroup.rotation.y = this.sequenceTime * 0.1;
      this.roseBloomLight.intensity = 1.1 * sproutP;
    }
    // Stage 2: BLOOMING (3.4s -> 7.4s)
    else if (this.sequenceTime < 7.4) {
      if (this.currentPhase !== 'blooming') {
        this.currentPhase = 'blooming';
        this.onPhaseChange?.('blooming');
      }
      this.stemMesh.scale.y = 1.0;
      this.leavesGroup.scale.set(1, 1, 1);
      this.flowerGroup.position.y = this.flowerHeight;
      this.sepalsGroup.position.y = this.flowerHeight;

      const bloomT = THREE.MathUtils.smoothstep(this.sequenceTime, 3.4, 7.1);
      for (const p of this.petals) {
        const layerDelay = (6 - p.layer) * 0.08;
        const petalProgress = THREE.MathUtils.clamp((bloomT - layerDelay) / 0.6, 0, 1);
        const smoothP = THREE.MathUtils.smoothstep(petalProgress, 0, 1);
        p.mesh.position.lerpVectors(p.budPos, p.bloomPos, smoothP);
        p.mesh.rotation.x = THREE.MathUtils.lerp(p.budRot.x, p.bloomRot.x, smoothP);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.budRot.y, p.bloomRot.y, smoothP);
        p.mesh.rotation.z = THREE.MathUtils.lerp(p.budRot.z, p.bloomRot.z, smoothP);
        p.mesh.scale.lerpVectors(p.budScale, p.bloomScale, smoothP);
      }
      for (let i = 0; i < this.sepalsGroup.children.length; i++) {
        this.sepalsGroup.children[i].rotation.x = THREE.MathUtils.lerp(0.12, 1.45, bloomT);
      }
      this.flowerGroup.rotation.y += 0.0025;
      this.roseBloomLight.intensity = 2.0 + Math.sin(this.sequenceTime * 3.0) * 0.3;
    }
    // Stage 3: EXPLODING & DENSE PETAL STORM (7.4s -> 12.5s)
    else if (this.sequenceTime < 12.5) {
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

      const explodeT = this.sequenceTime - 7.4;
      this.stemGroup.position.y = -explodeT * 1.2;
      this.sepalsGroup.position.y = this.flowerHeight - explodeT * 1.2;

      const gustEnvelope = Math.sin(THREE.MathUtils.clamp(explodeT / 5.1, 0, 1) * Math.PI);
      this.windStrength = gustEnvelope * 4.2;

      for (const p of this.petals) {
        p.velocity.x *= 0.985;
        p.velocity.z *= 0.985;
        p.velocity.y -= delta * 0.32;
        p.velocity.x += this.windStrength * delta;

        const turbTime = this.sequenceTime * 1.6 + p.turbulenceSeed;
        const swirlX = Math.sin(turbTime) * 0.02;
        const swirlZ = Math.cos(turbTime * 0.9) * 0.02;
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

      const dimFactor = THREE.MathUtils.clamp((explodeT - 1.5) / 3.4, 0, 1);
      this.keyLight.intensity = THREE.MathUtils.lerp(3.4, 0.1, dimFactor);
      this.rimLight.intensity = THREE.MathUtils.lerp(2.2, 0.1, dimFactor);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.5, 0.05, dimFactor);
      this.roseBloomLight.intensity = THREE.MathUtils.lerp(2.0, 0.1, dimFactor);
      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.03, dimFactor);
      }
      this.starfieldMat.opacity = dimFactor * 0.6;
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
      this.updatePetalStorm(delta, 0.12);
    }

    const dustPos = this.floatingDust.geometry.attributes.position;
    for (let i = 0; i < dustPos.count; i++) {
      let y = dustPos.getY(i) + delta * 0.1;
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

    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
