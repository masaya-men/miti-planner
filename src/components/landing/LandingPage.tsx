import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { createPortalScene, type PortalSceneInstance } from './portal/PortalScene';
import { PORTAL_CYAN_POS, PORTAL_AMBER_POS } from './portal/types';
import type { PortalType } from './portal/portalButtons';
import { CustomCursor } from './CustomCursor';
import { Preloader } from './Preloader';
import { LangToggle } from './LangToggle';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortalSceneInstance | null>(null);
  const cyanLabelRef = useRef<HTMLButtonElement>(null);
  const amberLabelRef = useRef<HTMLButtonElement>(null);
  const labelRafRef = useRef<number>(0);

  // --- State ---
  const [sceneReady, setSceneReady] = useState(false);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [hoveredPortal, setHoveredPortal] = useState<PortalType | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [warping, setWarping] = useState(false);

  // --- ページタイトル ---
  useEffect(() => {
    document.title = t('app.page_title_landing');
  }, [t]);

  // --- 3Dシーン初期化 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const instance = createPortalScene(
      canvas,
      // onReady
      () => setSceneReady(true),
      // onHoverChange
      (portal: PortalType | null) => setHoveredPortal(portal),
      // onPortalClick
      (portal: PortalType) => {
        if (portal === 'cyan') {
          // ワープトランジション → /miti へ遷移
          setWarping(true);
          setTimeout(() => {
            navigate('/miti');
          }, 500);
        } else if (portal === 'amber') {
          // Coming Soon トースト表示
          setShowComingSoon(true);
        }
      },
    );

    sceneRef.current = instance;

    return () => {
      instance.dispose();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- ポータルラベルの3D→2D位置更新 ---
  useEffect(() => {
    const updateLabelPositions = () => {
      const instance = sceneRef.current;
      if (instance && cyanLabelRef.current && amberLabelRef.current) {
        const cyanScreen = instance.projectToScreen(PORTAL_CYAN_POS.clone() as THREE.Vector3);
        const amberScreen = instance.projectToScreen(PORTAL_AMBER_POS.clone() as THREE.Vector3);

        // シアンラベル: ポータルの少し下に配置
        cyanLabelRef.current.style.transform =
          `translate(-50%, -50%) translate(${cyanScreen.x}px, ${cyanScreen.y + 60}px)`;
        // アンバーラベル: ポータルの少し下に配置
        amberLabelRef.current.style.transform =
          `translate(-50%, -50%) translate(${amberScreen.x}px, ${amberScreen.y + 60}px)`;
      }
      labelRafRef.current = requestAnimationFrame(updateLabelPositions);
    };

    labelRafRef.current = requestAnimationFrame(updateLabelPositions);

    return () => {
      cancelAnimationFrame(labelRafRef.current);
    };
  }, []);

  // --- Coming Soon トースト自動非表示 ---
  useEffect(() => {
    if (!showComingSoon) return;
    const timer = setTimeout(() => setShowComingSoon(false), 2000);
    return () => clearTimeout(timer);
  }, [showComingSoon]);

  // --- Preloader完了コールバック ---
  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  // --- ポータルラベルクリック ---
  const handleCyanClick = useCallback(() => {
    setWarping(true);
    setTimeout(() => {
      navigate('/miti');
    }, 500);
  }, [navigate]);

  const handleAmberClick = useCallback(() => {
    setShowComingSoon(true);
  }, []);

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: 'var(--color-lp-bg)' }}>
      {/* ===== 3Dキャンバス（固定背景） ===== */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0"
        style={{
          width: '100vw',
          height: '100vh',
          transition: warping ? 'transform 500ms ease-in, filter 500ms ease-in' : 'none',
          transform: warping ? 'scale(2)' : 'scale(1)',
          filter: warping ? 'blur(20px) brightness(2)' : 'none',
        }}
      />

      {/* ===== HTMLオーバーレイ（固定、pointer-events制御） ===== */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{
          opacity: preloaderDone ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
      >
        {/* ポータルラベルボタン群 */}
        <div className="absolute inset-0">
          {/* シアンポータルラベル */}
          <button
            ref={cyanLabelRef}
            onClick={handleCyanClick}
            className="absolute top-0 left-0 pointer-events-auto transition-all duration-200"
            style={{
              willChange: 'transform',
              border: `1px solid var(--color-portal-cyan)`,
              color: 'var(--color-portal-cyan)',
              borderRadius: '9999px',
              padding: '8px 24px',
              fontSize: 'clamp(12px, 1.5vw, 16px)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: hoveredPortal === 'cyan'
                ? 'rgba(0, 212, 255, 0.15)'
                : 'rgba(0, 212, 255, 0.05)',
              boxShadow: hoveredPortal === 'cyan'
                ? '0 0 20px rgba(0, 212, 255, 0.4), inset 0 0 12px rgba(0, 212, 255, 0.1)'
                : '0 0 8px rgba(0, 212, 255, 0.15)',
              transform: 'translate(-50%, -50%)',
            }}
            data-hover
          >
            {t('portal.miti_button')}
          </button>

          {/* アンバーポータルラベル */}
          <button
            ref={amberLabelRef}
            onClick={handleAmberClick}
            className="absolute top-0 left-0 pointer-events-auto transition-all duration-200"
            style={{
              willChange: 'transform',
              border: `1px solid var(--color-portal-amber)`,
              color: 'var(--color-portal-amber)',
              borderRadius: '9999px',
              padding: '8px 24px',
              fontSize: 'clamp(12px, 1.5vw, 16px)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              background: hoveredPortal === 'amber'
                ? 'rgba(255, 179, 71, 0.15)'
                : 'rgba(255, 179, 71, 0.05)',
              boxShadow: hoveredPortal === 'amber'
                ? '0 0 20px rgba(255, 179, 71, 0.4), inset 0 0 12px rgba(255, 179, 71, 0.1)'
                : '0 0 8px rgba(255, 179, 71, 0.15)',
              transform: 'translate(-50%, -50%)',
            }}
            data-hover
          >
            {t('portal.housing_button')}
          </button>
        </div>
      </div>

      {/* ===== スクロール用コンテンツレイヤー ===== */}
      <div className="relative z-[3]">
        {/* 100vhスペーサー（キャンバス表示エリア） */}
        <div className="h-screen" />
        {/* フッター（スクロールで表示） */}
        <LandingFooter />
      </div>

      {/* ===== 固定UI要素 ===== */}
      {/* カスタムカーソル */}
      <CustomCursor portalHover={hoveredPortal} />

      {/* 言語トグル */}
      <LangToggle />

      {/* Coming Soon トースト */}
      <div
        className="fixed bottom-8 left-1/2 z-[10001] pointer-events-none"
        style={{
          transform: 'translateX(-50%)',
          opacity: showComingSoon ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
      >
        <div
          className="px-6 py-3 rounded-full text-sm font-medium"
          style={{
            backgroundColor: 'rgba(255, 179, 71, 0.15)',
            border: '1px solid var(--color-portal-amber)',
            color: 'var(--color-portal-amber)',
            boxShadow: '0 0 20px rgba(255, 179, 71, 0.2)',
          }}
        >
          {t('portal.housing_coming_soon')}
        </div>
      </div>

      {/* ===== プリローダー（最前面） ===== */}
      <Preloader
        sceneReady={sceneReady}
        onComplete={handlePreloaderComplete}
      />
    </div>
  );
}
