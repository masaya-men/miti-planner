/**
 * LandingScene — 150万パーティクルのグリッド
 *
 * シンプルに画面全体にグリッド状に並んだ粒。
 * マウスを近づけると周囲の粒がふわっと浮き上がる。
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const PARTICLE_COUNT = isMobile ? 500000 : 1500000;

const vertexShader = /* glsl */ `
  attribute float aRandom;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uDpr;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // マウスからの距離
    vec2 mWorld = uMouse;
    vec2 delta = pos.xy - mWorld;
    float dist = length(delta);
    float radius = 1.5;
    float influence = 0.0;

    if (dist < radius) {
      float t = 1.0 - dist / radius;
      influence = t * t;

      // Z方向だけ浮き上がる（XY移動なし→黒穴にならない）
      pos.z += influence * 0.4;
    }

    // 微細な呼吸（全体がゆっくりうねる）
    pos.z += sin(pos.x * 2.0 + uTime * 0.4) * cos(pos.y * 2.0 + uTime * 0.3) * 0.02;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // サイズ: 影響下の粒は少し大きく
    float size = (0.3 + aRandom * 0.2 + influence * 0.6) * uDpr;
    gl_PointSize = size * (4.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);

    // 影響下の粒は明るく
    vAlpha = 0.25 + influence * 2.5;
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

export function LandingScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(999, 999) },
      uDpr: { value: dpr },
    };

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
}
