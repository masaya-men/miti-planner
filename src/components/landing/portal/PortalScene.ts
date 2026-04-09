import * as THREE from 'three';
import { detectTier, getQualityPreset, createFpsMonitor } from './performanceTier';
import { getPortalColors } from './types';
import { createParticleSystem } from './particles';
import { createGeometryGroup } from './geometries';
import { createCameraController } from './cameraController';
import { createPostProcessing } from './postProcessing';
import { createLogoMesh } from './logoMesh';
import { createPortalButtons, type PortalType } from './portalButtons';

export interface PortalSceneInstance {
  getHoveredPortal: () => PortalType | null;
  projectToScreen: (worldPos: THREE.Vector3) => { x: number; y: number };
  dispose: () => void;
}

export function createPortalScene(
  canvas: HTMLCanvasElement,
  onReadyCallback: () => void,
  onHoverChange: (portal: PortalType | null) => void,
  onPortalClick: (portal: PortalType) => void,
): PortalSceneInstance {
  // --- Tier & quality ---
  const tier = detectTier();
  const preset = getQualityPreset(tier);
  const colors = getPortalColors();
  const fpsMonitor = createFpsMonitor(tier);

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: preset.maxPixelRatio <= 1,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(colors.bg, 0.04);

  // --- Ambient light ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // --- Camera controller ---
  const cameraCtrl = createCameraController();
  const { camera } = cameraCtrl;

  // --- Modules ---
  const particles = createParticleSystem(preset, colors);
  scene.add(particles.points);

  const geoGroup = createGeometryGroup(preset, colors);
  scene.add(geoGroup.cyan.group);
  scene.add(geoGroup.amber.group);

  const logo = createLogoMesh(colors);
  scene.add(logo.mesh);

  const buttons = createPortalButtons(colors);
  scene.add(buttons.cyanGroup);
  scene.add(buttons.amberGroup);

  // --- Mouse state ---
  const mouse = new THREE.Vector2(0, 0);
  let previousHovered: PortalType | null = null;

  // --- Post-processing (async) ---
  let pp: Awaited<ReturnType<typeof createPostProcessing>> | null = null;
  createPostProcessing(renderer, scene, camera, preset).then(result => {
    pp = result;
  });

  // --- Animation loop ---
  let rafId: number;
  let readySignalled = false;
  const clock = new THREE.Clock();

  const animate = () => {
    rafId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    // FPS monitoring
    const suggestedTier = fpsMonitor.tick();
    if (suggestedTier !== null) {
      console.log(`[PortalScene] FPS degraded — suggested tier: ${suggestedTier}`);
    }

    // Update modules
    cameraCtrl.update(elapsed);
    particles.material.uniforms.uTime.value = elapsed;
    geoGroup.cyan.objects.forEach(o => o.update(elapsed));
    geoGroup.amber.objects.forEach(o => o.update(elapsed));
    logo.update(elapsed);
    buttons.update(elapsed);

    // Raycasting for hover
    const hovered = buttons.raycast(mouse, camera);
    buttons.state.hovered = hovered;
    if (hovered !== previousHovered) {
      previousHovered = hovered;
      onHoverChange(hovered);
    }

    // Render
    if (pp) {
      pp.composer.render();
    } else {
      renderer.render(scene, camera);
    }

    // Signal ready after first frame
    if (!readySignalled) {
      readySignalled = true;
      onReadyCallback();
    }
  };

  // --- Theme change detection ---
  const themeObserver = new MutationObserver(() => {
    const newColors = getPortalColors();
    renderer.setClearColor(newColors.bg, 1);
    scene.fog = new THREE.FogExp2(newColors.bg, 0.04);
    particles.material.uniforms.uColorCyan.value = newColors.cyan;
    particles.material.uniforms.uColorAmber.value = newColors.amber;
    // Update portal lights
    (buttons.cyanGroup.children[2] as THREE.PointLight).color = newColors.cyan;
    (buttons.amberGroup.children[2] as THREE.PointLight).color = newColors.amber;
    // Update portal glow spheres
    const cyanGlowMat = (buttons.cyanGroup.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    cyanGlowMat.color = newColors.cyan;
    const amberGlowMat = (buttons.amberGroup.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    amberGlowMat.color = newColors.amber;
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  animate();

  // --- Mouse event handlers ---
  const handleMouseMove = (e: MouseEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    cameraCtrl.onMouseMove(e);
  };

  const handleClick = () => {
    if (buttons.state.hovered !== null) {
      onPortalClick(buttons.state.hovered);
    }
  };

  const handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    cameraCtrl.onResize();
    if (pp) pp.resize(w, h);
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('click', handleClick);
  window.addEventListener('resize', handleResize);

  // --- Public API ---
  const getHoveredPortal = (): PortalType | null => buttons.state.hovered;

  const projectToScreen = (worldPos: THREE.Vector3): { x: number; y: number } => {
    const vec = worldPos.clone().project(camera);
    return {
      x: (vec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
    };
  };

  const dispose = () => {
    cancelAnimationFrame(rafId);
    themeObserver.disconnect();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('click', handleClick);
    window.removeEventListener('resize', handleResize);

    particles.dispose();
    geoGroup.cyan.dispose();
    geoGroup.amber.dispose();
    logo.dispose();
    buttons.dispose();
    cameraCtrl.dispose();
    if (pp) pp.dispose();
    ambientLight.dispose();
    renderer.dispose();
  };

  return { getHoveredPortal, projectToScreen, dispose };
}
