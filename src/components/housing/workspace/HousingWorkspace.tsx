import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { SceneryVideo } from './SceneryVideo';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LiquidGlassPanel } from './LiquidGlassPanel';
import { FilterPanel } from './FilterPanel';
import { CenterArea } from './CenterArea';
import { RightPanel } from './RightPanel';
import { FavoritesModal } from './FavoritesModal';
import { HousingRegisterFormModal } from '../register/HousingRegisterFormModal';
import { HousingLoginModal } from '../login/HousingLoginModal';
import { HousingAccountModal } from '../login/HousingAccountModal';
import { HousingPlaybackProvider } from '../../../lib/housing/HousingPlaybackContext';
import '../../../styles/housing.css';

/**
 * Mockup-faithful Housing Workspace shell.
 * - 3-row CSS grid: 60px header, 1fr main, 40px status
 * - 3-column main: 280px left / 1fr center / 360px right (mockup spec)
 * - Per-panel SVG displacement filter via LiquidGlassPanel
 * - Scenery video + theme-conditional overlay + darkening veil behind everything
 */
export const HousingWorkspace: React.FC = () => {
  const { listingId, tourId } = useParams<{ listingId?: string; tourId?: string }>();
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useHousingViewStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useHousingViewStore((s) => s.setRightPanelOpen);
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const registerOpen = useHousingModalStore((s) => s.register.open);
  const openRegisterAction = useHousingModalStore((s) => s.openRegister);
  const closeRegisterAction = useHousingModalStore((s) => s.closeRegister);
  const syncFromUrl = useHousingModalStore((s) => s.syncFromUrl);

  // URL → store: マウント時 / ブラウザバック時に URL クエリを読んで store に反映
  useEffect(() => {
    syncFromUrl(searchParams);
  }, [searchParams, syncFromUrl]);

  // Tour auto-enter: fires once per tourId mount.
  // We read listingIds via getState() (not as a subscription) so this effect does NOT
  // re-fire when the user later adds/removes favorites. The ref guard prevents re-entry
  // on unrelated re-renders while the same tourId is in the URL.
  // Phase 2 note: cross-device restore (fetching tour from Firestore by id) is out of
  // scope here — Phase 1 is local-restore only.
  const startTour = useHousingTourStore((s) => s.start);
  const enterTourMode = useHousingViewStore((s) => s.enterTourMode);
  const handledTourIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tourId) return;
    if (handledTourIdRef.current === tourId) return;
    // Read store on demand — not as a subscription — so this effect never re-fires
    // due to listings-length changes.
    const ids = useHousingTourStore.getState().listingIds;
    if (ids.length === 0) return;
    sessionStorage.setItem('housing-tour-id', tourId);
    startTour();
    enterTourMode();
    handledTourIdRef.current = tourId;
  }, [tourId, startTour, enterTourMode]);

  // 物件一覧データを 1 回だけロード (冪等)。一覧系パネルが共有ストアから読む。
  useEffect(() => {
    void useHousingListingsStore.getState().load();
  }, []);

  // Lock body scroll while workspace is mounted (mockup is a fixed-viewport experience).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleCloseLeft = useCallback(() => setLeftPanelOpen(false), [setLeftPanelOpen]);
  const handleCloseRight = useCallback(() => setRightPanelOpen(false), [setRightPanelOpen]);

  // store → URL: register.open が変わったら URL も同期
  const handleRegisterClick = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set('register', 'open');
    setSearchParams(params);
    openRegisterAction();
  }, [searchParams, setSearchParams, openRegisterAction]);

  const handleCloseRegister = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('register');
    setSearchParams(params);
    closeRegisterAction();
  }, [searchParams, setSearchParams, closeRegisterAction]);

  // 2026-05-27: 詳細モーダル open 時は一覧の動画 hero を停止 (Task 5.2 で store 接続予定)
  const lightboxOpen = !!listingId;

  return (
    <main className="housing-workspace" data-theme={theme}>
      <SceneryVideo theme={theme} />
      <HousingPlaybackProvider lightboxOpen={lightboxOpen}>
      <div className="housing-shell">
        <TopBar
          onFavoritesClick={() => setFavoritesModalOpen(true)}
          onRegisterClick={handleRegisterClick}
        />
        <div
          className="housing-main"
          data-left-collapsed={leftPanelOpen ? 'false' : 'true'}
          data-right-collapsed={rightPanelOpen ? 'false' : 'true'}
        >
          {leftPanelOpen ? (
            <LiquidGlassPanel edge={160} radius={18} scale={49} data-region="left">
              <FilterPanel onClose={handleCloseLeft} onRegisterClick={handleRegisterClick} />
            </LiquidGlassPanel>
          ) : (
            <div data-region="left" aria-hidden="true" />
          )}

          <LiquidGlassPanel edge={160} radius={18} scale={49} data-region="center">
            <CenterArea focusListingId={listingId} />
          </LiquidGlassPanel>

          {rightPanelOpen ? (
            <LiquidGlassPanel edge={160} radius={18} scale={49} data-region="right">
              <RightPanel onClose={handleCloseRight} />
            </LiquidGlassPanel>
          ) : (
            <div data-region="right" aria-hidden="true" />
          )}
        </div>
        <StatusBar />
      </div>
      <FavoritesModal open={favoritesModalOpen} onClose={() => setFavoritesModalOpen(false)} />
      </HousingPlaybackProvider>
      <HousingRegisterFormModal open={registerOpen} onClose={handleCloseRegister} />
      <HousingLoginModal />
      <HousingAccountModal />
    </main>
  );
};
