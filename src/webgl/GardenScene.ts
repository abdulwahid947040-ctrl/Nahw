import * as THREE from 'three';
import { Flowmap } from './Flowmap';
import { ReliefScene } from './ReliefScene';
import { CloudyFogSystem } from './CloudyFog';
import { PollenSystem } from './PollenParticles';
import { GardenAudio } from './AudioAmbience';

export class GardenScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private audio: GardenAudio;

  // Immersive Garden Bas-Relief Systems
  private flowmap: Flowmap;
  private reliefScene: ReliefScene;
  private uTime = { value: 0 };
  private uResolution = { value: new THREE.Vector2() };

  // Atmospheric Systems (Luminous dust motes & gentle fog)
  private fogSystem!: CloudyFogSystem;
  private pollenSystem!: PollenSystem;

  // Lighting
  private directionalLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private pointerPos3D = new THREE.Vector3(0, 1.5, 2.0);

  // Interaction State
  private pointer = new THREE.Vector2(0.5, 0.5);
  private lastPointer = new THREE.Vector2(0.5, 0.5);
  private pointerVelocity = new THREE.Vector2(0, 0);
  private isPointerDown = false;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.2);
  private touchIntensity = 0;
  private touchStartY = 0;
  private lastSoundTime = 0;

  // Animation Loop
  private animFrameId: number | null = null;
  private clock = new THREE.Clock();
  private isDisposed = false;

  // Camera parallax targets
  private cameraTargetX = 0;
  private cameraTargetY = 2.8;

  constructor(container: HTMLElement, audio: GardenAudio) {
    this.container = container;
    this.audio = audio;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.uResolution.value.set(width, height);

    // 1. Three.js Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070206');
    this.scene.fog = new THREE.FogExp2('#070206', 0.026);

    // 2. Camera matching 36 deg FOV from Immersive Garden config
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 80);
    this.camera.position.set(0, 2.8, 14.5);
    this.camera.lookAt(0, 1.4, 0);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.container.appendChild(this.renderer.domElement);

    // 4. Immersive Garden Fluid Flowmap
    const noiseTex = new THREE.TextureLoader().load('/assets/webgl/mask-noise.png');
    noiseTex.wrapS = THREE.RepeatWrapping;
    noiseTex.wrapT = THREE.RepeatWrapping;

    this.flowmap = new Flowmap(this.renderer, {
      size: 512,
      falloff: 0.44,
      alpha: 1.35,
      dissipation: 0.965,
      tNoise: { value: noiseTex },
      uTime: this.uTime,
    });
    this.flowmap.aspect = aspect;

    // 5. Immersive Garden Bas-Relief 3D Canvas
    this.reliefScene = new ReliefScene(
      this.scene,
      this.flowmap.uniform,
      this.uTime,
      this.uResolution
    );

    // 6. Atmospheric Lighting & Systems
    this.setupLighting();
    this.setupAtmosphere();

    // 7. Event bindings
    this.bindEvents();

    // 8. Start rendering
    this.animate();
  }

  private setupLighting() {
    // Ambient light: deep, moody dark pink/magenta undertone
    this.ambientLight = new THREE.AmbientLight('#200a16', 0.85);
    this.scene.add(this.ambientLight);

    // Cinematic deep pink ambient directional light
    this.directionalLight = new THREE.DirectionalLight('#c7386d', 1.6);
    this.directionalLight.position.set(0, 5.0, -9.0);
    this.directionalLight.target.position.set(0, 1.2, 0);
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    // Architectural frontal key light (subdued warm alabaster-rose light carving 3D bas-relief)
    const frontKeyLight = new THREE.DirectionalLight('#e6a8bf', 1.2);
    frontKeyLight.position.set(4.0, 7.0, 7.0);
    this.scene.add(frontKeyLight);

    // Soft secondary fill light (deep muted wine/rose)
    const fillLight = new THREE.DirectionalLight('#5c1836', 0.55);
    fillLight.position.set(-6, 4, 6);
    this.scene.add(fillLight);
  }

  private setupAtmosphere() {
    this.fogSystem = new CloudyFogSystem(24, 34, 24);
    this.scene.add(this.fogSystem.group);

    this.pollenSystem = new PollenSystem(100, 32, 22);
    this.pollenSystem.points.visible = false;
  }

  private onPointerMove(clientX: number, clientY: number) {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // UV coordinates (0 to 1) for Flowmap simulation
    const uvX = clientX / width;
    const uvY = 1.0 - clientY / height;

    const dx = uvX - this.pointer.x;
    const dy = uvY - this.pointer.y;
    const speed = Math.sqrt(dx * dx + dy * dy);

    this.pointerVelocity.x = dx * 2.2;
    this.pointerVelocity.y = dy * 2.2;

    this.lastPointer.copy(this.pointer);
    this.pointer.set(uvX, uvY);

    // Update Flowmap inputs
    this.flowmap.mouse.copy(this.pointer);
    this.flowmap.velocity.copy(this.pointerVelocity);

    // Raycast onto relief plane for 3D light positioning
    const ndcX = (clientX / width) * 2 - 1;
    const ndcY = -(clientY / height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const hitPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) {
      this.pointerPos3D.set(hitPoint.x, hitPoint.y + 0.5, hitPoint.z + 1.4);
    }

    // Trigger subtle harmonic glass sound when sweeping across relief
    const now = performance.now();
    if (speed > 0.018 && now - this.lastSoundTime > 320) {
      this.audio.playFluidRipple(Math.min(1.0, speed * 12), uvX);
      this.lastSoundTime = now;
    }

    // Camera parallax target
    this.cameraTargetX = ndcX * 1.2;
    this.cameraTargetY = 2.8 + ndcY * 0.7;
  }

  private onPointerDown(clientX: number, clientY: number) {
    this.isPointerDown = true;
    this.touchIntensity = 1.2;
    this.audio.init();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const uvX = clientX / width;
    const uvY = 1.0 - clientY / height;

    // Concentric shockwave ripple pulse on click/tap!
    this.flowmap.triggerPulse(uvX, uvY, 1.35);

    // Resonant singing bowl chime
    this.audio.playFluidRipple(0.85, uvX);

    this.onPointerMove(clientX, clientY);
  }

  private onPointerUp() {
    this.isPointerDown = false;
  }

  private onWheel = (e: WheelEvent) => {
    this.reliefScene.scrollDelta(e.deltaY);
  };

  public setScrollProgress(progress: number) {
    this.reliefScene.setScrollProgress(progress);
  }

  private bindEvents() {
    const el = this.container;

    const handleMouseMove = (e: MouseEvent) => {
      this.onPointerMove(e.clientX, e.clientY);
    };

    const handleMouseDown = (e: MouseEvent) => {
      this.onPointerDown(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      this.onPointerUp();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const dy = this.touchStartY - touch.clientY;
        this.touchStartY = touch.clientY;
        this.reliefScene.scrollDelta(dy * 2.0);
        this.onPointerMove(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        this.touchStartY = e.touches[0].clientY;
        this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      this.onPointerUp();
    };

    const handleResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.uResolution.value.set(w, h);
      this.flowmap.aspect = w / h;
      this.reliefScene.update(0.016, w / h);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', handleResize);

    this.destroyHandlers = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
    };
  }

  private destroyHandlers: () => void = () => {};

  private animate = () => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();
    this.uTime.value = elapsedTime;

    // 1. Autonomous secondary idle flow (gentle shimmering current)
    const idleAngle = elapsedTime * 0.42;
    const idleX = 0.5 + Math.cos(idleAngle) * 0.28 + Math.sin(idleAngle * 2.1) * 0.12;
    const idleY = 0.5 + Math.sin(idleAngle * 1.3) * 0.22;
    this.flowmap.mouse2.set(idleX, idleY);
    this.flowmap.velocity2.set(
      Math.sin(idleAngle) * 0.007,
      Math.cos(idleAngle * 1.3) * 0.007
    );

    // Decay mouse velocity
    this.pointerVelocity.multiplyScalar(0.9);
    this.flowmap.velocity.copy(this.pointerVelocity);

    // 2. Update fluid flowmap simulation
    this.flowmap.update(delta);

    // 3. Smooth camera parallax
    this.camera.position.x += (this.cameraTargetX - this.camera.position.x) * 0.045;
    this.camera.position.y += (this.cameraTargetY - this.camera.position.y) * 0.045;
    this.camera.lookAt(0, 1.4, 0);

    // 4. Update sculpted bas-relief scene with smooth scrolling & aspect
    const aspect = this.uResolution.value.x / (this.uResolution.value.y || 1);
    this.reliefScene.update(delta, aspect);

    // 5. Update Atmospheric Systems
    this.touchIntensity = Math.max(0, this.touchIntensity - delta * 1.5);
    this.fogSystem.update(elapsedTime, this.touchIntensity, this.pointerPos3D);
    this.pollenSystem.update(elapsedTime, this.pointerPos3D, this.isPointerDown);

    // 6. Render main scene
    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.destroyHandlers();
    this.flowmap.destroy();
    this.reliefScene.destroy();
    this.scene.remove(this.fogSystem.group);
    this.scene.remove(this.pollenSystem.points);

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
