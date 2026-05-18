import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { SceneryVideo } from './SceneryVideo';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LiquidGlassPanel } from './LiquidGlassPanel';
import { FilterPanel } from './FilterPanel';
import { CenterArea } from './CenterArea';
import '../../../styles/housing.css';

/**
 * Mockup-faithful Housing Workspace shell.
 * - 3-row CSS grid: 60px header, 1fr main, 40px status
 * - 3-column main: 280px left / 1fr center / 360px right (mockup spec)
 * - Per-panel SVG displacement filter via LiquidGlassPanel
 * - Scenery video + theme-conditional overlay + darkening veil behind everything
 */
export const HousingWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);
  const setLeftPanelOpen = useHousingViewStore((s) => s.setLeftPanelOpen);

  // Lock body scroll while workspace is mounted (mockup is a fixed-viewport experience).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleCloseLeft = useCallback(() => setLeftPanelOpen(false), [setLeftPanelOpen]);
  // Routes to the legacy register hash for now; Plan F will replace this with
  // the dedicated register modal wired into the new workspace flow.
  const handleRegisterClick = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = 'register';
    }
  }, []);

  return (
    <main className="housing-workspace" data-theme={theme}>
      <SceneryVideo theme={theme} />
      <div className="housing-shell">
        <TopBar />
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
              <div className="housing-panel-head">
                <div className="housing-panel-title">{t('housing.workspace.panels.right_title')}</div>
                <div className="housing-panel-meta">— / —</div>
              </div>
              <div className="housing-panel-body">
                <p className="text-sm opacity-60">[Tour script — Plan D]</p>
              </div>
            </LiquidGlassPanel>
          ) : (
            <div data-region="right" aria-hidden="true" />
          )}
        </div>
        <StatusBar />
      </div>
    </main>
  );
};
