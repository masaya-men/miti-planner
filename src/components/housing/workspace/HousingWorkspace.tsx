import { useCallback, useEffect, useState } from 'react';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { SceneryVideo } from './SceneryVideo';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LiquidGlassPanel } from './LiquidGlassPanel';
import { FilterPanel } from './FilterPanel';
import { CenterArea } from './CenterArea';
import { RightPanel } from './RightPanel';
import { FavoritesModal } from './FavoritesModal';
import { HousingRegisterModal } from './HousingRegisterModal';
import '../../../styles/housing.css';

/**
 * Mockup-faithful Housing Workspace shell.
 * - 3-row CSS grid: 60px header, 1fr main, 40px status
 * - 3-column main: 280px left / 1fr center / 360px right (mockup spec)
 * - Per-panel SVG displacement filter via LiquidGlassPanel
 * - Scenery video + theme-conditional overlay + darkening veil behind everything
 */
export const HousingWorkspace: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useHousingViewStore((s) => s.setLeftPanelOpen);
  const setRightPanelOpen = useHousingViewStore((s) => s.setRightPanelOpen);
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

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
  const handleRegisterClick = useCallback(() => setRegisterModalOpen(true), []);

  return (
    <main className="housing-workspace" data-theme={theme}>
      <SceneryVideo theme={theme} />
      <div className="housing-shell">
        <TopBar onFavoritesClick={() => setFavoritesModalOpen(true)} />
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
            <CenterArea />
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
      <HousingRegisterModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
    </main>
  );
};
