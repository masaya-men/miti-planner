import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { SceneryVideo } from './SceneryVideo';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

export const HousingWorkspace: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);

  return (
    <main
      className="relative min-h-screen flex flex-col"
      data-theme={theme}
      style={{ color: '#ffffff' }}
    >
      <SceneryVideo theme={theme} />
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar />
        <div className="flex-1 flex">
          {leftPanelOpen && (
            <aside
              data-region="left"
              className="w-72 shrink-0 border-r"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              {/* Plan B で FilterPanel に置き換え */}
              <div className="p-4 text-sm opacity-60">[Left panel — Plan B]</div>
            </aside>
          )}
          <section data-region="center" className="flex-1 min-w-0">
            {/* Plan C で CenterArea に置き換え */}
            <div className="p-4 text-sm opacity-60">[Center area — Plan C]</div>
          </section>
          {rightPanelOpen && (
            <aside
              data-region="right"
              className="w-80 shrink-0 border-l"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              {/* Plan D で RightPanel に置き換え */}
              <div className="p-4 text-sm opacity-60">[Right panel — Plan D]</div>
            </aside>
          )}
        </div>
        <StatusBar />
      </div>
    </main>
  );
};
