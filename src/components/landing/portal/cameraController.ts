import * as THREE from 'three';

export interface CameraController {
  camera: THREE.PerspectiveCamera;
  update: (time: number) => void;
  onMouseMove: (e: MouseEvent) => void;
  onResize: () => void;
  dispose: () => void;
}

export function createCameraController(): CameraController {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.5, 8);
  camera.lookAt(0, 0.5, -2);

  let mouseX = 0;
  let mouseY = 0;
  let smoothMouseX = 0;
  let smoothMouseY = 0;

  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  const onMouseMove = (e: MouseEvent) => {
    if (isTouchDevice) return;
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };

  const update = (time: number) => {
    smoothMouseX += (mouseX - smoothMouseX) * 0.03;
    smoothMouseY += (mouseY - smoothMouseY) * 0.03;

    const orbitSpeed = 0.04;
    const orbitRadius = 8;
    const orbitX = Math.sin(time * orbitSpeed) * orbitRadius * 0.15;
    const orbitZ = 8 + Math.cos(time * orbitSpeed) * orbitRadius * 0.08;
    const driftZ = Math.sin(time * 0.08) * 0.5;
    const mouseOffsetX = smoothMouseX * 0.8;
    const mouseOffsetY = smoothMouseY * 0.4;

    camera.position.set(orbitX + mouseOffsetX, 1.5 + mouseOffsetY, orbitZ + driftZ);
    camera.lookAt(0, 0.5, -2);
  };

  return { camera, update, onMouseMove, onResize, dispose: () => {} };
}
