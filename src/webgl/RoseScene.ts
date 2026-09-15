import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type RosePhase = 'sprouting' | 'blooming' | 'exploding' | 'blackout';

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

/**
 * Builds one botanical rose-petal surface: a scalloped obovate outline,
 * a transverse cupped bowl, a reflexed (curled-back) tip, and a soft central
 * vein — then bakes a base-to-tip vertex-color gradient so every petal reads
 * as translucent velvet instead of a single flat color. `asymmetry` biases
 * the outline left/right and varies the ruffle phase per call so no two
 * petals built from the same layer look identical (real rose petals aren't
 * symmetric clones of each other).
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

    // Skewed U: shifts the outline left/right for natural asymmetry
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

    // Base-to-tip color gradient with a touch of edge darkening (real petals
    // are lighter near the claw and richer/more saturated toward the rim).
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

  // Wind gust: drives the left-to-right petal-storm sweep
  private windStrength: number = 0;

  // Cinematic Lighting (Chiaroscuro + Celestial Godray)
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private silverMoonLight!: THREE.DirectionalLight;
  private roseBloomLight!: THREE.PointLight;
  private godrayMesh!: THREE.Mesh;

  // Scene Objects
  private gardenGroup: THREE.Group = new THREE.Group();
  private earthGroup: THREE.Group = new THREE.Group();
  private stemGroup: THREE.Group = new THREE.Group();
  private stemMesh!: THREE.Mesh;
  private leavesGroup: THREE.Group = new THREE.Group();
  private sepalsGroup: THREE.Group = new THREE.Group();
  private flowerGroup: THREE.Group = new THREE.Group();
  private fallenPetalsGroup: THREE.Group = new THREE.Group();
  private petals: PetalData[] = [];
  private floatingDust!: THREE.Points;
  private sparkleDust!: THREE.Points;
  private starfield!: THREE.Points;
  private starfieldMat!: THREE.PointsMaterial;

  // Dense petal storm (instanced, spawned during the exploding phase so the
  // screen fills edge-to-edge with wind-blown petals, not just the ~140
  // petals that made up the flower head).
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

  public readonly flowerHeight = 3.15; // where the bloom sits (bigger, denser rose)

  // Timing & Phase
  public currentPhase: RosePhase = 'sprouting';
  private sequenceTime: number = 0;
  public onPhaseChange?: (phase: RosePhase) => void;
  public onExplode?: () => void;
  public onBlackout?: () => void;

  // Mouse / Touch Interaction
  private mouseTarget = new THREE.Vector2(0, 0);
  private mouseCurrent = new THREE.Vector2(0, 0);

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060107, 0.03);

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
    this.renderer.setClearColor(0x050106, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    // Restrained highlight-only glow — only genuine bright spots (godray
    // core, moonlight, hottest rim light) bloom, not the whole frame.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.38, 0.82);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.setupLighting();
    this.createGardenBackdrop();
    this.createGodrayBeam();
    this.createSoilAndFallenPetals();
    this.createBotanicalStemAndLeaves();
    this.createBotanicalRosePetals();
    this.createPetalStorm();
    this.createAtmosphericGlowDust();
    this.createStarfield();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });

    this.animate();
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x1a0815, 0.55);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0dc, 3.2);
    this.keyLight.position.set(0.8, 7.5, 2.5);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xff3366, 3.6);
    this.rimLight.position.set(-3.5, 4.0, -3.8);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0x3a1440, 1.0);
    this.fillLight.position.set(-2.5, -0.5, 2.5);
    this.scene.add(this.fillLight);

    this.roseBloomLight = new THREE.PointLight(0xff3377, 2.4, 4.2);
    this.roseBloomLight.position.set(0, this.flowerHeight, 0);
    this.scene.add(this.roseBloomLight);

    this.silverMoonLight = new THREE.DirectionalLight(0xdbeafe, 0.0);
    this.silverMoonLight.position.set(0, 5.0, -4.5);
    this.scene.add(this.silverMoonLight);
  }

  /** Jungle/garden backdrop ringing the scene so the rose sits inside a garden. */
  private createGardenBackdrop() {
    this.gardenGroup = new THREE.Group();
    const foliageColors = [0x0c2410, 0x123018, 0x0a1c0d, 0x162f14];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 });

    const ringCount = 22;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 + Math.random() * 0.2;
      const radius = 9.5 + Math.random() * 5.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const trunkHeight = 3.5 + Math.random() * 3.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, trunkHeight, 6), trunkMat);
      trunk.position.set(x, trunkHeight / 2 - 0.35, z);
      this.gardenGroup.add(trunk);

      const foliageColor = foliageColors[i % foliageColors.length];
      const foliageMat = new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.85,
        flatShading: true,
      });
      const canopyClusters = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < canopyClusters; c++) {
        const s = 1.4 + Math.random() * 1.6;
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), foliageMat);
        blob.position.set(
          x + (Math.random() - 0.5) * 1.6,
          trunkHeight + Math.random() * 1.2,
          z + (Math.random() - 0.5) * 1.6
        );
        blob.rotation.set(Math.random(), Math.random(), Math.random());
        this.gardenGroup.add(blob);
      }
    }

    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x14330f, roughness: 0.85, flatShading: true });
    const hedgeCount = 30;
    for (let i = 0; i < hedgeCount; i++) {
      const angle = (i / hedgeCount) * Math.PI * 2 + Math.random() * 0.15;
      const radius = 6.8 + Math.random() * 1.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const s = 0.5 + Math.random() * 0.6;
      const hedge = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), hedgeMat);
      hedge.position.set(x, s * 0.6, z);
      this.gardenGroup.add(hedge);
    }

    this.scene.add(this.gardenGroup);
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
        vec3 beamColor = mix(vec3(1.0, 0.88, 0.72), vec3(1.0, 0.65, 0.78), vUv.y);
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
    const earthGeom = new THREE.CylinderGeometry(6.5, 8.0, 0.7, 40);
    const pos = earthGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.1) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        const mound = Math.exp(-r * 0.8) * 0.45;
        const noise = Math.sin(x * 2.8) * Math.cos(z * 2.8) * 0.08;
        pos.setY(i, y + mound + noise);
      }
    }
    earthGeom.computeVertexNormals();

    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x110710,
      roughness: 0.95,
      metalness: 0.04,
      flatShading: true,
    });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthMesh.position.y = -0.35;
    this.earthGroup.add(earthMesh);
    this.scene.add(this.earthGroup);

    this.fallenPetalsGroup = new THREE.Group();
    const fallenPetalGeom = createRealisticPetalGeometry(
      0.6,
      0.82,
      0.25,
      0.1,
      new THREE.Color(0xffb3c6),
      new THREE.Color(0xc21e3a)
    );
    const fallenPetalMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      clearcoat: 0.4,
      metalness: 0.02,
      emissive: new THREE.Color(0x350616),
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide,
    });

    const numFallen = 34;
    for (let i = 0; i < numFallen; i++) {
      const mesh = new THREE.Mesh(fallenPetalGeom, fallenPetalMat);
      const angle = (i / numFallen) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 0.6 + Math.pow(Math.random(), 0.7) * 3.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.exp(-radius * 0.8) * 0.45 + 0.03;

      mesh.position.set(x, y, z);
      mesh.rotation.x = Math.PI * 0.5 + (Math.random() - 0.5) * 0.3;
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = (Math.random() - 0.5) * 0.4;
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
    const thornPositions = [
      { t: 0.22, angle: 0.4 },
      { t: 0.35, angle: 2.1 },
      { t: 0.48, angle: 3.8 },
      { t: 0.62, angle: 1.2 },
      { t: 0.74, angle: 4.6 },
      { t: 0.85, angle: 2.8 },
    ];
    thornPositions.forEach(({ t, angle }) => {
      const p = curve.getPointAt(t);
      const thorn = new THREE.Mesh(thornGeom, thornMat);
      thorn.position.copy(p);
      thorn.rotation.y = angle;
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
    const leafMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

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
   * Dense, real botanical rose head: seven architectural whorls (spiral bud
   * heart through large reflexed guard petals) at golden-angle phyllotaxis,
   * ~150 individually-built petals (each with its own asymmetric geometry —
   * not clones) so the bloom reads as a genuine dense rose, not a repeated
   * pattern. Scaled up so the flower fills a large portion of the frame.
   */
  private createBotanicalRosePetals() {
    this.flowerGroup = new THREE.Group();
    this.flowerGroup.position.set(0, this.flowerHeight, 0);
    this.flowerGroup.scale.setScalar(1.45); // big, dense bloom
    this.scene.add(this.flowerGroup);

    const warmBase = new THREE.Color(0xfff1d9);
    const petalTip = new THREE.Color(0xd81b3f);
    const deepTip = new THREE.Color(0x8c0f28);

    const layerConfigs = [
      { count: 5, width: 0.34, length: 0.58, cupping: 0.58, reflex: 0.03, dist: 0.03, budAngle: 0.1, bloomAngle: 0.35, yOff: 0.02, tip: petalTip },
      { count: 7, width: 0.5, length: 0.78, cupping: 0.54, reflex: 0.1, dist: 0.08, budAngle: 0.16, bloomAngle: 0.65, yOff: -0.01, tip: petalTip },
      { count: 10, width: 0.7, length: 1.0, cupping: 0.48, reflex: 0.18, dist: 0.16, budAngle: 0.2, bloomAngle: 0.95, yOff: -0.06, tip: petalTip },
      { count: 14, width: 0.92, length: 1.22, cupping: 0.42, reflex: 0.28, dist: 0.25, budAngle: 0.24, bloomAngle: 1.25, yOff: -0.11, tip: deepTip },
      { count: 18, width: 1.12, length: 1.42, cupping: 0.36, reflex: 0.4, dist: 0.35, budAngle: 0.28, bloomAngle: 1.55, yOff: -0.16, tip: deepTip },
      { count: 22, width: 1.3, length: 1.6, cupping: 0.3, reflex: 0.5, dist: 0.46, budAngle: 0.32, bloomAngle: 1.85, yOff: -0.21, tip: deepTip },
      { count: 26, width: 1.46, length: 1.75, cupping: 0.24, reflex: 0.58, dist: 0.58, budAngle: 0.36, bloomAngle: 2.1, yOff: -0.26, tip: deepTip },
    ];

    const goldenAngle = 137.5 * (Math.PI / 180);
    let totalPetalIndex = 0;

    layerConfigs.forEach((layerConf) => {
      for (let i = 0; i < layerConf.count; i++) {
        const seed = Math.random() - 0.5;
        const jitter = () => 0.9 + Math.random() * 0.2;

        // Each petal gets its own asymmetric, slightly-jittered geometry —
        // a real rose never has two identical petals.
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
          roughness: 0.36,
          metalness: 0.02,
          clearcoat: 0.55,
          clearcoatRoughness: 0.28,
          sheen: 1.0,
          sheenColor: new THREE.Color(0xffc7d6),
          sheenRoughness: 0.6,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(0xff1744),
          emissiveIntensity: 0.14,
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
   * fill the frame close to the camera — this is the "screen full of only
   * petals" moment, distinct from the ~150 petals that made up the flower.
   */
  private createPetalStorm() {
    const stormGeom = createRealisticPetalGeometry(
      0.5,
      0.68,
      0.3,
      0.15,
      new THREE.Color(0xffd0da),
      new THREE.Color(0xc21e3a)
    );
    const stormMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.4,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xff1744),
      emissiveIntensity: 0.1,
    });

    this.stormMesh = new THREE.InstancedMesh(stormGeom, stormMat, this.stormCount);
    this.stormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh.count = 0; // grows as petals spawn
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
      // fully hide inactive instances
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.stormMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private createAtmosphericGlowDust() {
    const count = 450;
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
      color: 0xffe6c2,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    this.floatingDust = new THREE.Points(geom, mat);
    this.scene.add(this.floatingDust);

    const sparkleCount = 180;
    const sparkleGeom = new THREE.BufferGeometry();
    const sparklePos = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      sparklePos[i * 3] = (Math.random() - 0.5) * 2.4;
      sparklePos[i * 3 + 1] = this.flowerHeight + (Math.random() - 0.5) * 1.8;
      sparklePos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    }
    sparkleGeom.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
    const sparkleMat = new THREE.PointsMaterial({
      color: 0xffaacc,
      size: 0.05,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    this.sparkleDust = new THREE.Points(sparkleGeom, sparkleMat);
    this.scene.add(this.sparkleDust);
  }

  private createStarfield() {
    const count = 900;
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
      color: 0xdbeafe,
      size: 0.06,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.starfield = new THREE.Points(geom, this.starfieldMat);
    this.scene.add(this.starfield);
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
    this.flowerGroup.position.set(0, 0, 0);
    this.sepalsGroup.position.set(0, 0, 0);

    this.keyLight.intensity = 3.2;
    this.rimLight.intensity = 3.6;
    this.ambientLight.intensity = 0.55;
    this.roseBloomLight.intensity = 2.4;
    this.silverMoonLight.intensity = 0.0;
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
  }

  private updatePetalStorm(delta: number, gustEnvelope: number) {
    let activeCount = 0;
    for (let i = 0; i < this.stormCount; i++) {
      const s = this.stormData[i];

      if (!s.active) {
        s.spawnDelay -= delta;
        if (s.spawnDelay <= 0) {
          s.active = true;
          // Spawn from the left, at varied depth (near camera to far) so the
          // storm has volume and some petals loom large in frame.
          s.pos.set(
            -9 - Math.random() * 4,
            this.flowerHeight + (Math.random() - 0.5) * 4.5,
            THREE.MathUtils.lerp(-2.5, 4.0, Math.random())
          );
          s.vel.set(3.5 + Math.random() * 5.0, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.0);
          s.rotVel.set(
            (Math.random() - 0.5) * 5.0,
            (Math.random() - 0.5) * 5.0,
            (Math.random() - 0.5) * 5.0
          );
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

        // Recycle once well past the camera so the storm can keep flowing
        if (s.pos.x > 11) {
          s.active = false;
          s.spawnDelay = Math.random() * 0.4;
        }
      }
    }
    this.stormMesh.count = activeCount;
    this.stormMesh.instanceMatrix.needsUpdate = true;
  }

  private animate = () => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.sequenceTime += delta;

    if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
      this.godrayMesh.material.uniforms.uTime.value = this.sequenceTime;
    }

    // Slow cinematic orbit + dolly layered under mouse parallax
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
      this.roseBloomLight.intensity = 2.4 + Math.sin(this.sequenceTime * 3.0) * 0.35;
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

      // Wind gust envelope: ramps up, holds strong through the storm's peak,
      // then eases — this drives both the flower's own scattered petals and
      // the dense instanced petal storm together.
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

      // Dim daylight toward darkness as the storm peaks and passes
      const dimFactor = THREE.MathUtils.clamp((explodeT - 1.5) / 3.4, 0, 1);
      this.keyLight.intensity = THREE.MathUtils.lerp(3.2, 0.15, dimFactor);
      this.rimLight.intensity = THREE.MathUtils.lerp(3.6, 0.15, dimFactor);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.55, 0.06, dimFactor);
      this.roseBloomLight.intensity = THREE.MathUtils.lerp(2.4, 0.2, dimFactor);
      this.silverMoonLight.intensity = THREE.MathUtils.lerp(0.0, 1.6, dimFactor);
      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.05, dimFactor);
      }
      this.starfieldMat.opacity = dimFactor * 0.7;
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
      this.silverMoonLight.intensity = 0;
      this.roseBloomLight.intensity = 0;
      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = 0;
      }
      this.starfieldMat.opacity = 0;
      this.windStrength *= 0.9;
      this.updatePetalStorm(delta, 0.15);
    }

    const dustPos = this.floatingDust.geometry.attributes.position;
    for (let i = 0; i < dustPos.count; i++) {
      let y = dustPos.getY(i) + delta * 0.12;
      if (y > 7.5) y = 0.1;
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
