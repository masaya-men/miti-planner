import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThemeStore } from '../store/useThemeStore';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uRes;
  uniform int uTheme;
  uniform float uSpeed;
  uniform float uBlobSz;
  uniform float uBr;
  uniform vec2 uMouse;
  uniform float uScroll;

  varying vec2 vUv;

  vec2 organicPos(float t, float ox, float oy, float rng, float f1, float f2, float ph) {
    float x = ox
      + sin(t*f1 + ph)*rng
      + sin(t*f2*1.618 + ph*1.3)*rng*0.3
      + cos(t*f2*0.382 + ph*0.7)*rng*0.12;
    float y = oy
      + cos(t*f1*0.7 + ph)*rng*0.75
      + cos(t*f2*1.2 + ph*0.9)*rng*0.25
      + sin(t*f2*0.5 + ph*1.1)*rng*0.1;
    return vec2(x, y);
  }

  float blob(vec2 uv, vec2 c, float r) {
    float d = length(uv - c);
    return exp(-d*d / (2.0*r*r));
  }

  void main() {
    float ar = uRes.x / uRes.y;
    vec2 uv = vUv;
    uv.x *= ar;

    // スクロール位置でスピードとブロブサイズが変化
    float scrollFactor = uScroll;
    float dynSpeed = uSpeed * (1.0 + scrollFactor * 0.5);
    float dynBlobSz = uBlobSz * (1.0 - scrollFactor * 0.3);
    float t = uTime * dynSpeed;

    // マウス位置によるブロブへの微細な影響（係数0.08で控えめに）
    vec2 mouseInfluence = (uMouse - 0.5) * 0.08 * ar;

    // スクロールでブロブ位置がシフト（画面中央に収束していく感覚）
    float convergeFactor = scrollFactor * 0.15;
    vec2 b1p = organicPos(t, 0.18*ar, 0.78, 0.45*ar, 1.0, 0.7, 0.0) + mouseInfluence;
    b1p = mix(b1p, vec2(0.5*ar, 0.5), convergeFactor);
    vec2 b2p = organicPos(t, 0.82*ar, 0.22, 0.45*ar, 1.3, 0.5, 2.1) + mouseInfluence;
    b2p = mix(b2p, vec2(0.5*ar, 0.5), convergeFactor);
    vec2 b3p = organicPos(t, 0.50*ar, 0.50, 0.45*ar*0.7, 0.8, 1.1, 4.2) + mouseInfluence;
    b3p = mix(b3p, vec2(0.5*ar, 0.5), convergeFactor);

    float b1 = blob(uv, b1p, dynBlobSz);
    float b2 = blob(uv, b2p, dynBlobSz);
    float b3 = blob(uv, b3p, dynBlobSz);

    vec3 c1, c2, c3;
    if (uTheme == 0) { // Dark
      c1 = vec3(0.20, 0.25, 0.33);
      c2 = vec3(0.32, 0.32, 0.36);
      c3 = vec3(0.58, 0.64, 0.72);
    } else { // Light
      c1 = vec3(0.55, 0.82, 0.96);
      c2 = vec3(0.65, 0.88, 0.98);
      c3 = vec3(0.78, 0.93, 0.99);
    }

    float blobTotalValue = b1*0.6 + b2*0.5 + b3*0.4;
    // スクロール進行でブライトネスが微妙に変化
    float dynBr = uBr * (1.0 + scrollFactor * 0.2);
    float finalAlpha = clamp(blobTotalValue, 0.0, 1.0) * dynBr;

    vec3 finalColor = (c1*b1*0.6 + c2*b2*0.5 + c3*b3*0.4) / max(blobTotalValue, 0.0001);
    
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const isDark = theme === 'dark';
    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTheme: { value: isDark ? 0 : 1 },
      uSpeed: { value: isDark ? 0.40 : 0.35 },
      uBlobSz: { value: (isDark ? 0.15 : 0.10) * (window.innerWidth / window.innerHeight) },
      uBr: { value: isDark ? 0.45 : 0.30 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const timer = new THREE.Timer();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      timer.update();
      uniforms.uTime.value = timer.getElapsed();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.uRes.value.set(w, h);
      uniforms.uBlobSz.value = (isDark ? 0.15 : 0.10) * (w / h);
    };
    window.addEventListener('resize', handleResize);

    // マウス位置をuniformに渡す（Y軸はGLSL座標系に合わせて反転）
    const handleMouseMove = (e: MouseEvent) => {
      uniforms.uMouse.value.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight,
      );
    };
    window.addEventListener('mousemove', handleMouseMove);

    // スクロール位置をuniformに渡す（0〜1）
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      uniforms.uScroll.value = total > 0 ? window.scrollY / total : 0;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};
