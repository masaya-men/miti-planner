import * as THREE from 'three';
import { PORTAL_CYAN_POS, PORTAL_AMBER_POS, type QualityPreset, type PortalColors } from './types';

const fresnelVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fresnelFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
    fresnel = pow(fresnel, 2.5);
    float alpha = fresnel * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface GeoObject {
  mesh: THREE.Mesh | THREE.LineSegments;
  update: (time: number) => void;
}

export interface GeometryGroup {
  group: THREE.Group;
  objects: GeoObject[];
  dispose: () => void;
}

function createWireframeObject(
  geometry: THREE.BufferGeometry,
  color: THREE.Color,
  position: THREE.Vector3,
  scale: number,
  rotationSpeed: THREE.Vector3,
): GeoObject {
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
  const wireframe = new THREE.LineSegments(edges, lineMat);

  const fresnelMat = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: { uColor: { value: color }, uOpacity: { value: 0.6 } },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const solid = new THREE.Mesh(geometry, fresnelMat);

  const group = new THREE.Group();
  group.add(wireframe);
  group.add(solid);
  group.position.copy(position);
  group.scale.setScalar(scale);

  return {
    mesh: wireframe,
    update: (time: number) => {
      group.rotation.x += rotationSpeed.x;
      group.rotation.y += rotationSpeed.y;
      group.rotation.z += rotationSpeed.z;
      group.position.y = position.y + Math.sin(time * 0.5 + position.x) * 0.15;
    },
  };
}

export function createGeometryGroup(
  preset: QualityPreset,
  colors: PortalColors,
): { cyan: GeometryGroup; amber: GeometryGroup } {
  const detail = preset.geometryDetail;

  // Cyan side: sharp, angular shapes
  const cyanGroup = new THREE.Group();
  const cyanObjects: GeoObject[] = [];

  const icosaGeo = new THREE.IcosahedronGeometry(0.8, detail);
  const octoGeo = new THREE.OctahedronGeometry(0.5, detail);

  const ico = createWireframeObject(icosaGeo, colors.cyan,
    new THREE.Vector3(PORTAL_CYAN_POS.x - 0.8, PORTAL_CYAN_POS.y + 1.2, PORTAL_CYAN_POS.z - 0.5),
    1.0, new THREE.Vector3(0.003, 0.005, 0.002));
  const octo = createWireframeObject(octoGeo, colors.cyan,
    new THREE.Vector3(PORTAL_CYAN_POS.x + 1.0, PORTAL_CYAN_POS.y - 0.8, PORTAL_CYAN_POS.z + 0.3),
    0.8, new THREE.Vector3(0.004, 0.003, 0.005));

  cyanGroup.add(ico.mesh.parent!);
  cyanGroup.add(octo.mesh.parent!);
  cyanObjects.push(ico, octo);

  // Amber side: rounded, soft shapes
  const amberGroup = new THREE.Group();
  const amberObjects: GeoObject[] = [];

  const torusGeo = new THREE.TorusGeometry(0.6, 0.2, 8 + detail * 4, 16 + detail * 8);
  const sphereGeo = new THREE.SphereGeometry(0.45, 8 + detail * 4, 8 + detail * 4);

  const torus = createWireframeObject(torusGeo, colors.amber,
    new THREE.Vector3(PORTAL_AMBER_POS.x + 0.8, PORTAL_AMBER_POS.y + 1.0, PORTAL_AMBER_POS.z - 0.3),
    1.0, new THREE.Vector3(0.004, 0.003, 0.001));
  const sphere = createWireframeObject(sphereGeo, colors.amber,
    new THREE.Vector3(PORTAL_AMBER_POS.x - 1.0, PORTAL_AMBER_POS.y - 0.7, PORTAL_AMBER_POS.z + 0.5),
    0.9, new THREE.Vector3(0.002, 0.004, 0.003));

  amberGroup.add(torus.mesh.parent!);
  amberGroup.add(sphere.mesh.parent!);
  amberObjects.push(torus, sphere);

  const disposeGroup = (objects: GeoObject[]) => {
    objects.forEach(o => {
      const g = o.mesh.parent as THREE.Group;
      g.children.forEach(c => {
        if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
    });
  };

  return {
    cyan: { group: cyanGroup, objects: cyanObjects, dispose: () => { icosaGeo.dispose(); octoGeo.dispose(); disposeGroup(cyanObjects); } },
    amber: { group: amberGroup, objects: amberObjects, dispose: () => { torusGeo.dispose(); sphereGeo.dispose(); disposeGroup(amberObjects); } },
  };
}
