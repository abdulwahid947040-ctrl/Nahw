import * as THREE from 'three';

/**
 * Procedural texture for glowing pollen spores / light motes
 */
function createPollenTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.2, 'rgba(255, 225, 238, 0.65)');
  gradient.addColorStop(0.5, 'rgba(220, 175, 195, 0.15)');
  gradient.addColorStop(0.8, 'rgba(150, 110, 130, 0.02)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export class PollenSystem {
  public points: THREE.Points;
  private particleCount: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private originalPos: Float32Array;
  private phases: Float32Array;
  private sizes: Float32Array;
  private colors: Float32Array;

  // Touch burst particles
  private burstGeom: THREE.BufferGeometry;
  private burstPoints: THREE.Points;
  private burstPositions: Float32Array;
  private burstVelocities: Float32Array;
  private burstLifetimes: Float32Array;
  private burstCount: number = 200;
  private nextBurstIndex: number = 0;

  constructor(count: number = 750, areaWidth: number = 32, areaDepth: number = 24) {
    this.particleCount = count;
    const geom = new THREE.BufferGeometry();

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.originalPos = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    this.sizes = new Float32Array(count);
    this.colors = new Float32Array(count * 3);

    const baseColor1 = new THREE.Color('#f092b8'); // Rose mote
    const baseColor2 = new THREE.Color('#d45d8b'); // Deep pink dust
    const baseColor3 = new THREE.Color('#7a264e'); // Wine slate mote

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * areaWidth;
      const y = 0.2 + Math.random() * 5.0;
      const z = (Math.random() - 0.5) * areaDepth;

      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;

      this.originalPos[i3] = x;
      this.originalPos[i3 + 1] = y;
      this.originalPos[i3 + 2] = z;

      this.velocities[i3] = (Math.random() - 0.5) * 0.006;
      this.velocities[i3 + 1] = 0.003 + Math.random() * 0.007; // gentle upward float
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.006;

      this.phases[i] = Math.random() * Math.PI * 2;
      this.sizes[i] = 1.2 + Math.random() * 2.8;

      const pick = Math.random();
      const c = pick < 0.6 ? baseColor1 : pick < 0.85 ? baseColor2 : baseColor3;
      this.colors[i3] = c.r;
      this.colors[i3 + 1] = c.g;
      this.colors[i3 + 2] = c.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const texture = createPollenTexture();

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geom, mat);

    // Set up Burst particles
    this.burstPositions = new Float32Array(this.burstCount * 3);
    this.burstVelocities = new Float32Array(this.burstCount * 3);
    this.burstLifetimes = new Float32Array(this.burstCount);

    for (let i = 0; i < this.burstCount; i++) {
      this.burstLifetimes[i] = 0;
      this.burstPositions[i * 3 + 1] = -100; // hide initially
    }

    this.burstGeom = new THREE.BufferGeometry();
    this.burstGeom.setAttribute('position', new THREE.BufferAttribute(this.burstPositions, 3));

    const burstMat = new THREE.PointsMaterial({
      size: 0.16,
      map: texture,
      color: new THREE.Color('#d45d8b'),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.burstPoints = new THREE.Points(this.burstGeom, burstMat);
    this.burstPoints.visible = false;
  }

  public triggerBurst(_origin: THREE.Vector3, _count: number = 35) {
    // Disabled to prevent unwanted glowing orb/burst on touch
  }

  public update(time: number, touchPoint: THREE.Vector3, touchActive: boolean) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = pos.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Natural curl noise swirl
      const px = posArr[i3];
      const py = posArr[i3 + 1];
      const pz = posArr[i3 + 2];

      const swirlX = Math.sin(time * 0.6 + py * 1.2 + this.phases[i]) * 0.007;
      const swirlZ = Math.cos(time * 0.5 + px * 0.8 + this.phases[i]) * 0.007;
      const floatY = this.velocities[i3 + 1] + Math.sin(time + this.phases[i]) * 0.002;

      posArr[i3] += swirlX;
      posArr[i3 + 1] += floatY;
      posArr[i3 + 2] += swirlZ;

      // React to pointer / touch
      if (touchActive) {
        const dx = px - touchPoint.x;
        const dy = py - touchPoint.y;
        const dz = pz - touchPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 16.0 && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const push = (1.0 - dist / 4.0) * 0.03;
          posArr[i3] += (dx / dist) * push;
          posArr[i3 + 1] += (dy / dist) * push * 0.6;
          posArr[i3 + 2] += (dz / dist) * push;
        }
      }

      // Wrap around bounds
      if (posArr[i3 + 1] > 6.5) {
        posArr[i3 + 1] = 0.1;
        posArr[i3] = this.originalPos[i3] + (Math.random() - 0.5) * 4.0;
        posArr[i3 + 2] = this.originalPos[i3 + 2] + (Math.random() - 0.5) * 4.0;
      }
    }
    pos.needsUpdate = true;

    // Update burst particles
    let burstActive = false;
    for (let i = 0; i < this.burstCount; i++) {
      if (this.burstLifetimes[i] > 0) {
        burstActive = true;
        const i3 = i * 3;
        this.burstLifetimes[i] -= 0.018;

        this.burstPositions[i3] += this.burstVelocities[i3];
        this.burstPositions[i3 + 1] += this.burstVelocities[i3 + 1];
        this.burstPositions[i3 + 2] += this.burstVelocities[i3 + 2];

        // Gravity & air drag
        this.burstVelocities[i3] *= 0.96;
        this.burstVelocities[i3 + 1] = this.burstVelocities[i3 + 1] * 0.96 - 0.001;
        this.burstVelocities[i3 + 2] *= 0.96;

        if (this.burstLifetimes[i] <= 0) {
          this.burstPositions[i3 + 1] = -100;
        }
      }
    }

    if (burstActive) {
      this.burstGeom.attributes.position.needsUpdate = true;
    }
  }
}
