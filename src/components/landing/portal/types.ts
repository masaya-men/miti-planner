import * as THREE from 'three';

export interface PortalColors {
  cyan: THREE.Color;
  cyanGlow: THREE.Color;
  amber: THREE.Color;
  amberGlow: THREE.Color;
  bg: THREE.Color;
  text: THREE.Color;
}

export interface QualityPreset {
  particleCount: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  dofEnabled: boolean;
  chromaticAberrationEnabled: boolean;
  vignetteEnabled: boolean;
  geometryDetail: number;
  maxPixelRatio: number;
}

export const QUALITY_PRESETS: Record<'high' | 'medium' | 'low', QualityPreset> = {
  high: {
    particleCount: 500_000,
    bloomEnabled: true,
    bloomStrength: 1.2,
    bloomRadius: 0.6,
    dofEnabled: true,
    chromaticAberrationEnabled: true,
    vignetteEnabled: true,
    geometryDetail: 2,
    maxPixelRatio: 2,
  },
  medium: {
    particleCount: 200_000,
    bloomEnabled: true,
    bloomStrength: 0.9,
    bloomRadius: 0.4,
    dofEnabled: false,
    chromaticAberrationEnabled: false,
    vignetteEnabled: true,
    geometryDetail: 1,
    maxPixelRatio: 1.5,
  },
  low: {
    particleCount: 80_000,
    bloomEnabled: true,
    bloomStrength: 0.6,
    bloomRadius: 0.3,
    dofEnabled: false,
    chromaticAberrationEnabled: false,
    vignetteEnabled: false,
    geometryDetail: 0,
    maxPixelRatio: 1,
  },
};

export const PORTAL_CYAN_POS = new THREE.Vector3(-3.5, 0, -2);
export const PORTAL_AMBER_POS = new THREE.Vector3(3.5, 0, -2);
export const LOGO_POS = new THREE.Vector3(0, 1.8, -1);

export function getPortalColors(): PortalColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    cyan: new THREE.Color(get('--color-portal-cyan') || '#00D4FF'),
    cyanGlow: new THREE.Color(get('--color-portal-cyan') || '#00D4FF'),
    amber: new THREE.Color(get('--color-portal-amber') || '#FFB347'),
    amberGlow: new THREE.Color(get('--color-portal-amber') || '#FFB347'),
    bg: new THREE.Color(get('--color-lp-bg') || '#0F0F10'),
    text: new THREE.Color(get('--color-lp-text') || '#F0F0F0'),
  };
}
