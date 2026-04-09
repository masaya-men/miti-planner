import * as THREE from 'three';
import { PORTAL_CYAN_POS, PORTAL_AMBER_POS, type QualityPreset, type PortalColors } from './types';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPortalCyan;
  uniform vec3 uPortalAmber;
  uniform vec3 uColorCyan;
  uniform vec3 uColorAmber;
  uniform float uDpr;

  attribute float aRandom;
  attribute float aStream;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float t = uTime;

    float px = pos.x * 0.8;
    float py = pos.y * 0.8;
    pos.x += sin(py * 2.0 + t * 0.4 + aRandom * 6.28) * 0.08;
    pos.y += cos(px * 2.0 + t * 0.3 + aRandom * 3.14) * 0.08;
    pos.z += sin(px + py + t * 0.2) * 0.05;

    vec3 target;
    float attractStrength = 0.0;
    if (aStream > 1.5) {
      target = uPortalAmber;
      attractStrength = 0.15;
    } else if (aStream > 0.5) {
      target = uPortalCyan;
      attractStrength = 0.15;
    }

    if (attractStrength > 0.0) {
      vec3 toTarget = target - pos;
      float dist = length(toTarget);
      float influence = smoothstep(8.0, 1.0, dist);
      pos += normalize(toTarget) * influence * attractStrength * (1.0 + sin(t + aRandom * 6.28) * 0.3);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float size = (0.8 + aRandom * 0.6) * uDpr;
    gl_PointSize = size * (5.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);

    float distCyan = length(pos - uPortalCyan);
    float distAmber = length(pos - uPortalAmber);
    float cyanInfluence = smoothstep(5.0, 0.5, distCyan);
    float amberInfluence = smoothstep(5.0, 0.5, distAmber);

    vec3 baseColor = vec3(1.0);
    vColor = mix(baseColor, uColorCyan, cyanInfluence * 0.8);
    vColor = mix(vColor, uColorAmber, amberInfluence * 0.8);

    vAlpha = 0.15 + cyanInfluence * 0.5 + amberInfluence * 0.5;
    vAlpha = clamp(vAlpha, 0.1, 0.8);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = vAlpha * smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export interface ParticleSystem {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  dispose: () => void;
}

export function createParticleSystem(
  preset: QualityPreset,
  colors: PortalColors,
): ParticleSystem {
  const count = preset.particleCount;
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  const streams = new Float32Array(count);

  const spread = 12;
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 1.5 - 2;
    randoms[i] = Math.random();
    const r = Math.random();
    streams[i] = r < 0.3 ? 1.0 : r < 0.6 ? 2.0 : 0.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute('aStream', new THREE.BufferAttribute(streams, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPortalCyan: { value: PORTAL_CYAN_POS.clone() },
      uPortalAmber: { value: PORTAL_AMBER_POS.clone() },
      uColorCyan: { value: colors.cyan },
      uColorAmber: { value: colors.amber },
      uDpr: { value: Math.min(window.devicePixelRatio, preset.maxPixelRatio) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);

  return {
    points,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
