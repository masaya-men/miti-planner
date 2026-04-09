import { QUALITY_PRESETS, type QualityPreset } from './types';

export type TierName = 'high' | 'medium' | 'low';

export function detectTier(): TierName {
  if (typeof window === 'undefined') return 'low';
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  if (isMobile) return 'low';
  if (isTablet) return 'medium';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
        const lowEnd = /intel|mesa|swiftshader|llvmpipe/i.test(renderer);
        if (lowEnd) return 'medium';
      }
    }
  } catch { /* ignore */ }
  return 'high';
}

export function getQualityPreset(tier?: TierName): QualityPreset {
  return QUALITY_PRESETS[tier ?? detectTier()];
}

export function createFpsMonitor(currentTier: TierName) {
  let frameCount = 0;
  let lastTime = performance.now();
  let lowFpsFrames = 0;
  return {
    tick(): TierName | null {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastTime = now;
        if (fps < 30) {
          lowFpsFrames++;
          if (lowFpsFrames >= 3) {
            if (currentTier === 'high') return 'medium';
            if (currentTier === 'medium') return 'low';
          }
        } else {
          lowFpsFrames = 0;
        }
      }
      return null;
    },
  };
}
