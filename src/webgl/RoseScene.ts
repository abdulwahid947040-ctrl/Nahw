import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type RosePhase = 'sprouting' | 'blooming' | 'exploding' | 'darkness';

export interface NahwDemoTopic {
  id: string;
  titleArabic: string;
  category: string;
  meaning: string;
  exampleArabic: string;
  exampleUrdu: string;
}

export const NAHW_DEMO_TOPICS: NahwDemoTopic[] = [
  {
    id: 'fail',
    titleArabic: 'الفَاعِل',
    category: 'مَرْفُوعَات',
    meaning: 'The Subject / Doer',
    exampleArabic: 'قَامَ زَيْدٌ',
    exampleUrdu: 'فعل صادر کرنے والا، ہمیشہ مرفوع ہوتا ہے',
  },
  {
    id: 'maful',
    titleArabic: 'المَفْعُولُ بِهِ',
    category: 'مَنْصُوبَات',
    meaning: 'The Direct Object',
    exampleArabic: 'قَرَأَ الطَّالِبُ الكِتَابَ',
    exampleUrdu: 'جس پر فعل واقع ہو، ہمیشہ منصوب ہوتا ہے',
  },
  {
    id: 'mubtada-khabar',
    titleArabic: 'المُبْتَدَأ وَالخَبَر',
    category: 'جُمْلَہ اسْمِیَّہ',
    meaning: 'Subject & Predicate',
    exampleArabic: 'العِلْمُ نُورٌ',
    exampleUrdu: 'جملہ اسمیہ کے دو بنیادی ارکان، دونوں مرفوع',
  },
  {
    id: 'hal',
    titleArabic: 'الحَال',
    category: 'مَنْصُوبَات',
    meaning: 'The Circumstantial State',
    exampleArabic: 'جَاءَ زَيْدٌ رَاكِبًا',
    exampleUrdu: 'فاعل یا مفعول بہ کی کیفیت بیان کرنے والا اسم',
  },
  {
    id: 'tamyiz',
    titleArabic: 'التَّمْيِيز',
    category: 'مَنْصُوبَات',
    meaning: 'The Specification',
    exampleArabic: 'عِشْرُونَ دِرْهَمًا',
    exampleUrdu: 'مبہم عدد یا مقدار سے ابہام دور کرنے والا اسم',
  },
  {
    id: 'idhafah',
    titleArabic: 'الإِضَافَة',
    category: 'مَجْرُورَات',
    meaning: 'Genitive Construct',
    exampleArabic: 'كِتَابُ اللهِ',
    exampleUrdu: 'مضاف اور مضاف الیہ کا پاکیزہ نسبتی تعلق',
  },
  {
    id: 'huruf-jarr',
    titleArabic: 'حُرُوفُ الجَرّ',
    category: 'عَوَامِل',
    meaning: 'The Prepositions',
    exampleArabic: 'فِي المَسْجِدِ',
    exampleUrdu: 'سترہ وہ حروف جو بعد والے اسم کو کسرہ (جر) دیتے ہیں',
  },
  {
    id: 'naat',
    titleArabic: 'النَّعْت وَالمَنْعُوت',
    category: 'تَوَابِع',
    meaning: 'Adjective & Modified Noun',
    exampleArabic: 'رَجُلٌ كَرِيمٌ',
    exampleUrdu: 'موصوف کی صفت جو اعراب اور تعریف میں موافقت رکھے',
  },
];

export interface TrackedPetalInfo {
  index: number;
  topic: NahwDemoTopic;
  screenX: number; // 0..100%
  screenY: number; // 0..100%
  inView: boolean;
  opacity: number;
}

interface PetalData {
  mesh: THREE.Mesh;
  layer: number;
  petalIndex: number;
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
  topic?: NahwDemoTopic;
}

/**
 * Creates an organic, botanical 3D rose petal geometry with natural scalloped margins,
 * tapered claw attachment, transverse cupping, and reflexed curled lip.
 */
function createRealisticPetalGeometry(
  width: number,
  length: number,
  cupping: number,
  reflexCurl: number
): THREE.BufferGeometry {
  const segmentsU = 22;
  const segmentsV = 28;
  const geom = new THREE.PlaneGeometry(width, length, segmentsU, segmentsV);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    // Strictly clamp normalized coordinates to prevent precision edge underflows
    const rawU = Math.max(-1.0, Math.min(1.0, pos.getX(i) / (width * 0.5))); // -1.0 to 1.0
    const rawV = (pos.getY(i) + length * 0.5) / length;
    const v = Math.max(0.0, Math.min(1.0, rawV)); // strictly 0.0 (base) to 1.0 (tip)

    // Realistic rose petal outline profile:
    // Narrow claw at base (v=0), broad obovate body (v=0.65), notched heart apex (v=1.0)
    const sinBase = Math.max(0.0, Math.sin(v * Math.PI * 0.5));
    const baseTaper = Math.pow(sinBase, 0.7);
    const tipCurve = Math.max(0.0, Math.sin((1.0 - v) * Math.PI * 0.5));
    const profile = baseTaper * (0.3 + 0.7 * tipCurve);

    // Heart notch at apex
    const apexNotch = v > 0.85 ? Math.abs(rawU) * 0.15 * ((v - 0.85) / 0.15) : 0;

    // Organic wavy ruffled edges (subtle natural sinusoidal ripple along the rim)
    const edgeWave = Math.sin(v * 16.0) * Math.cos(rawU * 3.0) * (0.04 * Math.abs(rawU));

    const newX = rawU * (width * 0.5) * profile + edgeWave;
    const newY = pos.getY(i) + length * 0.5 - apexNotch;

    // Transverse cup: deep parabolic bowl in the lower center
    const cupBowl = -Math.cos(rawU * Math.PI * 0.5) * cupping * Math.sin(v * Math.PI);

    // Longitudinal S-curve: base curves in, apex flips backward (reflexed lip)
    const reflex = Math.pow(v, 2.6) * reflexCurl;

    // Central vein depression
    const centralVein = -Math.exp(-rawU * rawU * 12.0) * 0.04 * v;

    const newZ = cupBowl + reflex + centralVein;

    pos.setXYZ(i, newX, newY, newZ);
  }

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

  // Wind gust: drives the left-to-right petal-scatter transition
  private windStrength: number = 0;

  // Cinematic Lighting (Chiaroscuro + Celestial Godray)
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private silverMoonLight!: THREE.DirectionalLight;
  private roseBloomLight!: THREE.PointLight; // Inner flower glow point light
  private godrayMesh!: THREE.Mesh;

  // Scene Objects
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

  // Timing & Phase
  public currentPhase: RosePhase = 'sprouting';
  private sequenceTime: number = 0;
  public onPhaseChange?: (phase: RosePhase) => void;
  public onExplode?: () => void;
  public onDarkness?: () => void;
  public onUpdateTrackedPetals?: (petals: TrackedPetalInfo[]) => void;

  // Mouse / Touch Interaction
  private mouseTarget = new THREE.Vector2(0, 0);
  private mouseCurrent = new THREE.Vector2(0, 0);

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060107, 0.035);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 2.2, 5.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050106, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;

    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    // Cinematic post-processing: soft anime-style glow bloom on the emissive
    // petals & godray, matching the reference photography's luminous highlights.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.85, // strength
      0.55, // radius
      0.32  // threshold
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.setupLighting();
    this.createGodrayBeam();
    this.createSoilAndFallenPetals();
    this.createBotanicalStemAndLeaves();
    this.createBotanicalRosePetals();
    this.createAtmosphericGlowDust();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });

    this.animate();
  }

  /**
   * Set up cinematic lighting matching reference images:
   * Divine overhead godray, translucent backlit glow, and silver moonlight finale.
   */
  private setupLighting() {
    // 1. Soft Warm Ambient
    this.ambientLight = new THREE.AmbientLight(0x220a1c, 1.3);
    this.scene.add(this.ambientLight);

    // 2. Heavenly Top-Down Key Light (mimics golden sunlight shining through canopy)
    this.keyLight = new THREE.DirectionalLight(0xfff0dc, 3.4);
    this.keyLight.position.set(0.8, 7.5, 2.5);
    this.scene.add(this.keyLight);

    // 3. Glowing Magenta/Coral Backlit Rim Light (gives petals radiant glowing edges)
    this.rimLight = new THREE.DirectionalLight(0xff3366, 4.2);
    this.rimLight.position.set(-3.5, 4.0, -3.8);
    this.scene.add(this.rimLight);

    // 4. Subtle Cool Shadow Fill Light
    this.fillLight = new THREE.DirectionalLight(0x3a1440, 1.2);
    this.fillLight.position.set(-2.5, -0.5, 2.5);
    this.scene.add(this.fillLight);

    // 5. Point light at center of rose (illuminates petals from inside like translucent velvet)
    this.roseBloomLight = new THREE.PointLight(0xff3377, 2.8, 3.5);
    this.roseBloomLight.position.set(0, 2.3, 0);
    this.scene.add(this.roseBloomLight);

    // 6. Silver Moonlight Rim (activates during darkness phase for silver couplet)
    this.silverMoonLight = new THREE.DirectionalLight(0xdbeafe, 0.0);
    this.silverMoonLight.position.set(0, 5.0, -4.5);
    this.scene.add(this.silverMoonLight);
  }

  /**
   * Creates the divine vertical beam of godray light streaming from above,
   * exactly as seen in reference image dales916_pindown.io_1789481136.jpg!
   */
  private createGodrayBeam() {
    const geom = new THREE.CylinderGeometry(0.35, 2.8, 10.0, 32, 1, true);
    geom.translate(0, 4.2, 0);

    // Custom gradient alpha shader for the ethereal volumetric sunbeam
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
        // Vertical fade: bright at top center, soft fade toward flower and ground
        float vertFade = sin(vUv.y * 3.14159);
        vertFade = pow(vertFade, 1.3);

        // Soft rim falloff
        float rim = pow(1.0 - abs(dot(vNormal, vViewDir)), 1.5);

        // Subtle atmospheric dust shimmer
        float shimmer = 0.85 + 0.15 * sin(uTime * 1.5 + vUv.y * 8.0);

        vec3 beamColor = mix(vec3(1.0, 0.88, 0.72), vec3(1.0, 0.65, 0.78), vUv.y);
        float alpha = vertFade * (0.28 + 0.35 * rim) * uIntensity * shimmer;

        gl_FragColor = vec4(beamColor, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.godrayMesh = new THREE.Mesh(geom, mat);
    this.godrayMesh.position.set(0, 0, 0);
    this.scene.add(this.godrayMesh);
  }

  /**
   * Dark rich earthen mound with scattered fallen rose petals around base
   * (matching reference video 1 & image 1 where petals carpet the soil)
   */
  private createSoilAndFallenPetals() {
    // Rich, sculpted dark soil
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

    // Fallen petals on the soil bed (Video 1 & Image 1 realism)
    this.fallenPetalsGroup = new THREE.Group();
    const fallenPetalGeom = createRealisticPetalGeometry(0.55, 0.75, 0.25, 0.1);
    const fallenPetalMat = new THREE.MeshStandardMaterial({
      color: 0xdb446b,
      roughness: 0.55,
      metalness: 0.08,
      emissive: new THREE.Color(0x350616),
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });

    const numFallen = 32;
    for (let i = 0; i < numFallen; i++) {
      const mesh = new THREE.Mesh(fallenPetalGeom, fallenPetalMat);
      const angle = (i / numFallen) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 0.45 + Math.pow(Math.random(), 0.7) * 2.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.exp(-radius * 0.8) * 0.45 + 0.03;

      mesh.position.set(x, y, z);
      mesh.rotation.x = Math.PI * 0.5 + (Math.random() - 0.5) * 0.3;
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = (Math.random() - 0.5) * 0.4;
      const scale = 0.65 + Math.random() * 0.45;
      mesh.scale.set(scale, scale, scale);

      this.fallenPetalsGroup.add(mesh);
    }
    this.scene.add(this.fallenPetalsGroup);
  }

  /**
   * Botanical Rose Stem, sharp prickles (thorns), calyx sepals, and compound leaves!
   */
  private createBotanicalStemAndLeaves() {
    this.stemGroup = new THREE.Group();

    // S-curved natural stem
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, 0.55, 0.05),
      new THREE.Vector3(-0.06, 1.25, -0.03),
      new THREE.Vector3(0.03, 1.85, 0.02),
      new THREE.Vector3(0, 2.3, 0),
    ]);

    const stemGeom = new THREE.TubeGeometry(curve, 36, 0.042, 12, false);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x1c3a1b,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.stemMesh = new THREE.Mesh(stemGeom, stemMat);
    this.stemMesh.scale.set(1, 0.01, 1); // starts dormant inside soil
    this.stemGroup.add(this.stemMesh);

    // Sharp realistic thorns along stem
    const thornGeom = new THREE.ConeGeometry(0.028, 0.08, 8);
    thornGeom.translate(0, 0.04, 0);
    thornGeom.rotateZ(-Math.PI * 0.45); // curve downward like real rose thorns
    const thornMat = new THREE.MeshStandardMaterial({
      color: 0x4a1818,
      roughness: 0.5,
      metalness: 0.15,
    });

    const thornPositions = [
      { t: 0.22, angle: 0.4 },
      { t: 0.35, angle: 2.1 },
      { t: 0.48, angle: 3.8 },
      { t: 0.62, angle: 1.2 },
      { t: 0.74, angle: 4.6 },
      { t: 0.85, angle: 2.8 },
    ];

    thornPositions.forEach(({ t, angle }) => {
      const pos = curve.getPointAt(t);
      const thorn = new THREE.Mesh(thornGeom, thornMat);
      thorn.position.copy(pos);
      thorn.rotation.y = angle;
      this.stemGroup.add(thorn);
    });

    // Compound Rose Leaves (2 side branches with 3-5 serrated leaflets each)
    this.leavesGroup = new THREE.Group();
    const leafletGeom = createRealisticPetalGeometry(0.24, 0.48, 0.2, 0.05);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1e461c,
      roughness: 0.45,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    // Branch 1 (at height 0.95)
    const branch1 = new THREE.Group();
    branch1.position.copy(curve.getPointAt(0.42));
    branch1.rotation.y = 0.8;
    branch1.rotation.z = -0.45;

    // 3 leaflets
    const leafCenter1 = new THREE.Mesh(leafletGeom, leafMat);
    leafCenter1.position.set(0, 0.25, 0);
    branch1.add(leafCenter1);

    const leafLeft1 = new THREE.Mesh(leafletGeom, leafMat);
    leafLeft1.position.set(-0.12, 0.14, 0);
    leafLeft1.rotation.z = -0.55;
    leafLeft1.scale.set(0.8, 0.8, 0.8);
    branch1.add(leafLeft1);

    const leafRight1 = new THREE.Mesh(leafletGeom, leafMat);
    leafRight1.position.set(0.12, 0.14, 0);
    leafRight1.rotation.z = 0.55;
    leafRight1.scale.set(0.8, 0.8, 0.8);
    branch1.add(leafRight1);

    this.leavesGroup.add(branch1);

    // Branch 2 (at height 1.6)
    const branch2 = new THREE.Group();
    branch2.position.copy(curve.getPointAt(0.68));
    branch2.rotation.y = -1.9;
    branch2.rotation.z = 0.4;

    const leafCenter2 = new THREE.Mesh(leafletGeom, leafMat);
    leafCenter2.position.set(0, 0.22, 0);
    branch2.add(leafCenter2);

    const leafLeft2 = new THREE.Mesh(leafletGeom, leafMat);
    leafLeft2.position.set(-0.1, 0.12, 0);
    leafLeft2.rotation.z = -0.5;
    leafLeft2.scale.set(0.75, 0.75, 0.75);
    branch2.add(leafLeft2);

    const leafRight2 = new THREE.Mesh(leafletGeom, leafMat);
    leafRight2.position.set(0.1, 0.12, 0);
    leafRight2.rotation.z = 0.5;
    leafRight2.scale.set(0.75, 0.75, 0.75);
    branch2.add(leafRight2);

    this.leavesGroup.add(branch2);
    this.stemGroup.add(this.leavesGroup);
    this.scene.add(this.stemGroup);

    // Calyx Sepals (long, slender pointed sepals holding the base of the rose)
    const sepalGeom = createRealisticPetalGeometry(0.22, 0.85, 0.18, 0.15);
    const sepalMat = new THREE.MeshStandardMaterial({
      color: 0x22521f,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const sepal = new THREE.Mesh(sepalGeom, sepalMat);
      sepal.position.set(0, 2.3, 0);
      sepal.rotation.y = angle;
      sepal.rotation.x = 0.12;
      this.sepalsGroup.add(sepal);
    }
    this.scene.add(this.sepalsGroup);
  }

  /**
   * 52 Botanical Velvet Petals arranged in golden ratio whorls,
   * glowing with luminous pink-coral translucency.
   * 8 of the scattering petals will carry the Demo Topics of Nahw!
   */
  private createBotanicalRosePetals() {
    this.flowerGroup = new THREE.Group();
    this.flowerGroup.position.set(0, 2.3, 0);
    this.scene.add(this.flowerGroup);

    // 5 Architectural Layers for genuine botanical rose volume
    const layerConfigs = [
      // Layer 0: Spiral Bud Heart (tightly wrapped)
      { count: 6, width: 0.42, length: 0.72, cupping: 0.55, reflex: 0.05, dist: 0.04, budAngle: 0.12, bloomAngle: 0.42, yOff: 0.02, color: 0xff3862 },
      // Layer 1: Inner Whorl (interlocking swirl)
      { count: 8, width: 0.62, length: 0.92, cupping: 0.52, reflex: 0.12, dist: 0.1, budAngle: 0.18, bloomAngle: 0.78, yOff: -0.02, color: 0xff4d77 },
      // Layer 2: Mid Bloom (cupped bowl)
      { count: 11, width: 0.88, length: 1.18, cupping: 0.46, reflex: 0.22, dist: 0.2, budAngle: 0.22, bloomAngle: 1.15, yOff: -0.08, color: 0xff5e88 },
      // Layer 3: Flared Whorl (broad petals)
      { count: 13, width: 1.15, length: 1.42, cupping: 0.38, reflex: 0.35, dist: 0.3, budAngle: 0.28, bloomAngle: 1.55, yOff: -0.14, color: 0xff7298 },
      // Layer 4: Reflexed Guard Petals (large curling lip)
      { count: 14, width: 1.38, length: 1.65, cupping: 0.32, reflex: 0.52, dist: 0.42, budAngle: 0.32, bloomAngle: 1.95, yOff: -0.2, color: 0xff88aa },
    ];

    const goldenAngle = 137.5 * (Math.PI / 180);
    let totalPetalIndex = 0;
    let topicIndex = 0;

    layerConfigs.forEach((layerConf, layerIdx) => {
      const geom = createRealisticPetalGeometry(
        layerConf.width,
        layerConf.length,
        layerConf.cupping,
        layerConf.reflex
      );

      // Glowing velvet material with strong emissive inner translucency
      const petalMat = new THREE.MeshStandardMaterial({
        color: layerConf.color,
        roughness: 0.32,
        metalness: 0.08,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0xff2250),
        emissiveIntensity: 0.65, // Petal glow!
      });

      for (let i = 0; i < layerConf.count; i++) {
        const mesh = new THREE.Mesh(geom, petalMat);
        const theta = totalPetalIndex * goldenAngle;
        const currentIdx = totalPetalIndex;
        totalPetalIndex++;

        // Bud state
        const budX = Math.cos(theta) * (layerConf.dist * 0.22);
        const budZ = Math.sin(theta) * (layerConf.dist * 0.22);
        const budPos = new THREE.Vector3(budX, layerConf.yOff, budZ);
        const budRot = new THREE.Euler(layerConf.budAngle, theta, 0, 'YXZ');
        const budScale = new THREE.Vector3(0.48, 0.58, 0.48);

        // Bloomed state
        const bloomX = Math.cos(theta) * layerConf.dist;
        const bloomZ = Math.sin(theta) * layerConf.dist;
        const bloomPos = new THREE.Vector3(bloomX, layerConf.yOff, bloomZ);
        const bloomRot = new THREE.Euler(
          layerConf.bloomAngle,
          theta,
          (Math.random() - 0.5) * 0.15,
          'YXZ'
        );
        const bloomScale = new THREE.Vector3(1.0, 1.0, 1.0);

        // Explosion velocity: radial scatter + upward buoyancy
        const burstSpeed = 1.8 + Math.random() * 2.8;
        const burstAngle = theta + (Math.random() - 0.5) * 0.4;
        const upwardSpeed = 0.8 + Math.random() * 2.4;

        const velocity = new THREE.Vector3(
          Math.cos(burstAngle) * burstSpeed,
          upwardSpeed,
          Math.sin(burstAngle) * burstSpeed
        );

        const rotVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 4.2,
          (Math.random() - 0.5) * 4.2,
          (Math.random() - 0.5) * 4.2
        );

        // Assign one of the 8 Nahw demo topics to selected petals in outer and mid layers
        let assignedTopic: NahwDemoTopic | undefined = undefined;
        if (layerIdx >= 2 && topicIndex < NAHW_DEMO_TOPICS.length && i % 3 === 0) {
          assignedTopic = NAHW_DEMO_TOPICS[topicIndex];
          topicIndex++;
        }

        mesh.position.copy(budPos);
        mesh.rotation.copy(budRot);
        mesh.scale.copy(budScale);

        this.flowerGroup.add(mesh);

        this.petals.push({
          mesh,
          layer: layerIdx,
          petalIndex: currentIdx,
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
          topic: assignedTopic,
        });
      }
    });
  }

  /**
   * Atmospheric floating golden particles and sparkling glints (Videos 3, 5)
   */
  private createAtmosphericGlowDust() {
    // 1. Warm golden dust motes inside the godray
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

    // 2. Sparkling glowing glints that dance across petals
    const sparkleCount = 180;
    const sparkleGeom = new THREE.BufferGeometry();
    const sparklePos = new Float32Array(sparkleCount * 3);

    for (let i = 0; i < sparkleCount; i++) {
      sparklePos[i * 3] = (Math.random() - 0.5) * 2.0;
      sparklePos[i * 3 + 1] = 2.3 + (Math.random() - 0.5) * 1.5;
      sparklePos[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
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

    // Reset stem and sepals
    this.stemMesh.scale.set(1, 0.01, 1);
    this.stemGroup.position.set(0, 0, 0);
    this.flowerGroup.position.set(0, 0, 0);
    this.sepalsGroup.position.set(0, 0, 0);

    // Reset lights
    this.keyLight.intensity = 3.4;
    this.rimLight.intensity = 4.2;
    this.ambientLight.intensity = 1.3;
    this.roseBloomLight.intensity = 2.8;
    this.silverMoonLight.intensity = 0.0;
    if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
      this.godrayMesh.material.uniforms.uIntensity.value = 1.0;
    }

    // Reset petals to bud state
    for (const p of this.petals) {
      p.mesh.visible = true;
      p.mesh.position.copy(p.budPos);
      p.mesh.rotation.copy(p.budRot);
      p.mesh.scale.copy(p.budScale);
      p.scatterPos.copy(p.bloomPos);
      p.scatterRot.copy(p.bloomRot);
    }
  }

  private animate = () => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.sequenceTime += delta;

    // Update godray shader uniform
    if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
      this.godrayMesh.material.uniforms.uTime.value = this.sequenceTime;
    }

    // Smooth camera mouse parallax
    this.mouseCurrent.lerp(this.mouseTarget, 0.04);
    this.camera.position.x = this.mouseCurrent.x * 1.6;
    this.camera.position.y = 2.2 + this.mouseCurrent.y * 0.8;
    this.camera.lookAt(0, 2.0, 0);

    // ==========================================
    // CINEMATIC TIMELINE STAGES
    // ==========================================

    // Stage 1: SPROUTING (0s -> 3.2s)
    if (this.sequenceTime < 3.2) {
      if (this.currentPhase !== 'sprouting') {
        this.currentPhase = 'sprouting';
        this.onPhaseChange?.('sprouting');
      }

      const sproutP = THREE.MathUtils.smoothstep(this.sequenceTime, 0.2, 3.0);
      this.stemMesh.scale.y = Math.max(0.01, sproutP);
      this.leavesGroup.scale.set(sproutP, sproutP, sproutP);

      const headY = sproutP * 2.3;
      this.flowerGroup.position.y = headY;
      this.sepalsGroup.position.y = headY;

      // Gentle organic growth sway
      this.flowerGroup.rotation.z = Math.sin(this.sequenceTime * 2.2) * 0.035;
      this.flowerGroup.rotation.y = this.sequenceTime * 0.12;

      // Petal glow starts soft
      this.roseBloomLight.intensity = 1.2 * sproutP;
    }

    // Stage 2: BLOOMING (3.2s -> 6.6s)
    else if (this.sequenceTime < 6.6) {
      if (this.currentPhase !== 'blooming') {
        this.currentPhase = 'blooming';
        this.onPhaseChange?.('blooming');
      }

      this.stemMesh.scale.y = 1.0;
      this.leavesGroup.scale.set(1, 1, 1);
      this.flowerGroup.position.y = 2.3;
      this.sepalsGroup.position.y = 2.3;

      const bloomT = THREE.MathUtils.smoothstep(this.sequenceTime, 3.2, 6.3);

      // Unfurl petals layer by layer (outer layers first, then inner layers open)
      for (const p of this.petals) {
        const layerDelay = (4 - p.layer) * 0.1;
        const petalProgress = THREE.MathUtils.clamp((bloomT - layerDelay) / 0.65, 0, 1);
        const smoothP = THREE.MathUtils.smoothstep(petalProgress, 0, 1);

        p.mesh.position.lerpVectors(p.budPos, p.bloomPos, smoothP);
        p.mesh.rotation.x = THREE.MathUtils.lerp(p.budRot.x, p.bloomRot.x, smoothP);
        p.mesh.rotation.y = THREE.MathUtils.lerp(p.budRot.y, p.bloomRot.y, smoothP);
        p.mesh.rotation.z = THREE.MathUtils.lerp(p.budRot.z, p.bloomRot.z, smoothP);
        p.mesh.scale.lerpVectors(p.budScale, p.bloomScale, smoothP);
      }

      // Sepals peel back outward
      for (let i = 0; i < this.sepalsGroup.children.length; i++) {
        const sepal = this.sepalsGroup.children[i];
        sepal.rotation.x = THREE.MathUtils.lerp(0.12, 1.45, bloomT);
      }

      // Blooming flower breathing rotation
      this.flowerGroup.rotation.y += 0.003;
      this.roseBloomLight.intensity = 2.8 + Math.sin(this.sequenceTime * 3.0) * 0.4;
    }

    // Stage 3: EXPLODING & PETAL SCATTER (6.6s -> 10.0s)
    else if (this.sequenceTime < 10.0) {
      if (this.currentPhase !== 'exploding') {
        this.currentPhase = 'exploding';
        this.onPhaseChange?.('exploding');
        this.onExplode?.();

        // Capture initial world scatter positions
        for (const p of this.petals) {
          const worldPos = new THREE.Vector3();
          p.mesh.getWorldPosition(worldPos);
          p.scatterPos.copy(worldPos);
          p.scatterRot.copy(p.mesh.rotation);
        }
      }

      const explodeT = this.sequenceTime - 6.6;

      // Stem and calyx sink back down gracefully into the earth
      this.stemGroup.position.y = -explodeT * 1.3;
      this.sepalsGroup.position.y = 2.3 - explodeT * 1.3;

      // Gust of wind sweeping in from the left: ramps up fast, then eases off,
      // pushing scattered petals rightward as a directional "wind carries them" beat.
      const gustEnvelope = Math.sin(THREE.MathUtils.clamp(explodeT / 2.6, 0, 1) * Math.PI);
      this.windStrength = gustEnvelope * 3.4;

      // Petal flight physics with glowing trail and turbulence
      for (const p of this.petals) {
        p.velocity.x *= 0.98;
        p.velocity.z *= 0.98;
        p.velocity.y -= delta * 0.38; // slow gravity
        p.velocity.x += this.windStrength * delta; // leftward gust pushes petals right

        const turbTime = this.sequenceTime * 1.6 + p.turbulenceSeed;
        const swirlX = Math.sin(turbTime) * 0.016;
        const swirlZ = Math.cos(turbTime * 0.9) * 0.016;
        const gustSwirl = Math.sin(turbTime * 2.2) * gustEnvelope * 0.03;

        p.scatterPos.x += p.velocity.x * delta + swirlX;
        p.scatterPos.y += p.velocity.y * delta + gustSwirl;
        p.scatterPos.z += p.velocity.z * delta + swirlZ;

        p.scatterRot.x += p.rotVelocity.x * delta;
        p.scatterRot.y += p.rotVelocity.y * delta;
        p.scatterRot.z += p.rotVelocity.z * delta;

        // Ground collision
        if (p.scatterPos.y < 0.06) {
          p.scatterPos.y = 0.06;
          p.velocity.y = 0;
          p.velocity.x *= 0.75;
          p.velocity.z *= 0.75;
        }

        const localPos = p.scatterPos.clone().sub(this.flowerGroup.position);
        p.mesh.position.copy(localPos);
        p.mesh.rotation.copy(p.scatterRot);
      }

      // Dim daylight lights toward dramatic midnight chiaroscuro
      const dimFactor = THREE.MathUtils.clamp((explodeT - 0.8) / 2.2, 0, 1);
      this.keyLight.intensity = THREE.MathUtils.lerp(3.4, 0.4, dimFactor);
      this.rimLight.intensity = THREE.MathUtils.lerp(4.2, 0.35, dimFactor);
      this.ambientLight.intensity = THREE.MathUtils.lerp(1.3, 0.15, dimFactor);
      this.roseBloomLight.intensity = THREE.MathUtils.lerp(2.8, 0.5, dimFactor);
      this.silverMoonLight.intensity = THREE.MathUtils.lerp(0.0, 2.6, dimFactor);

      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.15, dimFactor);
      }
    }

    // Stage 4: DEEP DARKNESS & SHINING SILVER COUPLET (10.0s+)
    else {
      if (this.currentPhase !== 'darkness') {
        this.currentPhase = 'darkness';
        this.onPhaseChange?.('darkness');
        this.onDarkness?.();
      }

      // Midnight atmosphere with radiant silver moonlight
      this.keyLight.intensity = 0.3;
      this.rimLight.intensity = 0.25;
      this.ambientLight.intensity = 0.12;
      this.silverMoonLight.intensity = 2.8;
      this.roseBloomLight.intensity = 0.6;

      if (this.godrayMesh.material instanceof THREE.ShaderMaterial) {
        this.godrayMesh.material.uniforms.uIntensity.value = 0.12;
      }

      // Petals drift with zero-gravity elegance
      for (const p of this.petals) {
        if (p.scatterPos.y > 0.12) {
          p.scatterPos.y -= delta * 0.07;
          p.scatterRot.y += 0.006;
          p.scatterRot.x += 0.003;
        }

        const localPos = p.scatterPos.clone().sub(this.flowerGroup.position);
        p.mesh.position.copy(localPos);
        p.mesh.rotation.copy(p.scatterRot);
      }
    }

    // Track petals with assigned Nahw topics and project to 2D screen coordinates
    if (this.onUpdateTrackedPetals) {
      const trackedList: TrackedPetalInfo[] = [];
      const tempVec = new THREE.Vector3();

      for (const p of this.petals) {
        if (p.topic) {
          p.mesh.getWorldPosition(tempVec);

          // Project 3D coordinate to 2D screen NDC [-1..1]
          tempVec.project(this.camera);

          const screenX = ((tempVec.x + 1) * 0.5) * 100;
          const screenY = ((-tempVec.y + 1) * 0.5) * 100;
          const inView = tempVec.z < 1.0 && screenX >= 5 && screenX <= 95 && screenY >= 5 && screenY <= 95;

          // Fade in during explosion & darkness
          const topicOpacity =
            this.sequenceTime >= 7.2
              ? Math.min(1.0, (this.sequenceTime - 7.2) / 1.5)
              : 0;

          trackedList.push({
            index: p.petalIndex,
            topic: p.topic,
            screenX,
            screenY,
            inView,
            opacity: topicOpacity,
          });
        }
      }

      this.onUpdateTrackedPetals(trackedList);
    }

    // Dust & sparkles drift
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
