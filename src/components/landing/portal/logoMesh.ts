import * as THREE from 'three';
import { LOGO_POS, type PortalColors } from './types';

export interface LogoMesh {
  mesh: THREE.Mesh;
  update: (time: number) => void;
  dispose: () => void;
}

function createLogoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#F0F0F0';
  ctx.font = '900 90px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LoPo', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createLogoMesh(colors: PortalColors): LogoMesh {
  void colors; // reserved for future dual-color lighting
  const texture = createLogoTexture();
  const aspect = 512 / 128;
  const height = 1.0;
  const width = height * aspect;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(LOGO_POS);

  return {
    mesh,
    update: (time: number) => {
      mesh.position.y = LOGO_POS.y + Math.sin(time * 0.6) * 0.1;
      mesh.rotation.y = Math.sin(time * 0.15) * 0.05;
    },
    dispose: () => { texture.dispose(); geometry.dispose(); material.dispose(); },
  };
}
