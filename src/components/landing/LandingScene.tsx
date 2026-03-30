/**
 * LandingScene — 150万パーティクルのグリッド
 *
 * シンプルに画面全体にグリッド状に並んだ粒。
 * マウスを近づけると周囲の粒がふわっと浮き上がる。
 * テキスト形状への集合アニメーション対応（forwardRef）。
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 500000 : 1500000;

export { PARTICLE_COUNT };

/** 外部から制御するためのハンドル */
export interface LandingSceneHandle {
  /** テキスト集合の進行度（0〜1） */
  setFormProgress: (v: number) => void;
  /** パーティクルのターゲット座標を設定 */
  setTargets: (positions: Float32Array, count: number) => void;
  /** CTAテキスト集合のターゲット座標を設定 */
  setCtaTargets: (positions: Float32Array, count: number) => void;
  /** CTAテキスト集合の進行度（0〜1） */
  setCtaFormProgress: (v: number) => void;
}

const vertexShader = /* glsl */ `
  attribute float aRandom;
  attribute vec2 aTarget;
  attribute float aHasTarget;
  attribute vec2 aCtaTarget;
  attribute float aHasCtaTarget;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uDpr;
  uniform float uFormProgress;
  uniform float uCtaFormProgress;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Heroテキスト形状への集合（マウスインタラクションより先に適用）
    if (aHasTarget > 0.5) {
      float ease = uFormProgress * uFormProgress * (3.0 - 2.0 * uFormProgress);
      pos.x = mix(pos.x, aTarget.x, ease);
      pos.y = mix(pos.y, aTarget.y, ease);
      pos.z = mix(pos.z, 0.0, ease);
    }

    // CTAテキスト形状への遷移
    if (aHasCtaTarget > 0.5) {
      float ctaEase = uCtaFormProgress * uCtaFormProgress * (3.0 - 2.0 * uCtaFormProgress);
      pos.x = mix(pos.x, aCtaTarget.x, ctaEase);
      pos.y = mix(pos.y, aCtaTarget.y, ctaEase);
      pos.z = mix(pos.z, 0.0, ctaEase);
    }

    // マウスからの距離
    vec2 mWorld = uMouse;
    vec2 delta = pos.xy - mWorld;
    float dist = length(delta);
    float radius = 1.5;
    float influence = 0.0;

    if (dist < radius && dist > 0.001) {
      float t = 1.0 - dist / radius;
      influence = t * t;

      // 押し退け（控えめ — 穴が空かない程度）
      vec2 pushDir = normalize(delta);
      pos.xy += pushDir * influence * 0.12;

      // Z方向: 浮き上がる
      pos.z += influence * 0.4;
    }

    // 有機的なアメーバ揺らぎ（複数のsin/cosを重ね合わせ）
    float t = uTime * 0.3;
    float px = pos.x * 1.5;
    float py = pos.y * 1.5;
    pos.x += sin(py * 2.0 + t * 1.1) * 0.015
           + cos(px * 3.0 + t * 0.7) * 0.008;
    pos.y += cos(px * 2.0 + t * 0.9) * 0.015
           + sin(py * 3.0 + t * 1.3) * 0.008;
    pos.z += sin(px * 2.0 + t) * cos(py * 2.0 + t * 0.8) * 0.03
           + sin(px * 4.0 - py * 3.0 + t * 0.6) * 0.015;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // サイズ: 均一（発光なし — ブロブが色反転を担当）
    float size = (0.3 + aRandom * 0.2) * uDpr;
    gl_PointSize = size * (4.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 3.0);

    // Hero・CTA両方のハイライトを考慮
    float targetHighlight = max(uFormProgress * aHasTarget, uCtaFormProgress * aHasCtaTarget);
    vAlpha = mix(0.25, 0.5, targetHighlight);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(1.0), vAlpha);
  }
`;

export const LandingScene = forwardRef<LandingSceneHandle>(function LandingScene(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // useRef でジオメトリとユニフォームを保持（useImperativeHandle から参照）
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

  useImperativeHandle(ref, () => ({
    setFormProgress(v: number) {
      if (uniformsRef.current) {
        (uniformsRef.current.uFormProgress as { value: number }).value = v;
      }
    },
    setTargets(positions: Float32Array, count: number) {
      const geo = geometryRef.current;
      if (!geo) return;

      const targetArr = new Float32Array(count * 2);
      const hasTargetArr = new Float32Array(count);

      // positions は [x0, y0, x1, y1, ...] 形式
      const available = Math.min(positions.length / 2, count);
      for (let i = 0; i < available; i++) {
        targetArr[i * 2] = positions[i * 2];
        targetArr[i * 2 + 1] = positions[i * 2 + 1];
        hasTargetArr[i] = 1.0;
      }

      // バッファアトリビュートを設定
      const targetAttr = new THREE.BufferAttribute(targetArr, 2);
      const hasTargetAttr = new THREE.BufferAttribute(hasTargetArr, 1);
      geo.setAttribute('aTarget', targetAttr);
      geo.setAttribute('aHasTarget', hasTargetAttr);
      targetAttr.needsUpdate = true;
      hasTargetAttr.needsUpdate = true;
    },
    setCtaTargets(positions: Float32Array, count: number) {
      const geo = geometryRef.current;
      if (!geo) return;

      const targetArr = new Float32Array(count * 2);
      const hasTargetArr = new Float32Array(count);

      // positions は [x0, y0, x1, y1, ...] 形式
      const available = Math.min(positions.length / 2, count);
      for (let i = 0; i < available; i++) {
        targetArr[i * 2] = positions[i * 2];
        targetArr[i * 2 + 1] = positions[i * 2 + 1];
        hasTargetArr[i] = 1.0;
      }

      // バッファアトリビュートを設定
      const ctaTargetAttr = new THREE.BufferAttribute(targetArr, 2);
      const ctaHasTargetAttr = new THREE.BufferAttribute(hasTargetArr, 1);
      geo.setAttribute('aCtaTarget', ctaTargetAttr);
      geo.setAttribute('aHasCtaTarget', ctaHasTargetAttr);
      ctaTargetAttr.needsUpdate = true;
      ctaHasTargetAttr.needsUpdate = true;
    },
    setCtaFormProgress(v: number) {
      if (uniformsRef.current) {
        (uniformsRef.current.uCtaFormProgress as { value: number }).value = v;
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    // --- グリッド生成 ---
    const aspect = window.innerWidth / window.innerHeight;
    // カメラのFOVから見える範囲を計算
    const vFov = (50 * Math.PI) / 180;
    const planeH = 2 * Math.tan(vFov / 2) * 5; // z=5でのビュー高さ
    const planeW = planeH * aspect;

    // グリッドの行列数を計算（正方形っぽい間隔）
    const cols = Math.ceil(Math.sqrt(PARTICLE_COUNT * aspect));
    const rows = Math.ceil(PARTICLE_COUNT / cols);
    const total = cols * rows;

    const positions = new Float32Array(total * 3);
    const randoms = new Float32Array(total);

    const spacingX = planeW / cols;
    const spacingY = planeH / rows;
    const offsetX = -planeW / 2;
    const offsetY = -planeH / 2;

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[i * 3]     = offsetX + col * spacingX + spacingX * 0.5;
      positions[i * 3 + 1] = offsetY + row * spacingY + spacingY * 0.5;
      positions[i * 3 + 2] = 0;
      randoms[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    // 初期値として空のターゲットアトリビュートを設定（Hero用）
    const emptyTarget = new Float32Array(total * 2);
    const emptyHasTarget = new Float32Array(total);
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(emptyTarget, 2));
    geometry.setAttribute('aHasTarget', new THREE.BufferAttribute(emptyHasTarget, 1));

    // 初期値として空のCTAターゲットアトリビュートを設定
    const emptyCtaTarget = new Float32Array(total * 2);
    const emptyHasCtaTarget = new Float32Array(total);
    geometry.setAttribute('aCtaTarget', new THREE.BufferAttribute(emptyCtaTarget, 2));
    geometry.setAttribute('aHasCtaTarget', new THREE.BufferAttribute(emptyHasCtaTarget, 1));

    geometryRef.current = geometry;

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(999, 999) },
      uDpr: { value: dpr },
      uFormProgress: { value: 0 },
      uCtaFormProgress: { value: 0 },
    };
    uniformsRef.current = uniforms;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    animate();

    // マウス → ワールド座標に変換（z=0平面上）
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPoint = new THREE.Vector3();

    const handleMouseMove = (e: MouseEvent) => {
      mouseNdc.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(groundPlane, intersectPoint);
      if (intersectPoint) {
        uniforms.uMouse.value.set(intersectPoint.x, intersectPoint.y);
      }
    };

    const handleMouseLeave = () => {
      uniforms.uMouse.value.set(999, 999);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      geometryRef.current = null;
      uniformsRef.current = null;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
});
