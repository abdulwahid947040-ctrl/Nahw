import * as THREE from 'three';

/**
 * Generates a soft procedural cloud/mist texture with multi-octave radial falloff
 */
function createCloudTexture(): THREE.CanvasTexture {
  const size = 256;
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

  gradient.addColorStop(0, 'rgba(180, 50, 100, 0.20)');
  gradient.addColorStop(0.3, 'rgba(110, 28, 65, 0.09)');
  gradient.addColorStop(0.7, 'rgba(50, 12, 30, 0.02)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add subtle organic softness
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.0) {
        // Soft atmospheric perturbation
        const noise = (Math.sin(x * 0.08) * Math.cos(y * 0.08) + Math.sin((x + y) * 0.05)) * 0.15;
        data[idx + 3] = Math.max(0, Math.min(255, Math.floor(data[idx + 3] * (1.0 + noise))));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class CloudyFogSystem {
  public group: THREE.Group;
  private clouds: {
    mesh: THREE.Mesh;
    speedX: number;
    speedZ: number;
    rotSpeed: number;
    baseOpacity: number;
    baseScale: number;
  }[] = [];

  constructor(count: number = 32, areaWidth: number = 35, areaDepth: number = 25) {
    this.group = new THREE.Group();
    const texture = createCloudTexture();

    const cloudMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: new THREE.Color('#250b18'), // dark subtle wine mist
    });

    const geom = new THREE.PlaneGeometry(12, 12);

    for (let i = 0; i < count; i++) {
      const mat = cloudMaterial.clone();
      const mesh = new THREE.Mesh(geom, mat);

      const x = (Math.random() - 0.5) * areaWidth;
      const y = 0.5 + Math.random() * 3.5;
      const z = (Math.random() - 0.5) * areaDepth - 5;

      mesh.position.set(x, y, z);
      // Orient cloud plane roughly toward camera or horizontal
      mesh.rotation.x = -Math.PI * 0.15 + (Math.random() - 0.5) * 0.2;
      mesh.rotation.z = Math.random() * Math.PI * 2;

      const baseScale = 0.8 + Math.random() * 1.4;
      mesh.scale.set(baseScale, baseScale, baseScale);

      const baseOpacity = 0.015 + Math.random() * 0.025;
      mat.opacity = baseOpacity;
      mat.color.set('#200a16');

      this.group.add(mesh);
      this.clouds.push({
        mesh,
        speedX: (Math.random() - 0.5) * 0.004,
        speedZ: (Math.random() - 0.5) * 0.003,
        rotSpeed: (Math.random() - 0.5) * 0.001,
        baseOpacity,
        baseScale,
      });
    }
  }

  public update(time: number, _touchIntensity: number, _lightPos: THREE.Vector3) {
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      // Gentle, subtle background drift - unaffected by touching
      c.mesh.position.x += c.speedX + Math.sin(time * 0.2 + i) * 0.001;
      c.mesh.position.z += c.speedZ + Math.cos(time * 0.2 + i) * 0.001;
      c.mesh.rotation.z += c.rotSpeed * 0.5;

      // Maintain very faint constant opacity (no glowing on touch or pointer)
      const mat = c.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = c.baseOpacity;
    }
  }
}
