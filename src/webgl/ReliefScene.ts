import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { reliefVertexShader, reliefFragmentShader } from './ReliefShader';

export class ReliefScene {
  public group = new THREE.Group();
  private materials: THREE.ShaderMaterial[] = [];
  private texturesToDispose: THREE.Texture[] = [];
  private tMaskNoise: THREE.Texture | null = null;
  private tPlaster: THREE.Texture | null = null;
  private proceduralReliefMesh: THREE.Mesh | null = null;
  private gltfGroup: THREE.Group | null = null;

  // Vertical scrolling between sculptures
  private targetScrollY = 0;
  private currentScrollY = 0;
  private maxScrollY = 49.63 * 1.4; // Reach down to all 6 sculptures

  constructor(
    private scene: THREE.Scene,
    private flowmapTexture: { value: THREE.Texture | null },
    private uTime: { value: number },
    private uResolution: { value: THREE.Vector2 }
  ) {
    this.scene.add(this.group);
    this.loadTextures();
    this.createProceduralArchitecturalRelief();
    this.loadGlbRelief();
  }

  private loadTextures() {
    const textureLoader = new THREE.TextureLoader();

    this.tMaskNoise = textureLoader.load('/assets/webgl/mask-noise.png');
    this.tMaskNoise.wrapS = THREE.RepeatWrapping;
    this.tMaskNoise.wrapT = THREE.RepeatWrapping;
    this.texturesToDispose.push(this.tMaskNoise);

    this.tPlaster = textureLoader.load('/assets/webgl/plaster.jpg');
    this.tPlaster.wrapS = THREE.RepeatWrapping;
    this.tPlaster.wrapT = THREE.RepeatWrapping;
    this.texturesToDispose.push(this.tPlaster);
  }

  /**
   * Creates an intricate classical architectural stone frieze canvas.
   * Multi-layered RGB packing for level0..level5 relief height blending.
   */
  private createProceduralArchitecturalRelief() {
    const width = 34;
    const height = 24;
    const segX = 160;
    const segY = 120;
    const geom = new THREE.PlaneGeometry(width, height, segX, segY);
    const pos = geom.attributes.position;

    const bakeCanvas1 = document.createElement('canvas');
    bakeCanvas1.width = 1024;
    bakeCanvas1.height = 1024;
    const ctx1 = bakeCanvas1.getContext('2d')!;

    const bakeCanvas2 = document.createElement('canvas');
    bakeCanvas2.width = 1024;
    bakeCanvas2.height = 1024;
    const ctx2 = bakeCanvas2.getContext('2d')!;

    // Baseline architectural stone plane
    ctx1.fillStyle = '#2d2e33';
    ctx1.fillRect(0, 0, 1024, 1024);
    ctx2.fillStyle = '#36373e';
    ctx2.fillRect(0, 0, 1024, 1024);

    // Architectural recessed panel frames
    const drawPanel = (x: number, y: number, w: number, h: number) => {
      // Outer border molding
      ctx1.strokeStyle = '#a8abb4';
      ctx1.lineWidth = 14;
      ctx1.strokeRect(x, y, w, h);

      ctx2.strokeStyle = '#727580';
      ctx2.lineWidth = 22;
      ctx2.strokeRect(x + 4, y + 4, w - 8, h - 8);

      // Inner bevel recess
      ctx1.strokeStyle = '#5a5c64';
      ctx1.lineWidth = 8;
      ctx1.strokeRect(x + 18, y + 18, w - 36, h - 36);

      ctx2.fillStyle = '#40424a';
      ctx2.fillRect(x + 22, y + 22, w - 44, h - 44);
    };

    // Classical fluted pilaster grooves
    const drawFluting = (startX: number, startY: number, flutes: number, spacing: number, length: number) => {
      ctx1.lineWidth = 6;
      ctx1.strokeStyle = '#d0d4de';
      ctx2.lineWidth = 10;
      ctx2.strokeStyle = '#50535c';

      for (let i = 0; i < flutes; i++) {
        const cx = startX + i * spacing;
        ctx1.beginPath();
        ctx1.moveTo(cx, startY);
        ctx1.lineTo(cx, startY + length);
        ctx1.stroke();

        ctx2.beginPath();
        ctx2.moveTo(cx, startY);
        ctx2.lineTo(cx, startY + length);
        ctx2.stroke();
      }
    };

    // Medallion classical relief rosette
    const drawMedallion = (cx: number, cy: number, radius: number) => {
      // Outer ring
      ctx1.strokeStyle = '#f0f3fa';
      ctx1.lineWidth = 10;
      ctx1.beginPath();
      ctx1.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx1.stroke();

      ctx2.fillStyle = '#5c606a';
      ctx2.beginPath();
      ctx2.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
      ctx2.fill();

      // Fluted rays
      const rays = 16;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        const x1 = cx + Math.cos(ang) * radius * 0.3;
        const y1 = cy + Math.sin(ang) * radius * 0.3;
        const x2 = cx + Math.cos(ang) * radius * 0.82;
        const y2 = cy + Math.sin(ang) * radius * 0.82;

        ctx1.strokeStyle = '#c8ccd6';
        ctx1.lineWidth = 5;
        ctx1.beginPath();
        ctx1.moveTo(x1, y1);
        ctx1.lineTo(x2, y2);
        ctx1.stroke();
      }

      // Center boss - dark subtle stone indentation (no bright white orb)
      const boss = ctx1.createRadialGradient(cx, cy, 2, cx, cy, radius * 0.28);
      boss.addColorStop(0, '#22101b');
      boss.addColorStop(1, '#140810');
      ctx1.fillStyle = boss;
      ctx1.beginPath();
      ctx1.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
      ctx1.fill();
    };

    // Draw architectural frieze composition
    drawPanel(64, 80, 896, 864);
    drawPanel(120, 140, 784, 744);
    drawFluting(160, 200, 12, 28, 624);
    drawFluting(560, 200, 12, 28, 624);
    drawMedallion(512, 512, 140);
    drawMedallion(260, 512, 80);
    drawMedallion(764, 512, 80);

    const bakeTexture1 = new THREE.CanvasTexture(bakeCanvas1);
    const bakeTexture2 = new THREE.CanvasTexture(bakeCanvas2);
    bakeTexture1.wrapS = THREE.ClampToEdgeWrapping;
    bakeTexture1.wrapT = THREE.ClampToEdgeWrapping;
    bakeTexture2.wrapS = THREE.ClampToEdgeWrapping;
    bakeTexture2.wrapT = THREE.ClampToEdgeWrapping;
    this.texturesToDispose.push(bakeTexture1, bakeTexture2);

    // Subtle geometrical depth displacement on vertices
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) / width) + 0.5;
      const v = (pos.getY(i) / height) + 0.5;

      // Soft architectural panel relief
      const borderDist = Math.min(u, 1 - u, v, 1 - v);
      const frameHeight = Math.sin(borderDist * Math.PI) * 0.35;

      pos.setZ(i, frameHeight);
    }
    geom.computeVertexNormals();

    const mat = this.createShaderMaterial(bakeTexture1, bakeTexture2);
    this.proceduralReliefMesh = new THREE.Mesh(geom, mat);
    this.proceduralReliefMesh.position.set(0, 1.4, -1.6);
    this.group.add(this.proceduralReliefMesh);
  }

  private loadGlbRelief() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/gltf/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      '/assets/webgl/reliefs_low_compressed.glb',
      (gltf) => {
        const gltfScene = gltf.scene;

        gltfScene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const bakedMap = child.material?.map || null;
            const emissiveMap = child.material?.emissiveMap || bakedMap;

            // tBake1 = emissiveMap (level3..5), tBake2 = bakedMap (level0..2)
            const reliefMat = this.createShaderMaterial(emissiveMap, bakedMap);
            child.material = reliefMat;
            child.frustumCulled = false;
          }
        });

        // Scale and orient to fit camera vista
        const scale = 1.4;
        gltfScene.scale.set(scale, scale, scale);
        gltfScene.position.set(0, 1.4, -0.6);
        this.gltfGroup = gltfScene;
        this.group.add(gltfScene);

        // Position procedural mesh as background stone frieze wall
        if (this.proceduralReliefMesh) {
          this.proceduralReliefMesh.position.z = -1.8;
        }
      },
      undefined,
      (err) => {
        console.warn('GLTF relief load note:', err);
      }
    );
  }

  public scrollDelta(dy: number) {
    this.targetScrollY = Math.max(0, Math.min(this.maxScrollY, this.targetScrollY + dy * 0.008));
  }

  public setScrollProgress(progress: number) {
    this.targetScrollY = Math.max(0, Math.min(this.maxScrollY, progress * this.maxScrollY));
  }

  public scrollToSection(index: number) {
    const sectionOffsets = [0, 9.82, 20.04, 30.01, 40.35, 49.63];
    const clampedIndex = Math.max(0, Math.min(sectionOffsets.length - 1, index));
    this.targetScrollY = sectionOffsets[clampedIndex] * 1.4;
  }

  private createShaderMaterial(
    tBake1: THREE.Texture | null,
    tBake2: THREE.Texture | null
  ): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      vertexShader: reliefVertexShader,
      fragmentShader: reliefFragmentShader,
      uniforms: {
        uTime: this.uTime,
        uResolution: this.uResolution,
        uAspect: { value: 1.0 },
        uScreenScroll: { value: 0 },
        uScrollSpeed: { value: 0 },
        uFastScroll: { value: 0 },
        uOpacity: { value: 1.0 },
        uTextureStrength: { value: 0.90 },
        uGradientStrength: { value: 0.24 },
        uBrightnessFactor: { value: 0.85 },
        uBrightnessOffset: { value: 0.0 },
        tMaskNoise: { value: this.tMaskNoise },
        tPlaster: { value: this.tPlaster },
        tFlow: this.flowmapTexture,
        tBake1: { value: tBake1 },
        tBake2: { value: tBake2 },
      },
      side: THREE.DoubleSide,
      transparent: false,
    });

    this.materials.push(mat);
    return mat;
  }

  public update(delta: number, aspect: number) {
    // Smooth scrolling animation between sculptures
    const scrollSpeed = (this.targetScrollY - this.currentScrollY);
    this.currentScrollY += scrollSpeed * 0.08;

    if (this.gltfGroup) {
      this.gltfGroup.position.y = 1.4 + this.currentScrollY;
    }
    if (this.proceduralReliefMesh) {
      this.proceduralReliefMesh.position.y = 1.4 + (this.currentScrollY * 0.35) % 8.0;
    }

    for (const mat of this.materials) {
      if (mat.uniforms.uAspect) {
        mat.uniforms.uAspect.value = aspect;
      }
      if (mat.uniforms.uScreenScroll) {
        mat.uniforms.uScreenScroll.value = this.currentScrollY;
      }
      if (mat.uniforms.uScrollSpeed) {
        mat.uniforms.uScrollSpeed.value = scrollSpeed;
      }
    }
  }

  public destroy() {
    this.scene.remove(this.group);
    for (const tex of this.texturesToDispose) {
      tex.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    if (this.proceduralReliefMesh) {
      this.proceduralReliefMesh.geometry.dispose();
    }
  }
}
