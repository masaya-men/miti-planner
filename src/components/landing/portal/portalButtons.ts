import * as THREE from 'three';
import { PORTAL_CYAN_POS, PORTAL_AMBER_POS, type PortalColors } from './types';

export type PortalType = 'cyan' | 'amber';

export interface PortalButtonState {
  hovered: PortalType | null;
}

export interface PortalButtons {
  cyanGroup: THREE.Group;
  amberGroup: THREE.Group;
  state: PortalButtonState;
  raycast: (mouse: THREE.Vector2, camera: THREE.PerspectiveCamera) => PortalType | null;
  update: (time: number) => void;
  dispose: () => void;
}

function createPortalSphere(
  color: THREE.Color,
  position: THREE.Vector3,
): { group: THREE.Group; hitMesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.copy(position);

  const hitGeo = new THREE.SphereGeometry(1.2, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  group.add(hitMesh);

  const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);

  const light = new THREE.PointLight(color, 2, 6);
  group.add(light);

  return { group, hitMesh };
}

export function createPortalButtons(colors: PortalColors): PortalButtons {
  const cyanPortal = createPortalSphere(colors.cyan, PORTAL_CYAN_POS);
  const amberPortal = createPortalSphere(colors.amber, PORTAL_AMBER_POS);

  const raycaster = new THREE.Raycaster();
  const state: PortalButtonState = { hovered: null };

  let cyanHoverT = 0;
  let amberHoverT = 0;

  return {
    cyanGroup: cyanPortal.group,
    amberGroup: amberPortal.group,
    state,
    raycast: (mouse: THREE.Vector2, camera: THREE.PerspectiveCamera): PortalType | null => {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.intersectObject(cyanPortal.hitMesh).length > 0) return 'cyan';
      if (raycaster.intersectObject(amberPortal.hitMesh).length > 0) return 'amber';
      return null;
    },
    update: (time: number) => {
      const cyanTarget = state.hovered === 'cyan' ? 1 : 0;
      const amberTarget = state.hovered === 'amber' ? 1 : 0;
      cyanHoverT += (cyanTarget - cyanHoverT) * 0.08;
      amberHoverT += (amberTarget - amberHoverT) * 0.08;

      cyanPortal.group.scale.setScalar(1 + cyanHoverT * 0.2);
      amberPortal.group.scale.setScalar(1 + amberHoverT * 0.2);

      const cyanLight = cyanPortal.group.children[2] as THREE.PointLight;
      const amberLight = amberPortal.group.children[2] as THREE.PointLight;
      cyanLight.intensity = 2 + cyanHoverT * 3 + Math.sin(time * 3) * 0.5;
      amberLight.intensity = 2 + amberHoverT * 3 + Math.sin(time * 3 + 1) * 0.5;

      const cyanGlow = cyanPortal.group.children[1] as THREE.Mesh;
      const amberGlow = amberPortal.group.children[1] as THREE.Mesh;
      (cyanGlow.material as THREE.MeshBasicMaterial).opacity = 0.3 + cyanHoverT * 0.4;
      (amberGlow.material as THREE.MeshBasicMaterial).opacity = 0.3 + amberHoverT * 0.4;

      cyanPortal.group.position.y = PORTAL_CYAN_POS.y + Math.sin(time * 0.7) * 0.1;
      amberPortal.group.position.y = PORTAL_AMBER_POS.y + Math.sin(time * 0.7 + 2) * 0.1;
    },
    dispose: () => {
      [cyanPortal, amberPortal].forEach(p => {
        p.group.children.forEach(c => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            (c.material as THREE.Material).dispose();
          }
        });
      });
    },
  };
}
