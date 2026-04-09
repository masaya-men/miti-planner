import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { QualityPreset } from './types';

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: 0.003 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float d = length(dir);
      vec2 offset = dir * d * uOffset;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDarkness: { value: 0.6 },
    uOffset: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uDarkness;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vignette = smoothstep(0.8, uOffset * 0.799, d * (uDarkness + uOffset));
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
};

export interface PostProcessingPipeline {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass | null;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

export async function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  preset: QualityPreset,
): Promise<PostProcessingPipeline> {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let bloomPass: UnrealBloomPass | null = null;
  if (preset.bloomEnabled) {
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    bloomPass = new UnrealBloomPass(resolution, preset.bloomStrength, preset.bloomRadius, 0.2);
    composer.addPass(bloomPass);
  }

  if (preset.dofEnabled) {
    const { BokehPass } = await import('three/examples/jsm/postprocessing/BokehPass.js');
    const bokehPass = new BokehPass(scene, camera, { focus: 8.0, aperture: 0.002, maxblur: 0.008 });
    composer.addPass(bokehPass);
  }

  if (preset.chromaticAberrationEnabled) {
    const caPass = new ShaderPass(ChromaticAberrationShader);
    composer.addPass(caPass);
  }

  if (preset.vignetteEnabled) {
    const vignettePass = new ShaderPass(VignetteShader);
    composer.addPass(vignettePass);
  }

  return {
    composer,
    bloomPass,
    resize: (w: number, h: number) => {
      composer.setSize(w, h);
    },
    dispose: () => {
      composer.passes.forEach(pass => {
        if ('dispose' in pass && typeof pass.dispose === 'function') pass.dispose();
      });
    },
  };
}
